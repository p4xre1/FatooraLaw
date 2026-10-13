import { beforeEach, expect, it } from "vitest"
import { calendarDay, daysUntil, validDateRange } from "../src/lib/calendarDates"
import { monthlySubscriptionCosts, subscriptionStatus } from "../src/lib/subscriptions"
import { parseAmount, MAX_AMOUNT, MAX_QUANTITY } from "../src/lib/businessValidation"
import { accountStorageKey, useMizan } from "../src/store/useMizan"

beforeEach(() => {
  useMizan.getState().signOut()
  localStorage.clear()
})

it("restores subscriptions after logout/relogin and never shares them across accounts", () => {
  useMizan.getState().signIn("A", "a@gmail.com", "owner", "tools-a")
  useMizan.getState().addTool({ name: "A's tool", cost: 19.5, start: "", expiry: "" })
  useMizan.getState().removeTool("t1")
  const saved = JSON.parse(localStorage.getItem(accountStorageKey("tools-a"))!).state
  expect(saved.tools[0].name).toBe("A's tool")
  expect(saved.auth).toBeUndefined()
  useMizan.getState().signOut()
  useMizan.getState().signIn("B", "b@gmail.com", "owner", "tools-b")
  expect(useMizan.getState().tools.some((t) => t.name === "A's tool")).toBe(false)
  expect(useMizan.getState().tools).toEqual([])
  useMizan.getState().signIn("A", "a@gmail.com", "owner", "tools-a")
  expect(useMizan.getState().tools[0].name).toBe("A's tool")
  expect(useMizan.getState().tools.some((t) => t.id === "t1")).toBe(false)
})

it("defaults missing subscription fields in older account caches but preserves an explicitly empty list", () => {
  useMizan.getState().signIn("A", "a@gmail.com", "owner", "old-tools")
  const saved = JSON.parse(localStorage.getItem(accountStorageKey("old-tools"))!)
  delete saved.state.tools
  useMizan.getState().signOut()
  localStorage.setItem(accountStorageKey("old-tools"), JSON.stringify(saved))
  useMizan.getState().signIn("A", "a@gmail.com", "owner", "old-tools")
  expect(useMizan.getState().tools).toEqual([])
  useMizan.getState().tools.forEach((t) => useMizan.getState().removeTool(t.id))
  useMizan.getState().signOut()
  useMizan.getState().signIn("A", "a@gmail.com", "owner", "old-tools")
  expect(useMizan.getState().tools).toEqual([])
})

it("rejects invalid costs and date ranges atomically, and normalizes real date-only strings", () => {
  useMizan.getState().signIn("A", "a@gmail.com", "owner", "tool-validation")
  const before = useMizan.getState().tools
  for (const cost of [-1, Infinity, NaN]) {
    expect(() => useMizan.getState().addTool({ name: "Bad", cost, start: "", expiry: "" })).toThrow()
    expect(useMizan.getState().tools).toBe(before)
  }
  expect(() => useMizan.getState().addTool({ name: "Bad", cost: 0, start: "2026-10-13", expiry: "2026-10-12" })).toThrow()
  useMizan.getState().addTool({ name: "New", cost: 0, start: "12/10/2026", expiry: "12/11/2026" })
  expect(useMizan.getState().tools[0]).toMatchObject({ start: "2026-10-12", expiry: "2026-11-12", cost: 0 })
})

it.each(["31/02/2026", "29/02/2026", "2026-13-01", "2026-10-12T12:00:00Z", "09/20/2026"])("rejects a nonexistent or ambiguous subscription date %s", (date) => {
  expect(calendarDay(date)).toBeNull()
  expect(validDateRange("", date)).toBe(false)
})

it("calculates calendar days across DST/leap days instead of rounding elapsed hours", () => {
  expect(daysUntil("2026-03-09", "2026-03-08")).toBe(1)
  expect(daysUntil("2026-11-02", "2026-11-01")).toBe(1)
  expect(daysUntil("2024-03-01", "2024-02-28")).toBe(2)
  expect(daysUntil("12/10/2026", "2026-10-12")).toBe(0)
})

it("treats expiry as inclusive and distinguishes expired, active, future and invalid dates", () => {
  const tool = { id: "test", name: "Test", cost: 10, start: "", expiry: "2026-10-12" }
  expect(subscriptionStatus(tool, "2026-10-12")).toBe("active")
  expect(subscriptionStatus(tool, "2026-10-13")).toBe("expired")
  expect(subscriptionStatus({ ...tool, start: "2026-10-14", expiry: "" }, "2026-10-12")).toBe("scheduled")
  expect(subscriptionStatus({ ...tool, expiry: "31/02/2026" }, "2026-10-12")).toBe("unknown")
})

it("derives theoretical monthly totals from the saved ranges, including months spanning a year", () => {
  const trend = monthlySubscriptionCosts([
    { id: "1", name: "October", cost: 10, start: "2026-10-01", expiry: "2026-10-31" },
    { id: "2", name: "No dates", cost: 2, start: "", expiry: "" },
    { id: "3", name: "Future", cost: 50, start: "2026-11-01", expiry: "" },
  ], "2026-10-12", 2)
  expect(trend.values).toEqual([2, 12])
  expect(trend.labels).toHaveLength(2)
  const years = monthlySubscriptionCosts([], "2027-01-05", 2).labels
  expect(years[0]).toContain("26")
  expect(years[1]).toContain("27")
})

it("distinguishes empty required amounts from explicit zero, and enforces monetary and quantity bounds", () => {
  expect(parseAmount("")).toBeNull()
  expect(parseAmount("  ")).toBeNull()
  expect(parseAmount("", true)).toBe(0)
  expect(parseAmount("0")).toBe(0)
  expect(parseAmount("19.50")).toBe(19.5)
  expect(parseAmount("1e309")).toBeNull()
  expect(parseAmount(String(MAX_AMOUNT))).toBe(MAX_AMOUNT)
  expect(parseAmount(String(MAX_AMOUNT + 1))).toBeNull()
  expect(parseAmount(String(MAX_QUANTITY + 1), false, MAX_QUANTITY)).toBeNull()
})
