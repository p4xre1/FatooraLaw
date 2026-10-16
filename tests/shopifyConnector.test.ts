import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  constantTimeEqual,
  normalizeShopDomain,
  parseShopDomain,
  shopifyAuthorizeUrl,
  shopifyGraphqlEndpoint,
  verifyShopifyCallbackHmac,
  verifyShopifyWebhookHmac,
} from "../src/lib/connectors/shopify"

/**
 * The Shopify connector's security-critical half.
 *
 * Two checks here stand between a customer's store and somebody else's: the
 * shop domain that decides which host Fatorati talks to, and the two HMACs that
 * decide whether a message really came from Shopify. Both are the kind of code
 * that looks obviously correct and fails quietly, so each refusal is a test.
 */

const SECRET = "shpss_a_shopify_app_client_secret"

describe("the shop domain allowlist", () => {
  it("accepts a real shop domain, however it was pasted", () => {
    for (const input of [
      "atlasbtp.myshopify.com",
      "  AtlasBTP.myshopify.com  ",
      "https://atlasbtp.myshopify.com",
      "https://atlasbtp.myshopify.com/admin/orders",
      "http://atlasbtp.myshopify.com?foo=bar",
    ]) {
      expect(parseShopDomain(input), input).toEqual({ ok: true, domain: "atlasbtp.myshopify.com" })
    }
  })

  it("refuses anything that could send a request somewhere else", () => {
    // The reason matters: `not_shopify` is a customer using their own domain,
    // `malformed` is a typo. They get different sentences in the UI.
    expect(parseShopDomain("evil.com")).toEqual({ ok: false, reason: "not_shopify" })
    expect(parseShopDomain("atlasbtp.myshopify.com.evil.com")).toEqual({ ok: false, reason: "not_shopify" })
    expect(parseShopDomain("evil.com/atlasbtp.myshopify.com")).toEqual({ ok: false, reason: "not_shopify" })
    expect(parseShopDomain("atlasbtp.myshopify.com.attacker.net")).toEqual({ ok: false, reason: "not_shopify" })
    expect(parseShopDomain("")).toEqual({ ok: false, reason: "empty" })
    expect(parseShopDomain(null)).toEqual({ ok: false, reason: "empty" })
    expect(parseShopDomain("not a domain at all")).toEqual({ ok: false, reason: "malformed" })
    expect(parseShopDomain("-leading.myshopify.com")).toEqual({ ok: false, reason: "not_shopify" })
  })

  it("never returns a value for anything it would not build a URL from", () => {
    expect(normalizeShopDomain("evil.com")).toBeNull()
    expect(normalizeShopDomain("shop.myshopify.com")).toBe("shop.myshopify.com")
  })

  it("refuses to build an authorize URL it cannot trust, and one with no state", () => {
    expect(() =>
      shopifyAuthorizeUrl({ shop: "evil.com", clientId: "c", redirectUri: "https://x/cb", state: "s" }),
    ).toThrowError(/shopify_invalid_shop_domain:not_shopify/)

    // An OAuth start with no state is a callback anyone can forge.
    expect(() =>
      shopifyAuthorizeUrl({ shop: "atlasbtp.myshopify.com", clientId: "c", redirectUri: "https://x/cb", state: "  " }),
    ).toThrowError(/shopify_missing_state/)
  })

  it("builds the authorize URL on the store's own host, with the minimum scopes", () => {
    const url = new URL(
      shopifyAuthorizeUrl({
        shop: "atlasbtp.myshopify.com",
        clientId: "client-123",
        redirectUri: "https://api.fatorati.tech/connectors/shopify/callback",
        state: "state-value",
      }),
    )
    expect(url.origin).toBe("https://atlasbtp.myshopify.com")
    expect(url.pathname).toBe("/admin/oauth/authorize")
    expect(url.searchParams.get("client_id")).toBe("client-123")
    expect(url.searchParams.get("state")).toBe("state-value")
    // Reading orders and products. Not customers, not writes.
    expect(url.searchParams.get("scope")).toBe("read_orders,read_products")
  })

  it("points the Admin API at the same validated host", () => {
    expect(shopifyGraphqlEndpoint("atlasbtp.myshopify.com")).toBe(
      "https://atlasbtp.myshopify.com/admin/api/2026-10/graphql.json",
    )
    expect(() => shopifyGraphqlEndpoint("evil.com")).toThrowError(/shopify_invalid_shop_domain/)
  })
})

