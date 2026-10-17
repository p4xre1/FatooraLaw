import { describe, expect, it } from "vitest"
import {
  ADVANCED_MODULES, PLANS, PLAN_MODULE_ORDER, PLAN_ORDER, activationFor, planGain,
  planBannerKey, planIncludes, planStatus, requiredPlan, type PlanActivation,
} from "../src/lib/plans"
import type { ModuleKey } from "../src/store/types"

/**
 * The three account types, as a table rather than as prose.
 *
 * These assertions look repetitive on purpose. The matrix is the one thing in
 * this feature a wrong edit stays invisible in: an extra module in `free` is a
 * plan given away, and a module missing from `boost` is a client paying for
 * something they cannot open. So the two ends are asserted by name, and the
 * middle one by its exclusions.
 */

/** A record as redeeming that code on that day would have produced. */
const redeemed = (plan: "pro" | "boost", period: "1M" | "1Y", day: string): PlanActivation =>
  activationFor({ code: `${plan.toUpperCase()}-${period}-A1B2C3D4`, plan, period }, null, day)

describe("the plan matrix", () => {
  it("gives FREE the things it is sold with, and nothing else", () => {
    expect(PLANS.free.modules).toEqual(["dashboard", "projects", "contacts", "procurement", "invoices", "reports", "settings"])
    for (const key of PLANS.free.modules) expect(planIncludes("free", key), key).toBe(true)
    // The rest of the product is visible in the rail but not openable.
    for (const key of ["inventory", "delivery", "verification", "calendar", "risk", "legal", "tools", "team", "audit"] as ModuleKey[])
      expect(planIncludes("free", key), key).toBe(false)
  })

  it("gives BOOST everything the app has", () => {
    const all: ModuleKey[] = [
      "dashboard", "projects", "contacts", "procurement", "inventory", "delivery", "verification", "calendar",
      "risk", "tools", "legal", "reports", "team", "audit", "settings",
    ]
    for (const key of all) expect(planIncludes("boost", key), key).toBe(true)
    expect(PLANS.boost.modules).toContain("invoices")
  })

  it("makes PRO the whole product minus the three advanced modules", () => {
    expect(PLANS.pro.modules).toEqual(
      PLANS.boost.modules.filter((key) => !ADVANCED_MODULES.includes(key as ModuleKey)),
    )
    for (const key of ADVANCED_MODULES) expect(planIncludes("pro", key), key).toBe(false)
    // And PRO is strictly between the other two: everything FREE has, it has.
    for (const key of PLANS.free.modules) expect(planIncludes("pro", key), key).toBe(true)
  })

  it("names one plan for a module, and never a lower one", () => {
    expect(requiredPlan("contacts")).toBe("free")
    expect(requiredPlan("reports")).toBe("free")
    expect(requiredPlan("invoices")).toBe("free")
    expect(requiredPlan("procurement")).toBe("free")
    expect(requiredPlan("team")).toBe("pro")
    expect(requiredPlan("delivery")).toBe("pro")
    expect(requiredPlan("verification")).toBe("pro")
    expect(requiredPlan("risk")).toBe("boost")
    expect(requiredPlan("legal")).toBe("boost")
    expect(requiredPlan("tools")).toBe("boost")

    // The cheapest plan that includes a module is the plan it is advertised
    // under — the rail lock and the upgrade page read the same answer.
    for (const plan of PLAN_ORDER) {
      for (const key of PLANS[plan].modules) {
        expect(PLAN_ORDER.indexOf(requiredPlan(key)), `${key} @ ${plan}`).toBeLessThanOrEqual(PLAN_ORDER.indexOf(plan))
      }
    }
  })

  it("lists only what an upgrade would actually add", () => {
    // What FREE is missing is what the PRO card must show, in rail order.
    const gain = planGain("pro", "free")
    expect(gain).toEqual(PLANS.pro.modules.filter((key) => !PLANS.free.modules.includes(key)))
    expect(gain).not.toContain("dashboard")
    expect(gain).not.toContain("invoices")

    // BOOST from FREE is everything, in the order the rail uses.
    expect(planGain("boost", "free")).toEqual(
      PLANS.boost.modules.filter((key) => !PLANS.free.modules.includes(key)),
    )
    // Nothing is added by staying where you are.
    expect(planGain("pro", "pro")).toEqual([])
    expect(planGain("free", "boost")).toEqual([])
  })

  it("prices the sold plans, and never charges for FREE", () => {
    expect(PLANS.free.monthlyPrice).toBe(0)
    expect(PLANS.free.yearlyPrice).toBe(0)
    for (const plan of ["pro", "boost"] as const) {
      expect(PLANS[plan].monthlyPrice).toBeGreaterThan(0)
      // A year is cheaper than twelve months, which is the whole reason to
      // offer it — and the landing page's two prices come from here.
      expect(PLANS[plan].yearlyPrice).toBeGreaterThan(PLANS[plan].monthlyPrice)
      expect(PLANS[plan].yearlyPrice).toBeLessThan(PLANS[plan].monthlyPrice * 12)
    }
    // Everything above FREE costs more than FREE.
    expect(PLANS.pro.monthlyPrice).toBeLessThan(PLANS.boost.monthlyPrice)
  })

  it("keeps the rail's order for every plan, so the cards read like the menu", () => {
    for (const plan of PLAN_ORDER) {
      expect(PLANS[plan].modules, plan).toEqual(PLAN_MODULE_ORDER.filter((module) => planIncludes(plan, module)))
    }
  })
})

