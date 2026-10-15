import { beforeEach, describe, expect, it } from "vitest"
import {
  applyFreeze, applyReactivate, applyStop, applyUnfreeze, daysLeft, displayStatus,
  projectedEnd, type SubscriptionRecord,
} from "../src/lib/subscriptionLedger"
import { controlForSerial, useSubscriptions } from "../src/store/useSubscriptions"
import { planStatus } from "../src/lib/plans"
import { codeForSerial } from "../src/lib/planCodes"
import { usePlan } from "../src/store/usePlan"

/**
 * The CMS ledger: one record per code, and the owner's two hands on it.
 *
 * The properties that matter are about time. A freeze must hand the client
 * back exactly the days they had paid for — no more (that is a gift), no fewer
 * (that is a dispute) — and a stopped code must stop, in the app as in the list.
 */

const record = (patch: Partial<SubscriptionRecord> = {}): SubscriptionRecord => ({
  id: "r1", code: "PRO-1M-K7Q2-BF6VSEZJ", serial: "K7Q2", plan: "pro", period: "1M",
  clientName: "Karim Benjelloun", company: "Atlas BTP", contact: "0612345678", source: "whatsapp",
  issuedAt: "2026-03-01", startsAt: "2026-03-10", endsAt: "2026-04-10",
  status: "active", frozenAt: null, note: "", ...patch,
})

describe("what the list shows", () => {
  it("walks a record through its life by date alone", () => {
    expect(displayStatus(record({ startsAt: null, endsAt: null }), "2026-03-05")).toBe("pending")
    expect(displayStatus(record(), "2026-03-15")).toBe("active")
    expect(displayStatus(record(), "2026-04-10")).toBe("active") // the last day still counts
    expect(displayStatus(record(), "2026-04-11")).toBe("expired")
    expect(displayStatus(record({ status: "frozen", frozenAt: "2026-03-20" }), "2026-05-01")).toBe("frozen")
    expect(displayStatus(record({ status: "stopped" }), "2026-03-15")).toBe("stopped")
  })

  it("projects the end before activation, then records it", () => {
    expect(projectedEnd(record({ startsAt: null, endsAt: null }))).toBe("2026-04-01") // from the issue date
    expect(projectedEnd(record())).toBe("2026-04-10")
    expect(daysLeft(record({ startsAt: null, endsAt: null }), "2026-03-05")).toBeNull()
    expect(daysLeft(record(), "2026-04-10")).toBe(0)
    expect(daysLeft(record(), "2026-04-01")).toBe(9)
  })
})

describe("freeze and resume", () => {
  it("gives back exactly the frozen days", () => {
    const frozen = applyFreeze(record(), "2026-03-20")
    expect(frozen).toMatchObject({ status: "frozen", frozenAt: "2026-03-20" })
    // 15 frozen days: 2026-03-20 → 2026-04-04. The end moves by 15, no more.
    const resumed = applyUnfreeze(frozen, "2026-04-04")
    expect(resumed).toMatchObject({ status: "active", frozenAt: null, endsAt: "2026-04-25" })
    // And the days left on resume day are the days left on freeze day (21).
    expect(daysLeft(resumed, "2026-04-04")).toBe(21)
  })

  it("freezing before activation shifts nothing — the window has not started", () => {
    const frozen = applyFreeze(record({ startsAt: null, endsAt: null }), "2026-03-05")
    const resumed = applyUnfreeze(frozen, "2026-03-20")
    expect(resumed.endsAt).toBeNull()
    expect(resumed.status).toBe("active")
  })

  it("ignores a freeze on a record that is not live", () => {
    const stopped = record({ status: "stopped" })
    expect(applyFreeze(stopped, "2026-03-20")).toBe(stopped)
  })

  it("stops terminally, and reactivates as a fresh unsent code", () => {
    const stopped = applyStop(record())
    expect(stopped.status).toBe("stopped")
    const again = applyReactivate(stopped, "2026-05-01")
    expect(again).toMatchObject({ status: "active", startsAt: null, endsAt: null, issuedAt: "2026-05-01" })
  })
})

/* ------------------------------ the store ------------------------------- */

beforeEach(() => {
  localStorage.clear()
  useSubscriptions.setState({ records: [] })
  usePlan.getState().forAccount(null)
  usePlan.getState().clear()
  localStorage.clear()
})

const issueOne = () => useSubscriptions.getState().issue({
  code: "PRO-1M-K7Q2-BF6VSEZJ", serial: "K7Q2", plan: "pro", period: "1M",
  clientName: "Karim Benjelloun", company: "Atlas BTP", contact: "0612345678",
  source: "instagram", note: "", issuedAt: "2026-03-01",
})

describe("the ledger store, and its grip on the app", () => {
  it("records the real start and end when the client redeems", async () => {
    issueOne()
    usePlan.getState().forAccount("user-1")
    await usePlan.getState().redeem(await codeForSerial("pro", "1M", "K7Q2"), "2026-03-10")

    const [saved] = useSubscriptions.getState().records
    expect(saved.startsAt).toBe("2026-03-10")
    expect(saved.endsAt).toBe("2026-04-10")
    expect(saved.source).toBe("instagram")
  })

  it("a freeze in the CMS freezes the plan in the app, days intact", async () => {
    const issued = issueOne()
    usePlan.getState().forAccount("user-1")
    await usePlan.getState().redeem(await codeForSerial("pro", "1M", "K7Q2"), "2026-03-10")
    const activation = usePlan.getState().activation!

    useSubscriptions.getState().freeze(issued.id, "2026-03-20")
    expect(planStatus(activation, "2026-03-25", controlForSerial("K7Q2"))).toMatchObject({ state: "frozen", daysLeft: 21 })

    useSubscriptions.getState().unfreeze(issued.id, "2026-04-04")
    expect(planStatus(activation, "2026-04-04", controlForSerial("K7Q2"))).toMatchObject({ state: "active", daysLeft: 21 })
    // The ledger's shifted end now rules, even past the original expiry.
    expect(planStatus(activation, "2026-04-20", controlForSerial("K7Q2"))).toMatchObject({ state: "active", daysLeft: 5 })
  })

  it("a stop in the CMS stops the plan, and redemption cannot revive it", async () => {
    const issued = issueOne()
    useSubscriptions.getState().stop(issued.id)
    usePlan.getState().forAccount("user-1")
    await usePlan.getState().redeem(await codeForSerial("pro", "1M", "K7Q2"), "2026-03-10")

    const activation = usePlan.getState().activation!
    expect(planStatus(activation, "2026-03-10", controlForSerial("K7Q2"))).toMatchObject({ state: "stopped", plan: "free" })
    // The stopped record was not quietly rewritten by the redemption.
    expect(useSubscriptions.getState().records[0].startsAt).toBeNull()
  })

  it("knows nothing about generic codes — they stay owner-proof and simple", async () => {
    issueOne()
    expect(controlForSerial(null)).toBeNull()
    expect(controlForSerial("ZZZZ")).toBeNull()
  })
})