describe("the OAuth callback signature", () => {
  /** Sign exactly as Shopify does: sorted, `hmac`/`signature` removed, joined with &. */
  const signCallback = (params: Record<string, string>) => {
    const message = Object.keys(params)
      .filter((key) => key !== "hmac" && key !== "signature")
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&")
    return createHmac("sha256", SECRET).update(message).digest("hex")
  }

  const genuine = {
    code: "authorization-code",
    host: "YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvYXRsYXNidHA=",
    shop: "atlasbtp.myshopify.com",
    state: "state-value",
    timestamp: "1776000000",
  }

  it("accepts a redirect Shopify really signed", async () => {
    const params = new URLSearchParams({ ...genuine, hmac: signCallback(genuine) })
    await expect(verifyShopifyCallbackHmac(params, SECRET)).resolves.toBe(true)
  })

  it("rejects a tampered parameter, even though the code looks right", async () => {
    const params = new URLSearchParams({ ...genuine, hmac: signCallback(genuine) })
    // Same signature, different shop: the classic attack — replay a real
    // callback against a store the attacker controls.
    params.set("shop", "attacker.myshopify.com")
    await expect(verifyShopifyCallbackHmac(params, SECRET)).resolves.toBe(false)
  })

  it("rejects a signature made with a different app secret", async () => {
    const params = new URLSearchParams({ ...genuine, hmac: signCallback(genuine) })
    await expect(verifyShopifyCallbackHmac(params, "shpss_wrong_secret")).resolves.toBe(false)
  })

  it("rejects a callback with no signature at all", async () => {
    await expect(verifyShopifyCallbackHmac(new URLSearchParams(genuine), SECRET)).resolves.toBe(false)
    await expect(verifyShopifyCallbackHmac(new URLSearchParams({ ...genuine, hmac: "" }), SECRET)).resolves.toBe(false)
    await expect(verifyShopifyCallbackHmac(new URLSearchParams(genuine), "")).resolves.toBe(false)
  })

  it("does not sign the hmac it already has, so re-serialisation cannot fail the check", async () => {
    // `signature` is the legacy parameter Shopify may also send. It is excluded
    // from the signed message; leaving it in would reject genuine callbacks.
    const params = new URLSearchParams({ ...genuine, hmac: signCallback(genuine), signature: "legacy-value" })
    await expect(verifyShopifyCallbackHmac(params, SECRET)).resolves.toBe(true)
  })
})

describe("the webhook signature", () => {
  const body = JSON.stringify({ id: 8123456, total_price: "1240.00", currency: "MAD" })
  const signedHeader = createHmac("sha256", SECRET).update(body).digest("base64")

  it("accepts a body Shopify really signed, on the exact bytes received", async () => {
    await expect(verifyShopifyWebhookHmac(body, signedHeader, SECRET)).resolves.toBe(true)
  })

  it("rejects a body that was altered in transit", async () => {
    const tampered = body.replace("1240.00", "12.00")
    await expect(verifyShopifyWebhookHmac(tampered, signedHeader, SECRET)).resolves.toBe(false)
  })

  it("rejects a re-serialised body, which is why the raw bytes are required", async () => {
    // Same data, different bytes. A handler that parsed first and re-encoded
    // would fail here — or would be "fixed" by removing the check.
    const reordered = JSON.stringify({ currency: "MAD", id: 8123456, total_price: "1240.00" })
    await expect(verifyShopifyWebhookHmac(reordered, signedHeader, SECRET)).resolves.toBe(false)
  })

  it("rejects a missing header or a missing secret instead of assuming", async () => {
    await expect(verifyShopifyWebhookHmac(body, null, SECRET)).resolves.toBe(false)
    await expect(verifyShopifyWebhookHmac(body, "", SECRET)).resolves.toBe(false)
    await expect(verifyShopifyWebhookHmac(body, signedHeader, "")).resolves.toBe(false)
  })
})

describe("constant-time comparison", () => {
  it("agrees with equality and disagrees with everything else", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true)
    expect(constantTimeEqual("abc", "abd")).toBe(false)
    expect(constantTimeEqual("abc", "abcd")).toBe(false)
    expect(constantTimeEqual("", "")).toBe(true)
    expect(constantTimeEqual("", "a")).toBe(false)
  })
})
