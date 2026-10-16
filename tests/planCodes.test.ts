import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { activationKeyHash, checkPlanCode, codeFor, normalizeCode, randomActivationKey, redeemPlanCode } from "../src/lib/planCodes"
import { PLAN_SALES_WHATSAPP, planPurchaseLink, PLANS } from "../src/lib/plans"

/**
 * The activation codes the owner sends over WhatsApp after a transfer.
 *
 * Two things matter here and both are tested below: a code must not be
 * mistypable (the alphabet, the checksum, the normalisation) and the window it
 * buys must be the one `lib/plans.ts` computes — including the case where the
 * client redeems a second code while the first is still running.
 *
 * The generator in `scripts/plan-code.mjs` is run for real and its output fed
 * back through the app's verifier: the script the owner uses and the code the
 * app accepts are one algorithm, not two that happen to agree today.
 */

const run = (args: string[]) =>
  execFileSync("node", [resolve(process.cwd(), "scripts/plan-code.mjs"), ...args], { encoding: "utf8" })

/** The codes printed by the generator, without the banner around them. */
const codesIn = (output: string) => output.match(/\b(?:PRO|BOOST)-(?:1M|1Y)-[0-9A-Z]{8}\b/g) ?? []

describe("server-backed single-use activation keys", () => {
  it("creates opaque, high-entropy keys and a stable normalized SHA-256 digest", async () => {
    const first = randomActivationKey("pro", "1M")
    const second = randomActivationKey("pro", "1M")
    expect(first).toMatch(/^PRO-1M-[A-Z2-9]{20}$/)
    expect(first.split("-")[2]).not.toMatch(/[ILOU]/)
    expect(second).not.toBe(first)
    expect(await activationKeyHash(first)).toMatch(/^[0-9a-f]{64}$/)
    expect(await activationKeyHash(first)).toBe(await activationKeyHash(first.toLowerCase().replace(/-/g, " ")))
    expect(await activationKeyHash(first)).not.toBe(await activationKeyHash(second))
  })
})

describe("the code format", () => {
  it("carries the plan and the period, and a checksum that depends on both", async () => {
    const pro1m = await codeFor("pro", "1M")
    const pro1y = await codeFor("pro", "1Y")
    const boost1m = await codeFor("boost", "1M")

    expect(pro1m).toMatch(/^PRO-1M-[0-9A-Z]{8}$/)
    expect(pro1y).toMatch(/^PRO-1Y-[0-9A-Z]{8}$/)
    expect(boost1m).toMatch(/^BOOST-1M-[0-9A-Z]{8}$/)
    // The checksum covers the payload, so no two payloads share one.
    expect(new Set([pro1m, pro1y, boost1m]).size).toBe(3)

    // Deterministic: the owner can re-mint the code they already sent.
    expect(await codeFor("pro", "1M")).toBe(pro1m)
  })

  it("never prints a character that can be misread", async () => {
    for (const plan of ["pro", "boost"] as const) {
      for (const period of ["1M", "1Y"] as const) {
        const check = (await codeFor(plan, period)).split("-")[2]
        // I, L, O and U are out: they are what a hurried reader turns into 1/0.
        expect(check).not.toMatch(/[ILOU]/)
      }
    }
  })

  it("accepts what a phone keyboard or WhatsApp does to a pasted code", async () => {
    const code = await codeFor("boost", "1Y")

    expect(normalizeCode(code.toLowerCase())).toBe(code)
    expect(normalizeCode(`  ${code}  `)).toBe(code)
    expect(normalizeCode(code.replace(/-/g, " "))).toBe(code)
    expect(normalizeCode(code.replace(/-/g, ""))).toBeNull() // no dashes to split on: not guessed at
    expect(await checkPlanCode(` ${code.toLowerCase()} `)).toMatchObject({ ok: true, plan: "boost", period: "1Y" })
  })

  it("rejects a code whose shape or checksum is wrong, with a reason for each", async () => {
    const code = await codeFor("pro", "1M")
    const tampered = `PRO-1M-${code.slice(-8).replace(/[0-9]/, (d) => (d === "9" ? "8" : String(Number(d) + 1)))}`

    expect(await checkPlanCode("")).toMatchObject({ ok: false, reason: "format" })
    expect(await checkPlanCode("BONJOUR")).toMatchObject({ ok: false, reason: "format" })
    // A real plan and period with a checksum that does not match them: this is
    // the case that matters, because the shape alone looks convincing.
    expect(await checkPlanCode(tampered)).toMatchObject({ ok: false, reason: "checksum" })
    expect(await checkPlanCode("PRO-1M-A1B2C3D")).toMatchObject({ ok: false, reason: "format" })
    // FREE is never sold, so it is never a code.
    expect(await checkPlanCode("FREE-1Y-A1B2C3D4")).toMatchObject({ ok: false, reason: "format" })
  })
})