describe("how long a plan runs", () => {
  it("keeps the dashboard banner dismissal stable through a paid window and changes it at the end", () => {
    const boost = redeemed("boost", "1M", "2026-03-10")
    const firstDay = planStatus(boost, "2026-03-10")
    const middleDay = planStatus(boost, "2026-03-25")
    const expired = planStatus(boost, "2026-04-11")

    // The remaining-day count changes every morning, but the banner should
    // stay hidden until the paid window actually closes.
    expect(firstDay.daysLeft).not.toBe(middleDay.daysLeft)
    expect(planBannerKey(firstDay)).toBe("active:boost:2026-04-10")
    expect(planBannerKey(middleDay)).toBe(planBannerKey(firstDay))
    expect(planBannerKey(expired)).toBe("expired:free:2026-04-10")
    expect(planBannerKey(expired)).not.toBe(planBannerKey(firstDay))
  })

  it("reports free, active and expired from the same record", () => {
    expect(planStatus(null, "2026-03-10")).toMatchObject({ plan: "free", state: "free", activation: null, daysLeft: null })

    const active = redeemed("pro", "1M", "2026-03-10")
    expect(planStatus(active, "2026-03-10")).toMatchObject({ plan: "pro", state: "active", daysLeft: 31 })
    expect(planStatus(active, "2026-04-09")).toMatchObject({ state: "active", daysLeft: 1 })
    // The last day is still a day, not an expiry.
    expect(planStatus(active, "2026-04-10")).toMatchObject({ state: "active", daysLeft: 0 })
    expect(planStatus(active, "2026-04-11")).toMatchObject({ plan: "free", state: "expired", daysLeft: 0 })
    // An expired BOOST is not a BOOST: the account falls back to FREE, but the
    // record is kept so the dashboard can still say what it was.
    const expiredBoost = redeemed("boost", "1M", "2026-01-01")
    const later = planStatus(expiredBoost, "2026-06-01")
    expect(later.plan).toBe("free")
    expect(later.state).toBe("expired")
    expect(later.activation).toBe(expiredBoost)
  })

  it("adds a month by the calendar, not by thirty days", () => {
    const cases: [string, string, string][] = [
      ["2026-01-31", "1M", "2026-02-28"],
      ["2026-01-15", "1M", "2026-02-15"],
      ["2026-12-15", "1M", "2027-01-15"],
      ["2027-01-31", "1M", "2027-02-28"],
      ["2028-01-31", "1M", "2028-02-29"], // a leap year keeps the 29th
      ["2026-02-28", "1Y", "2027-02-28"],
      ["2028-02-29", "1Y", "2029-02-28"], // 29 February has to land somewhere
      ["2026-12-31", "1Y", "2027-12-31"],
    ]
    for (const [start, period, end] of cases) {
      const record = redeemed("pro", period as "1M" | "1Y", start)
      expect(record.expiresAt, `${start} + ${period}`).toBe(end)
      // The window covers the whole last day: the plan is still on the day it
      // ends, and off the day after.
      expect(planStatus(record, end).state, `${start} + ${period} ends ${end}`).toBe("active")
      expect(planStatus(record, end).daysLeft).toBe(0)
    }
  })
})

