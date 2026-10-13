import { act, renderHook } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { COOKIE_CONSENT_KEY, readCookieConsent, useMarketingAnalytics, writeCookieConsent } from "../src/lib/cookieConsent"
import { GOOGLE_ANALYTICS_ID } from "../src/lib/site"

beforeEach(() => {
  document.getElementById("fatorati-google-analytics")?.remove()
  delete window.gtag
  delete window.dataLayer
  localStorage.clear()
})

it.each([null, "declined"])("does not load Google scripts before consent (%s)", (value) => {
  if (value) localStorage.setItem(COOKIE_CONSENT_KEY, value)
  renderHook(() => useMarketingAnalytics())
  expect(document.getElementById("fatorati-google-analytics")).toBeNull()
  expect(window.dataLayer).toBeUndefined()
})

it("loads analytics once after acceptance, and disables it on a changed choice", () => {
  renderHook(() => useMarketingAnalytics())
  act(() => writeCookieConsent("accepted"))
  expect(document.querySelectorAll("#fatorati-google-analytics")).toHaveLength(1)
  expect(window.dataLayer?.some((entry) => entry[0] === "config" && entry[1] === GOOGLE_ANALYTICS_ID)).toBe(true)
  act(() => writeCookieConsent("accepted"))
  expect(document.querySelectorAll("#fatorati-google-analytics")).toHaveLength(1)
  act(() => writeCookieConsent("declined"))
  expect((window as unknown as Record<string, unknown>)[`ga-disable-${GOOGLE_ANALYTICS_ID}`]).toBe(true)
})

it("treats invalid or unavailable storage as no consent", () => {
  localStorage.setItem(COOKIE_CONSENT_KEY, "invalid")
  expect(readCookieConsent()).toBeNull()
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("disabled") })
  expect(readCookieConsent()).toBeNull()
  renderHook(() => useMarketingAnalytics())
  expect(document.getElementById("fatorati-google-analytics")).toBeNull()
})
