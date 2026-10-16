import { expect, it } from "vitest"
import { SUPPORT_LOOKUP_MIGRATION, supportLookupError } from "../src/admin/site/accountLookup"

/**
 * The operator's side of support access is only as good as its refusals.
 *
 * `support_lookup_account` refuses for half a dozen different reasons — wrong
 * role, no MFA, a misread reference, a reference belonging to somebody else, a
 * burst of requests, a migration that was never applied — and every one of them
 * has a different fix. A single "something went wrong" would leave the operator
 * re-typing a reference that was never going to resolve.
 *
 * These tests pin the distinction, and pin the wording of the two messages that
 * carry a real instruction: which file installs the server objects, and what to
 * do when the ticket's address does not match the account's.
 */

const refusals = [
  "support_lookup_unconfigured",
  "support_lookup_forbidden",
  "support_reveal_mfa_required",
  "support_lookup_rate_limited",
  "support_account_ref_malformed",
  "support_account_ref_conflict",
  "support_account_not_found",
  "support_request_not_found",
  "support_request_has_no_account",
  "support_lookup_input_required",
  "authentication_required",
]

it("names each server refusal in the operator's language, and never repeats one", () => {
  const messages = refusals.map((code) => supportLookupError(new Error(code)))
  for (const [index, message] of messages.entries()) {
    expect(message.trim(), refusals[index]).not.toBe("")
    expect(message, refusals[index]).not.toBe(refusals[index])
  }
  expect(new Set(messages).size).toBe(messages.length)
})

it("says which file installs the lookup when the functions are absent", () => {
  const message = supportLookupError(new Error('could not find the function public.support_lookup_account(p_ref, p_request_id) in the schema cache'))
  expect(message).toContain(SUPPORT_LOOKUP_MIGRATION)
})

it("turns a misread reference into an explanation, not a dead end", () => {
  const message = supportLookupError(new Error("support_account_ref_malformed"))
  expect(message).toContain("FT-XXXX-XXXX")
  // The letters the generator never emits are exactly the ones a human misreads.
  expect(message).toContain("I")
  expect(message).toContain("O")
})

it("warns rather than acts when the ticket and the account disagree", () => {
  const message = supportLookupError(new Error("support_account_ref_conflict"))
  expect(message).toContain("حساب")
  // It must send the operator back to verification, not on to a change.
  expect(message).toMatch(/تحقق/)
})

it("keeps an unmapped failure readable instead of swallowing it", () => {
  expect(supportLookupError(new Error("connection terminated unexpectedly"))).toBe("connection terminated unexpectedly")
  expect(supportLookupError(null)).toBe("تعذّر فحص الحساب. تحقق من الترحيل والصلاحيات.")
})