describe("redeeming", () => {
  it("runs from the day it is redeemed, for the period printed in the code", async () => {
    const month = await redeemPlanCode(await codeFor("pro", "1M"), null, "2026-03-10")
    const year = await redeemPlanCode(await codeFor("boost", "1Y"), null, "2026-03-10")

    expect(month).toMatchObject({ ok: true, activation: { plan: "pro", period: "1M", startedAt: "2026-03-10", expiresAt: "2026-04-10" } })
    expect(year).toMatchObject({ ok: true, activation: { plan: "boost", period: "1Y", startedAt: "2026-03-10", expiresAt: "2027-03-10" } })
  })

  it("extends a plan that is still running instead of restarting it", async () => {
    const first = await redeemPlanCode(await codeFor("pro", "1M"), null, "2026-03-10")
    expect(first.ok).toBe(true)
    const second = await redeemPlanCode(await codeFor("pro", "1M"), first.ok ? first.activation : null, "2026-03-20")

    // 10 days used, 20 left: two months of PRO, not one month from the 20th.
    expect(second).toMatchObject({ ok: true, activation: { startedAt: "2026-03-10", expiresAt: "2026-05-10" } })
  })

  it("starts a fresh window when the code is for another plan, or when the old one lapsed", async () => {
    const pro = await redeemPlanCode(await codeFor("pro", "1M"), null, "2026-03-10")
    const upgrade = await redeemPlanCode(await codeFor("boost", "1Y"), pro.ok ? pro.activation : null, "2026-03-20")
    expect(upgrade).toMatchObject({ ok: true, activation: { plan: "boost", startedAt: "2026-03-20", expiresAt: "2027-03-20" } })

    // Same plan, but the previous window is over: it runs from today again.
    const again = await redeemPlanCode(await codeFor("pro", "1M"), pro.ok ? pro.activation : null, "2026-06-01")
    expect(again).toMatchObject({ ok: true, activation: { startedAt: "2026-06-01", expiresAt: "2026-07-01" } })
  })

  it("says no without writing an activation", async () => {
    const result = await redeemPlanCode("PRO-1M-AAAAAAAA", null, "2026-03-10")
    expect(result.ok).toBe(false)
  })
})

describe("the generator the owner runs", () => {
  it("prints codes the app accepts, for the plan and period that were asked for", () => {
    const [proMonth] = codesIn(run(["pro", "1m"]))
    const [boostYear] = codesIn(run(["boost", "1y", "-n", "1"]))

    expect(proMonth).toMatch(/^PRO-1M-/)
    expect(boostYear).toMatch(/^BOOST-1Y-/)
    // Same code as `codeFor`, which is what makes the two files one algorithm.
    return Promise.all([codeFor("pro", "1M"), codeFor("boost", "1Y")]).then(([expectedPro, expectedBoost]) => {
      expect(proMonth).toBe(expectedPro)
      expect(boostYear).toBe(expectedBoost)
    })
  })

  it("verifies a code back (the check the owner makes before re-sending one)", () => {
    const [code] = codesIn(run(["pro", "1m"]))
    expect(code).toBeDefined()
    expect(run(["--verify", code!])).toContain("is valid")
  })

  it("refuses anything that is not a plan and a period", () => {
    expect(() => run(["premium", "1m"])).toThrow()
  })
})

describe("buying", () => {
  it("opens WhatsApp with the sales number and what is being bought", () => {
    const link = planPurchaseLink("pro", "Atlas BTP")
    expect(link).toContain(`wa.me/${PLAN_SALES_WHATSAPP}`)
    expect(decodeURIComponent(link)).toContain("Atlas BTP")
    expect(decodeURIComponent(link)).toContain("PRO")
    // Both periods, each with its price, and every price read from the plan
    // table: the message can never quote a price the app does not publish.
    expect(decodeURIComponent(link)).toContain("1 mois")
    expect(decodeURIComponent(link)).toContain("1 an")
    expect(decodeURIComponent(link)).toContain(`${PLANS.pro.monthlyPrice} MAD`)
    expect(decodeURIComponent(link)).toContain(`${PLANS.pro.yearlyPrice} MAD`)
  })
})

describe("per-client codes (what the CMS mints)", () => {
  it("carries the serial between the period and the checksum", async () => {
    const { codeForSerial, randomSerial } = await import("../src/lib/planCodes")
    const code = await codeForSerial("pro", "1M", "K7Q2")

    expect(code).toMatch(/^PRO-1M-K7Q2-[0-9A-Z]{8}$/)
    expect(await checkPlanCode(code)).toMatchObject({ ok: true, plan: "pro", period: "1M", serial: "K7Q2" })
    expect(await checkPlanCode(code.toLowerCase())).toMatchObject({ ok: true, serial: "K7Q2" })

    // A different serial is a different code — and the first one does not
    // verify for the second client.
    const other = await codeForSerial("pro", "1M", "M4X8")
    expect(other).not.toBe(code)
    expect(await checkPlanCode(`PRO-1M-M4X8-${code.split("-")[3]}`)).toMatchObject({ ok: false, reason: "checksum" })

    expect(randomSerial()).toMatch(/^[0-9A-Z]{4}$/)
    const drawn = new Set(Array.from({ length: 50 }, () => randomSerial()))
    expect(drawn.size).toBeGreaterThan(45)
  })

  it("puts the serial on the activation it redeems into", async () => {
    const { codeForSerial } = await import("../src/lib/planCodes")
    const result = await redeemPlanCode(await codeForSerial("boost", "1Y", "Z3N6"), null, "2026-03-10")
    expect(result).toMatchObject({ ok: true, activation: { plan: "boost", serial: "Z3N6", expiresAt: "2027-03-10" } })

    // A generic code has no serial: nothing for the CMS to hold on to.
    const generic = await redeemPlanCode(await codeFor("pro", "1M"), null, "2026-03-10")
    expect(generic).toMatchObject({ ok: true, activation: { serial: null } })
  })

  it("refuses a malformed serial instead of guessing at it", async () => {
    expect(normalizeCode("PRO-1M-K7Q-BF6VSEZJ")).toBeNull() // 3-char serial
    expect(normalizeCode("PRO-1M-K7Q2")).toBeNull() // checksum missing
    expect(await checkPlanCode("PRO-1M-K7Q2-AAAAAAAA")).toMatchObject({ ok: false, reason: "checksum" })
  })
})
