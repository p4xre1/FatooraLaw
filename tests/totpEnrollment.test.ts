import { describe, expect, it } from "vitest"
import {
  MIN_SETUP_KEY_LENGTH,
  formatSetupKey,
  isUsableSetupKey,
  normalizeSetupKey,
  qrImageDataUrl,
  secretFromUri,
} from "../src/admin/lib/totpEnrollment"

/**
 * Getting the AAL2 factor into Google Authenticator & co.
 *
 * GoTrue sends `qr_code` as raw SVG markup and `secret` as unpadded base32.
 * The two field failures: a QR the browser refuses to render (the old
 * `;utf-8` data-URL wrapper — `#` and quotes in the SVG also break an unencoded
 * one), and a setup key Google rejects with "the key value is too short" —
 * which is what a truncated/partial copy looks like.
 */

const SVG =
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="201" height="201">' +
  '<rect x="0" y="0" width="3" height="3" fill="#000000"/><!-- ü — non-Latin1 --><rect fill="#fff"/></svg>'

describe("the enrollment QR as a browser-safe image URL", () => {
  it("wraps GoTrue's raw SVG markup in a base64 data URL that survives #, quotes and newlines", () => {
    const src = qrImageDataUrl(SVG)
    expect(src.startsWith("data:image/svg+xml;base64,")).toBe(true)
    const decoded = Buffer.from(src.slice("data:image/svg+xml;base64,".length), "base64").toString("utf8")
    expect(decoded).toBe(SVG) // the exact markup — not a "#fragment" cut off at the first color
  })

  it("passes a ready-made data URL through untouched", () => {
    for (const url of ["data:image/png;base64,AAAA", "data:image/svg+xml;base64,BBBB"]) {
      expect(qrImageDataUrl(url)).toBe(url)
    }
    // Surrounding whitespace is presentation, not payload.
    expect(qrImageDataUrl("  " + SVG + "\n")).toBe(qrImageDataUrl(SVG))
  })
})

describe("the manual setup key", () => {
  it("normalizes the way authenticator apps store it", () => {
    expect(normalizeSetupKey(" jbsw y3dp ehpk 3pxp ")).toBe("JBSWY3DPEHPK3PXP")
    expect(normalizeSetupKey("JBSWY3DPEHPK3PXP====")).toBe("JBSWY3DPEHPK3PXP")
    expect(normalizeSetupKey("JBSWY3DP\nEHPK3PXP")).toBe("JBSWY3DPEHPK3PXP")
  })

  it("flags exactly the keys Google Authenticator refuses as too short", () => {
    expect(isUsableSetupKey("")).toBe(false)
    expect(isUsableSetupKey("JBSWY3DP")).toBe(false) // 8 chars → "key value is too short"
    expect(isUsableSetupKey("JBSWY3DPEHPK3PX")).toBe(false) // 15 chars: one under the floor
    expect(isUsableSetupKey("JBSWY3DPEHPK3PXP")).toBe(true) // 16 chars: what the apps accept
    expect(isUsableSetupKey("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP")).toBe(true) // 32: what GoTrue sends
    expect(isUsableSetupKey("jbsw y3dp ehpk 3pxp")).toBe(true) // spaces and case are presentation
    expect(isUsableSetupKey("JBSWY3DPEHPK3PX0")).toBe(false) // "0" is outside the base32 alphabet
    expect(isUsableSetupKey("not-a-setup-key!!")).toBe(false)
    expect(MIN_SETUP_KEY_LENGTH).toBe(16)
  })

  it("shows the key in readable groups of four", () => {
    expect(formatSetupKey("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP")
    expect(formatSetupKey("jbsw y3dp ehpk 3pxp jbsw y3dp")).toBe("JBSW Y3DP EHPK 3PXP JBSW Y3DP")
    expect(formatSetupKey("ABC")).toBe("ABC") // no trailing gap on a partial group
  })

  it("recovers the secret from the otpauth URI when the response omits it", () => {
    expect(secretFromUri("otpauth://totp/Fatorati:admin%40x.com?secret=JBSWY3DPEHPK3PXP&issuer=Fatorati"))
      .toBe("JBSWY3DPEHPK3PXP")
    expect(secretFromUri("otpauth://totp/x?secret=")).toBe("")
    expect(secretFromUri("not a uri")).toBe("")
    expect(secretFromUri("")).toBe("")
  })
})
