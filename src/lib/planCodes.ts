import {
  activationFor,
  type PlanActivation,
  type PlanCode,
  type PlanPeriod,
} from "./plans"

/**
 * Activation codes — how a paid account is unlocked today.
 *
 * The flow the owner asked for: the client pays by transfer (RIB) after a
 * WhatsApp conversation, and receives a code like `PRO-1M-3K7F9Q2Z` to type
 * into Paramètres. The code carries the plan and the period; the date it runs
 * to is computed when it is redeemed, so a code sent by mistake is harmless
 * until it is used.
 *
 * ⚠️ **This is a light gate, not a security boundary.** The check is an HMAC of
 * the code's own payload, and the key ships inside the bundle (it has to — there
 * is no server in this build and the app works offline). Anyone who reads the
 * bundle can mint a code, exactly as anyone could previously type a plan tier
 * into devtools. It stops typos, casual sharing and guessing; it does not stop a
 * determined user. Real entitlement is the ☁️ `account_subscriptions` table
 * that already exists in the migrations, and it is where this belongs once the
 * app is connected to Supabase: the server would hand out the plan and this
 * module would only format what it is told.
 *
 * `scripts/plan-code.mjs` mints codes offline for the owner; a test asserts the
 * two implementations agree, so the script cannot drift from the app.
 */

/** Must match `scripts/plan-code.mjs`. */
export const CODE_SECRET = "fatorati.plan.code.v1"

/** Crockford-style base32: no I, L, O or U, so a code cannot be misread. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

/** 8 characters = 40 bits: enough that guessing is hopeless, short enough to type. */
const CHECK_LENGTH = 8

/** The plans a code can unlock. FREE is never sold, so it is never coded. */
export const CODED_PLANS = ["pro", "boost"] as const
export type CodedPlan = (typeof CODED_PLANS)[number]

/** The periods a code can cover, as they are printed inside the code itself. */
export const CODED_PERIODS: readonly PlanPeriod[] = ["1M", "1Y"]

export const isCodedPlan = (value: string): value is CodedPlan =>
  (CODED_PLANS as readonly string[]).includes(value)

/**
 * The string the checksum covers — one place, so both sides agree.
 *
 * The plan is upper-cased here because that is how it is printed inside the
 * code: `normalizeCode` returns the printed form (`PRO-1M-…`), so the payload
 * must not depend on which side of the round trip built it.
 */
function payloadFor(plan: CodedPlan, period: PlanPeriod): string {
  return `fatorati:plan:v1:${plan.toUpperCase()}:${period}`
}

/** base32 of the first 40 bits of HMAC-SHA256(payload). */
async function checksumFor(plan: CodedPlan, period: PlanPeriod): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(CODE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  )
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payloadFor(plan, period))))
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

/** The code for a plan and a period — what the owner sends the client. */
export async function codeFor(plan: CodedPlan, period: PlanPeriod): Promise<string> {
  return `${plan.toUpperCase()}-${period}-${await checksumFor(plan, period)}`
}

/* --------------------------- per-client codes ---------------------------- */

/** Serials are 4 characters: about a million per plan/period, short to dictate. */
export const SERIAL_LENGTH = 4

/** A fresh serial. Minting happens in the CMS; verification never needs this. */
export function randomSerial(): string {
  const bytes = new Uint8Array(SERIAL_LENGTH)
  crypto.getRandomValues(bytes)
  // 256 is not a multiple of 32, so the last few letters are slightly favoured.
  // For a million-code space handed out one client at a time, that bias is
  // irrelevant; uniqueness is checked against the ledger, not hoped for.
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join("")
}

const SERIAL_PATTERN = new RegExp(`^[${ALPHABET}]{${SERIAL_LENGTH}}$`)

/**
 * The payload a per-client code checksums. Versioned (`v2`) so a code minted
 * before serials existed can never collide with one minted after.
 */
function serialPayloadFor(plan: CodedPlan, period: PlanPeriod, serial: string): string {
  return `fatorati:plan:v2:${plan.toUpperCase()}:${period}:${serial}`
}

async function serialChecksumFor(plan: CodedPlan, period: PlanPeriod, serial: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(CODE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  )
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(serialPayloadFor(plan, period, serial))))
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

/** A per-client code: `PRO-1M-K7Q2-BF6VSEZJ`. What the CMS builder hands out. */
export async function codeForSerial(plan: CodedPlan, period: PlanPeriod, serial: string): Promise<string> {
  return `${plan.toUpperCase()}-${period}-${serial}-${await serialChecksumFor(plan, period, serial)}`
}

/**
 * What the client typed → the canonical code, or null when it cannot be one.
 *
 * Tolerant on purpose: the code arrives over WhatsApp, so spaces around it, a
 * lower-case paste or a printer that drops the dashes must all still work. The
 * characters themselves are not guessed at (an `O` is not silently read as a
 * zero) — a code is copied, not transcribed from a screenshot.
 */
export function normalizeCode(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/[\s._]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  const parts = cleaned.split("-")
  // Three segments: a generic code. Four: a per-client code with its serial.
  if (parts.length !== 3 && parts.length !== 4) return null
  const [plan, period] = parts
  const serial = parts.length === 4 ? parts[2] : null
  const check = parts[parts.length - 1]
  if (!isCodedPlan(plan.toLowerCase())) return null
  if (!(CODED_PERIODS as readonly string[]).includes(period)) return null
  if (serial !== null && !SERIAL_PATTERN.test(serial)) return null
  if (check.length !== CHECK_LENGTH || ![...check].every((char) => ALPHABET.includes(char))) return null
  return serial ? `${plan}-${period}-${serial}-${check}` : `${plan}-${period}-${check}`
}

export type CodeCheck =
  | { ok: true; code: string; plan: CodedPlan; period: PlanPeriod; serial: string | null }
  | { ok: false; reason: "format" | "checksum" }

/** Verify a code without activating it: format first, then the checksum. */
export async function checkPlanCode(input: string): Promise<CodeCheck> {
  const code = normalizeCode(input)
  if (!code) return { ok: false, reason: "format" }
  const parts = code.split("-")
  const [printedPlan, printedPeriod] = parts
  const serial = parts.length === 4 ? parts[2] : null
  const check = parts[parts.length - 1]
  // `code` is what is printed (`PRO-1M-…`); `plan` is the vocabulary the rest
  // of the app uses (`pro`). Keeping the two apart here is what lets the payload
  // be built from either side of the round trip.
  const plan = printedPlan.toLowerCase() as CodedPlan
  const period = printedPeriod as PlanPeriod
  const expected = serial === null
    ? await checksumFor(plan, period)
    : await serialChecksumFor(plan, period, serial)
  if (check !== expected) return { ok: false, reason: "checksum" }
  return { ok: true, code, plan, period, serial }
}

export type RedeemResult =
  | { ok: true; activation: PlanActivation }
  | { ok: false; reason: "format" | "checksum" }

/** Verify a code and turn it into the window it buys (see `activationFor`). */
export async function redeemPlanCode(
  input: string,
  current: PlanActivation | null,
  today?: string,
): Promise<RedeemResult> {
  const check = await checkPlanCode(input)
  if (!check.ok) return { ok: false, reason: check.reason }
  return {
    ok: true,
    activation: activationFor(
      { code: check.code, plan: check.plan, period: check.period, serial: check.serial },
      current,
      today,
    ),
  }
}

/** The plan names a code can carry, for the owner's generator UI. */
export const CODED_PLAN_CODES: readonly Exclude<PlanCode, "free">[] = CODED_PLANS
