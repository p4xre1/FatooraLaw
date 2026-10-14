import { useEffect } from "react"
import { GOOGLE_ANALYTICS_ID } from "./site"

export type CookieConsent = "accepted" | "declined" | null
export const COOKIE_CONSENT_KEY = "fatorati-cookie-consent"
export const COOKIE_CONSENT_EVENT = "fatorati:cookie-consent"
const ANALYTICS_SCRIPT_ID = "fatorati-google-analytics"

export function readCookieConsent(): CookieConsent {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_KEY)
    return value === "accepted" || value === "declined" ? value : null
  } catch { return null }
}

export function writeCookieConsent(value: Exclude<CookieConsent, null>) {
  try { localStorage.setItem(COOKIE_CONSENT_KEY, value) } catch { /* Keep the choice for this page even if storage is disabled. */ }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }))
}

declare global {
  interface Window {
    dataLayer?: unknown[][]
    gtag?: (...args: unknown[]) => void
  }
}

function applyAnalyticsConsent(value: CookieConsent) {
  if (!GOOGLE_ANALYTICS_ID) return
  const accepted = value === "accepted"
  ;(window as unknown as Record<string, unknown>)[`ga-disable-${GOOGLE_ANALYTICS_ID}`] = !accepted
  if (!accepted) {
    window.gtag?.("consent", "update", { analytics_storage: "denied", ad_storage: "denied" })
    return // No Google request or script before consent, including a declined choice.
  }
  window.dataLayer ??= []
  window.gtag ??= (...args: unknown[]) => { window.dataLayer!.push(args) }
  window.gtag("consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" })
  if (document.getElementById(ANALYTICS_SCRIPT_ID)) return
  window.gtag("js", new Date())
  window.gtag("config", GOOGLE_ANALYTICS_ID, { allow_google_signals: false, allow_ad_personalization_signals: false })
  const script = document.createElement("script")
  script.id = ANALYTICS_SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`
  document.head.appendChild(script)
}

/** Client-side consent controls both the initial load and cross-tab changes. */
export function useMarketingAnalytics() {
  useEffect(() => {
    applyAnalyticsConsent(readCookieConsent())
    function onChoice(event: Event) {
      const value: unknown = (event as CustomEvent).detail
      applyAnalyticsConsent(value === "accepted" || value === "declined" ? value : null)
    }
    function onStorage(event: StorageEvent) {
      if (event.key === COOKIE_CONSENT_KEY || event.key === null) applyAnalyticsConsent(readCookieConsent())
    }
    window.addEventListener(COOKIE_CONSENT_EVENT, onChoice)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, onChoice)
      window.removeEventListener("storage", onStorage)
    }
  }, [])
}