describe("a second code", () => {
  const current = redeemed("pro", "1M", "2026-03-10")

  it("extends the same plan from its end, so no paid day is lost", () => {
    const extended = activationFor({ code: "PRO-1M-Y", plan: "pro", period: "1M" }, current, "2026-03-20")
    expect(extended.startedAt).toBe("2026-03-10")
    expect(extended.expiresAt).toBe("2026-05-10")
    // Redeeming on the last day still adds a full month.
    const onLastDay = activationFor({ code: "PRO-1Y-Y", plan: "pro", period: "1Y" }, current, "2026-04-10")
    expect(onLastDay.expiresAt).toBe("2027-04-10")
  })

  it("runs a different plan from today, because it replaces the other one", () => {
    const upgraded = activationFor({ code: "BOOST-1M-Y", plan: "boost", period: "1M" }, current, "2026-03-20")
    expect(upgraded.startedAt).toBe("2026-03-20")
    expect(upgraded.expiresAt).toBe("2026-04-20")
    expect(planStatus(upgraded, "2026-03-20").plan).toBe("boost")
  })

  it("ignores a lapsed record instead of extending a dead window", () => {
    const lapsed = activationFor({ code: "PRO-1M-Z", plan: "pro", period: "1M" }, current, "2026-06-01")
    expect(lapsed.startedAt).toBe("2026-06-01")
    expect(lapsed.expiresAt).toBe("2026-07-01")
  })

  it("keeps the newest code on the record, so the trail shows what was used last", () => {
    const extended = activationFor({ code: "PRO-1Y-Y", plan: "pro", period: "1Y" }, current, "2026-03-20")
    expect(extended.code).toBe("PRO-1Y-Y")
  })
})

describe("the owner's hand on a subscription (CMS freeze / stop)", () => {
  const live = redeemed("pro", "1M", "2026-03-10") // runs to 2026-04-10

  it("freezes the clock: the days left are the days left on the freeze day", () => {
    const control = { status: "frozen" as const, endsAt: null, frozenAt: "2026-03-20" }
    // Frozen on the 20th with 21 days left — still 21 days left a month later.
    expect(planStatus(live, "2026-03-20", control)).toMatchObject({ plan: "free", state: "frozen", daysLeft: 21 })
    expect(planStatus(live, "2026-04-25", control)).toMatchObject({ state: "frozen", daysLeft: 21 })
  })

  it("stops it outright, whatever the calendar says", () => {
    const control = { status: "stopped" as const, endsAt: null, frozenAt: null }
    expect(planStatus(live, "2026-03-15", control)).toMatchObject({ plan: "free", state: "stopped" })
    // The activation keeps its plan so the UI can say what was stopped.
    expect(planStatus(live, "2026-03-15", control).activation?.plan).toBe("pro")
  })

  it("lets the ledger's end date win over the redemption date", () => {
    // Unfreezing shifted the end from 2026-04-10 to 2026-04-25.
    const control = { status: "active" as const, endsAt: "2026-04-25", frozenAt: null }
    expect(planStatus(live, "2026-04-20", control)).toMatchObject({ plan: "pro", state: "active", daysLeft: 5 })
    expect(planStatus(live, "2026-04-26", control)).toMatchObject({ state: "expired" })
  })

  it("changes nothing when there is no record for the serial", () => {
    expect(planStatus(live, "2026-03-15", null)).toMatchObject({ plan: "pro", state: "active", daysLeft: 26 })
    expect(planStatus(live, "2026-03-15")).toMatchObject({ plan: "pro", state: "active", daysLeft: 26 })
  })
})
