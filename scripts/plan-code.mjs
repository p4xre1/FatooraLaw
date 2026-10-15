#!/usr/bin/env node
/**
 * Fatorati — activation-code generator (owner tool).
 *
 * The checkout is a WhatsApp conversation: the client pays by transfer, you mint
 * a code here and send it. The client types it into Paramètres and the plan runs
 * for a month or a year from the day it is redeemed.
 *
 *   node scripts/plan-code.mjs pro 1m            → one code
 *   node scripts/plan-code.mjs boost 1y -n 5     → five codes
 *   node scripts/plan-code.mjs --verify PRO-1M-XXXXXX
 *
 * The algorithm must match `src/lib/planCodes.ts`; `tests/planCodes.test.ts`
 * runs this script and feeds its output back through the app's verifier, so the
 * two cannot drift apart silently.
 */
import { webcrypto } from "node:crypto"

/** Must match `CODE_SECRET` in src/lib/planCodes.ts. */
const SECRET = "fatorati.plan.code.v1"
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const CHECK_LENGTH = 8
const PLANS = ["pro", "boost"]
const PERIODS = ["1M", "1Y"]

const usage = `
Usage: node scripts/plan-code.mjs <pro|boost> <1m|1y> [-n count]
       node scripts/plan-code.mjs --verify <CODE>

  pro 1m    PRO for one month       boost 1m  BOOST for one month
  pro 1y    PRO for one year        boost 1y  BOOST for one year
`

async function checksum(plan, period) {
  const encoder = new TextEncoder()
  const key = await webcrypto.subtle.importKey("raw", encoder.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  // The same payload `src/lib/planCodes.ts` checksums: printed plan, upper case.
  const payload = `fatorati:plan:v1:${plan.toUpperCase()}:${period}`
  const signature = new Uint8Array(await webcrypto.subtle.sign("HMAC", key, encoder.encode(payload)))
  let bits = 0
  let value = 0
  let out = ""
  for (const byte of signature) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
      if (out.length === CHECK_LENGTH) return out
    }
  }
  return out.padEnd(CHECK_LENGTH, ALPHABET[0])
}

const codeFor = async (plan, period) => `${plan.toUpperCase()}-${period}-${await checksum(plan, period)}`

const normalizedPlan = (value) => {
  const plan = String(value ?? "").toLowerCase()
  if (!PLANS.includes(plan)) {
    console.error(`Unknown plan "${value}". Use one of: ${PLANS.join(", ")}.${usage}`)
    process.exit(1)
  }
  return plan
}

const normalizedPeriod = (value) => {
  const period = String(value ?? "").toUpperCase()
  if (!PERIODS.includes(period)) {
    console.error(`Unknown period "${value}". Use 1m or 1y.${usage}`)
    process.exit(1)
  }
  return period
}

const args = process.argv.slice(2)

if (args[0] === "--verify" || args[0] === "-v") {
  const raw = (args[1] ?? "").trim().toUpperCase().replace(/\s+/g, "")
  const [plan, period, check] = raw.split("-")
  if (!PLANS.includes(String(plan).toLowerCase()) || !PERIODS.includes(period)) {
    console.log(`✗ ${raw || "(empty)"} — not a code this tool can produce.`)
    process.exit(1)
  }
  const expected = await codeFor(plan.toLowerCase(), period)
  const valid = check === expected.split("-")[2]
  console.log(valid ? `✓ ${expected} is valid (${plan} ${period}).` : `✗ ${check} does not match ${expected}.`)
  process.exit(valid ? 0 : 1)
}

const countIndex = args.findIndex((arg) => arg === "-n" || arg === "--count")
const count = countIndex === -1 ? 1 : Number(args[countIndex + 1])
const rest = args.filter((_, index) => index !== countIndex && (countIndex === -1 || index !== countIndex + 1))

if (!Number.isInteger(count) || count < 1 || count > 50) {
  console.error(`Count must be a whole number between 1 and 50.${usage}`)
  process.exit(1)
}
if (rest.length < 2) {
  console.error(usage)
  process.exit(1)
}

const plan = normalizedPlan(rest[0])
const period = normalizedPeriod(rest[1])
const label = `${period === "1M" ? "1 month" : "1 year"}`

console.log(`\n${plan.toUpperCase()} — ${label} (the window starts the day the client redeems it)\n`)
for (let index = 0; index < count; index += 1) console.log(`  ${await codeFor(plan, period)}`)
console.log(`\nSend a code by WhatsApp; the client enters it in Paramètres → Plan & activation.`)
console.log(`A code is tied to its plan and period, not to one client — see the note in src/lib/planCodes.ts.\n`)
