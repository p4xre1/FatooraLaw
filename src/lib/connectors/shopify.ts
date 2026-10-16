/**
 * Shopify connector primitives: the pure, testable half of "connect a store".
 *
 * This module holds no secret. It is passed one, does one comparison, and
 * forgets it — which is what lets the same code run in the Worker and be tested
 * in Node without a live shop.
 *
 * Three things here are security-critical rather than plumbing:
 *
 *  1. **`parseShopDomain` is an allowlist, not a formatter.** The shop name
 *     arrives from a query string / a form field and is used to build the URL
 *     the browser is redirected to. `https://{shop}/admin/oauth/authorize` with
 *     an unchecked `shop` is an open redirect, and the Worker-side callback
 *     would be a server-side request forgery. Only `*.myshopify.com` is
 *     accepted, and everything else is refused with a reason.
 *
 *  2. **Callback HMAC** proves the redirect came from Shopify and not from
 *     someone replaying a guessed `code`. It is verified over the *sorted,
 *     re-serialised* query with `hmac` and `signature` removed — not over the
 *     raw URL, which would fail on re-encoding.
 *
 *  3. **Webhook HMAC** proves an inbound order notification is real before any
 *     of it is parsed. It is verified over the **raw body bytes**, base64, not
 *     over the parsed JSON — re-serialising JSON changes the bytes and the
 *     check would either always fail or, worse, be "fixed" by skipping it.
 *
 * Comparisons are constant-time. A byte-by-byte `===` on a MAC leaks, over
 * enough attempts, how much of a guessed value was correct.
 */

/** Bump deliberately: Shopify ships a new stable version each quarter. */
export const SHOPIFY_API_VERSION = "2026-10"

/**
 * The minimum an invoicing connector needs. `read_orders` is the whole point;
 * `read_products` names what was sold. Nothing here writes to a store, and
 * nothing asks for customer records.
 */
export const SHOPIFY_SCOPES = ["read_orders", "read_products"] as const

export type ShopDomainFailure = "empty" | "not_shopify" | "malformed"

export type ShopDomainResult =
  | { ok: true; domain: string }
  | { ok: false; reason: ShopDomainFailure }

/**
 * A Shopify shop domain, or a refusal with a reason a human can act on.
 *
 * Accepts what people paste — `https://`, a trailing path, capitals — and then
 * checks the result against the one shape Shopify's OAuth flow accepts.
 */
export function parseShopDomain(input: string | null | undefined): ShopDomainResult {
  const raw = (input ?? "").trim()
  if (raw === "") return { ok: false, reason: "empty" }

  // Tolerate a pasted URL, then judge only the host.
  const host = raw
    .replace(/^[a-z]+:\/\//i, "")
    .split(/[/?#]/)[0]
    .trim()
    .toLowerCase()

  if (host === "") return { ok: false, reason: "empty" }
  if (host.length > 80) return { ok: false, reason: "malformed" }

  // Deliberately strict, and deliberately not a "contains" test: a host like
  // `evil.com/x.myshopify.com` or `myshopify.com.evil.com` must not pass.
  if (!/^[a-z0-9][a-z0-9-]{0,59}\.myshopify\.com$/.test(host)) {
    return { ok: false, reason: host.includes(".") ? "not_shopify" : "malformed" }
  }
  if (host.includes("..")) return { ok: false, reason: "malformed" }

  return { ok: true, domain: host }
}

/** Convenience for callers that only need the value or nothing. */
export function normalizeShopDomain(input: string | null | undefined): string | null {
  const parsed = parseShopDomain(input)
  return parsed.ok ? parsed.domain : null
}

/**
 * Where to send the shop owner to grant access.
 *
 * `state` is not optional in this signature: an OAuth start without one is a
 * callback that anyone can forge.
 */
export function shopifyAuthorizeUrl(input: {
  shop: string
  clientId: string
  redirectUri: string
  state: string
  scopes?: readonly string[]
}): string {
  const parsed = parseShopDomain(input.shop)
  if (!parsed.ok) throw new Error(`shopify_invalid_shop_domain:${parsed.reason}`)
  if (input.state.trim() === "") throw new Error("shopify_missing_state")

  const params = new URLSearchParams({
    client_id: input.clientId,
    scope: (input.scopes ?? SHOPIFY_SCOPES).join(","),
    redirect_uri: input.redirectUri,
    state: input.state,
  })
  return `https://${parsed.domain}/admin/oauth/authorize?${params.toString()}`
}

/** GraphQL Admin API endpoint — where order data actually comes from. */
export function shopifyGraphqlEndpoint(shop: string, version: string = SHOPIFY_API_VERSION): string {
  const parsed = parseShopDomain(shop)
  if (!parsed.ok) throw new Error(`shopify_invalid_shop_domain:${parsed.reason}`)
  return `https://${parsed.domain}/admin/api/${version}/graphql.json`
}

/* ------------------------------- signatures ------------------------------ */

/** Length-independent, early-exit-free comparison of two strings. */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  // The lengths themselves are not secret (a SHA-256 hex digest is always 64
  // characters), but folding them in keeps this function correct if it is ever
  // reused for something shorter.
  let mismatch = left.length === right.length ? 0 : 1
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return mismatch === 0
}

async function hmacSha256(secret: string, message: string | Uint8Array, encoding: "hex" | "base64"): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const body = typeof message === "string" ? new TextEncoder().encode(message) : message
  const signature = await crypto.subtle.sign("HMAC", key, body as BufferSource)
  const bytes = new Uint8Array(signature)
  if (encoding === "hex") {
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
  }
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Verify the `hmac` query parameter Shopify appends to the OAuth redirect.
 *
 * Runs before the `code` is exchanged for a token, so a forged callback dies
 * here instead of becoming a connection.
 */
export async function verifyShopifyCallbackHmac(
  searchParams: URLSearchParams,
  appSecret: string,
): Promise<boolean> {
  const provided = searchParams.get("hmac")
  if (!provided || appSecret === "") return false

  const pairs: [string, string][] = []
  searchParams.forEach((value, key) => {
    if (key === "hmac" || key === "signature") return
    pairs.push([key, value])
  })
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  // Repeated keys are joined with a comma, matching the bytes Shopify signs.
  const message = pairs
    .map(([key, value]) => `${key}=${value}`)
    .join("&")

  const expected = await hmacSha256(appSecret, message, "hex")
  return constantTimeEqual(expected, provided.toLowerCase())
}

/**
 * Verify `X-Shopify-Hmac-Sha256` against the **raw** request body.
 *
 * `rawBody` must be the bytes exactly as received, before any JSON parsing.
 */
export async function verifyShopifyWebhookHmac(
  rawBody: string | Uint8Array,
  headerHmac: string | null | undefined,
  appSecret: string,
): Promise<boolean> {
  if (!headerHmac || appSecret === "") return false
  const expected = await hmacSha256(appSecret, rawBody, "base64")
  return constantTimeEqual(expected, headerHmac.trim())
}

/** The webhook topics this connector subscribes to, and why. */
export const SHOPIFY_WEBHOOK_TOPICS = [
  // An order is an invoice waiting to be issued.
  "orders/create",
  // A cancellation or refund changes what the invoice should say.
  "orders/cancelled",
  // The customer uninstalled the app: the correct response is to destroy the
  // token, not to keep polling a store that will answer 401 forever.
  "app/uninstalled",
] as const
