import { beforeEach, describe, expect, it } from "vitest"
import { planStorageKey, usePlan } from "../src/store/usePlan"
import { planStatus } from "../src/lib/plans"
import { codeFor } from "../src/lib/planCodes"

/**
 * The per-account plan store.
 *
 * Two properties matter and both are pinned here: a code belongs to the account
 * that redeemed it (never to the browser, never to the next account that signs
 * in on the same machine), and a refused code writes nothing at all.
 */

beforeEach(() => {
  localStorage.clear()
  usePlan.getState().forAccount(null)
  usePlan.getState().clear()
  localStorage.clear()
})

describe("account scoping", () => {
  it("keeps each account's activation in its own storage key", async () => {
    usePlan.getState().forAccount("account-a")
    const result = await usePlan.getState().redeem(await codeFor("pro", "1M"), "2026-03-10")
    expect(result.ok).toBe(true)
    expect(usePlan.getState().activation?.plan).toBe("pro")

    // Another account on the same browser starts on FREE.
    usePlan.getState().forAccount("account-b")
    expect(usePlan.getState().activation).toBeNull()

    // And the first account's window is still there when it comes back.
    usePlan.getState().forAccount("account-a")
    expect(usePlan.getState().activation?.plan).toBe("pro")
    expect(usePlan.getState().activation?.expiresAt).toBe("2026-04-10")

    const storedA = JSON.parse(localStorage.getItem(planStorageKey("account-a"))!)
    expect(storedA.state.activation.plan).toBe("pro")
    // Nothing was ever written under B's key — no record *is* the FREE state.
    expect(localStorage.getItem(planStorageKey("account-b"))).toBeNull()
  })

  it("drops the activation from memory on sign-out without deleting it", async () => {
    usePlan.getState().forAccount("account-a")
    await usePlan.getState().redeem(await codeFor("boost", "1Y"), "2026-03-10")

    usePlan.getState().forAccount(null)
    expect(usePlan.getState().activation).toBeNull()

    usePlan.getState().forAccount("account-a")
    expect(usePlan.getState().activation?.plan).toBe("boost")
  })

  it("is a no-op when pointed twice at the same account", async () => {
    usePlan.getState().forAccount("account-a")
    await usePlan.getState().redeem(await codeFor("pro", "1M"), "2026-03-10")
    const before = usePlan.getState().activation
    usePlan.getState().forAccount("account-a")
    expect(usePlan.getState().activation).toBe(before)
  })
})

describe("redeeming through the store", () => {
  it("writes nothing for a code that does not verify", async () => {
    usePlan.getState().forAccount("account-a")
    const result = await usePlan.getState().redeem("PRO-1M-AAAAAAAA", "2026-03-10")
    expect(result.ok).toBe(false)
    expect(usePlan.getState().activation).toBeNull()
  })

  it("extends a running window when the same plan is redeemed again", async () => {
    usePlan.getState().forAccount("account-a")
    await usePlan.getState().redeem(await codeFor("pro", "1M"), "2026-03-10")
    await usePlan.getState().redeem(await codeFor("pro", "1M"), "2026-03-25")
    expect(usePlan.getState().activation?.expiresAt).toBe("2026-05-10")
  })

  it("falls back to FREE by itself once the window closes", async () => {
    usePlan.getState().forAccount("account-a")
    await usePlan.getState().redeem(await codeFor("pro", "1M"), "2026-03-10")
    const activation = usePlan.getState().activation
    expect(planStatus(activation, "2026-04-10").plan).toBe("pro")
    expect(planStatus(activation, "2026-04-11").plan).toBe("free")
    expect(planStatus(activation, "2026-04-11").state).toBe("expired")
  })

  it("clear() forgets the activation (the support path)", async () => {
    usePlan.getState().forAccount("account-a")
    await usePlan.getState().redeem(await codeFor("pro", "1M"), "2026-03-10")
    usePlan.getState().clear()
    expect(usePlan.getState().activation).toBeNull()
  })
})
