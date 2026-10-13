import site from "../../.figma/make/site.json"

export const SITE_URL = site.siteUrl.replace(/\/+$/, "")
export const GOOGLE_ANALYTICS_ID = /^G-[A-Z0-9]+$/.test(site.analytics.googleAnalyticsId) ? site.analytics.googleAnalyticsId : ""
