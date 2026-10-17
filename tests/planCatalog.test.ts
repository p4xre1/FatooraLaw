import { beforeEach, describe, expect, it } from "vitest"
import { defaultCatalog, effectiveCopy, effectivePrices, yearlySaving } from "../src/lib/planCatalog"
import { usePlanCatalog } from "../src/store/usePlanCatalog"
import { PLANS } from "../src/lib/plans"

/**
 * The CMS-editable layer over the shipped prices and paragraphs:
 * overrides win where they exist, defaults hold everywhere else, FREE is
 * never for sale, and a reset always lands back on the shipped numbers.
 */

const fallback = { tagline: "fallback tagline", value: "fallback value" }

beforeEach(() => {
  localStorage.clear()
  usePlanCatalog.setState({ catalog: defaultCatalog() })
})

describe("prices", () => {
  it("defaults to the shipped prices, with FREE priceless", () => {
    expect(effectivePrices(null, "pro")).toEqual({ monthly: PLANS.pro.monthlyPrice, yearly: PLANS.pro.yearlyPrice })
    expect(effectivePrices(defaultCatalog(), "boost")).toEqual({ monthly: PLANS.boost.monthlyPrice, yearly: PLANS.boost.yearlyPrice })
    expect(effectivePrices(defaultCatalog(), "free")).toEqual({ monthly: 0, yearly: 0 })
  })

  it("lets the CMS move a price, and only that price", () => {
    usePlanCatalog.getState().setPrice("pro", "monthly", 149)
    const { catalog } = usePlanCatalog.getState()
    expect(effectivePrices(catalog, "pro")).toEqual({ monthly: 149, yearly: PLANS.pro.yearlyPrice })
    expect(effectivePrices(catalog, "boost").monthly).toBe(PLANS.boost.monthlyPrice)
  })

  it("computes the yearly saving, never negative", () => {
    expect(yearlySaving({ monthly: 79, yearly: 790 })).toBe(158)
    expect(yearlySaving({ monthly: 100, yearly: 5000 })).toBe(0) // a badly edited price floors at 0
    expect(yearlySaving({ monthly: 0, yearly: 0 })).toBe(0)
  })

  it("refuses a negative price instead of showing one", () => {
    usePlanCatalog.getState().setPrice("boost", "yearly", -50)
    expect(usePlanCatalog.getState().catalog.prices.boost.yearly).toBe(0)
  })
})

describe("paragraphs", () => {
  it("falls back to the app copy until the CMS writes its own", () => {
    expect(effectiveCopy(null, "pro", "fr", fallback)).toEqual(fallback)
    usePlanCatalog.getState().setCopy("pro", "fr", "value", "La valeur selon le patron.")
    expect(effectiveCopy(usePlanCatalog.getState().catalog, "pro", "fr", fallback)).toEqual({
      tagline: "fallback tagline", // untouched field still falls back
      value: "La valeur selon le patron.",
    })
  })

  it("keeps languages apart — a French edit is invisible in Arabic", () => {
    usePlanCatalog.getState().setCopy("boost", "fr", "tagline", "Tagline FR")
    const { catalog } = usePlanCatalog.getState()
    expect(effectiveCopy(catalog, "boost", "fr", fallback).tagline).toBe("Tagline FR")
    expect(effectiveCopy(catalog, "boost", "ar", fallback).tagline).toBe("fallback tagline")
  })

  it("treats blank edits as no edit at all", () => {
    usePlanCatalog.getState().setCopy("pro", "en", "value", "   ")
    expect(effectiveCopy(usePlanCatalog.getState().catalog, "pro", "en", fallback).value).toBe("fallback value")
  })

  it("resets everything to the shipped catalog", () => {
    usePlanCatalog.getState().setPrice("pro", "monthly", 1)
    usePlanCatalog.getState().setCopy("pro", "fr", "value", "x")
    usePlanCatalog.getState().reset()
    expect(usePlanCatalog.getState().catalog).toEqual(defaultCatalog())
  })
})

describe("the updated plan prices", () => {
  it("ships Pro at 79/month, Boost at 250/month and ten-month annual prices", () => {
    expect(defaultCatalog().prices).toEqual({ pro: { monthly: 79, yearly: 790 }, boost: { monthly: 250, yearly: 2500 } })
  })

  it("upgrades old persisted defaults without retaining stale prices", async () => {
    localStorage.setItem("fatorati.plan-catalog.v1", JSON.stringify({ version: 0, state: { catalog: {
      prices: { pro: { monthly: 199, yearly: 1990 }, boost: { monthly: 499, yearly: 4990 } }, copy: {},
    } } }))
    await usePlanCatalog.persist.rehydrate()
    expect(usePlanCatalog.getState().catalog).toEqual(defaultCatalog())
  })

  it("preserves custom prices and paragraphs during the defaults migration", async () => {
    const copy = { pro: { fr: { value: "Custom copy" } } }
    localStorage.setItem("fatorati.plan-catalog.v1", JSON.stringify({ version: 0, state: { catalog: {
      prices: { pro: { monthly: 99, yearly: 990 }, boost: { monthly: 499, yearly: 4990 } }, copy,
    } } }))
    await usePlanCatalog.persist.rehydrate()
    expect(usePlanCatalog.getState().catalog).toEqual({ prices: { pro: { monthly: 99, yearly: 990 }, boost: { monthly: 250, yearly: 2500 } }, copy })
  })
})
