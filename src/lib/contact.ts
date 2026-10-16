import site from "../../.figma/make/site.json"

/**
 * Public contact details, read from one place: `.figma/make/site.json`
 * (`organization`). Everything that shows or publishes them — the contact
 * section, the footer, the auth screen, the JSON-LD `Organization` node,
 * `llms.txt` — goes through this module.
 *
 * Public general contact and help/support addresses are configured separately,
 * alongside the verified Tangier location and supplied support telephone.
 * Inconsistent name/address/phone data is a documented local-SEO and
 * entity-verification problem (search engines and AI assistants reconcile
 * those signals against each other), and a fake phone number is worse than no
 * phone number. Edit the config once, and every surface follows.
 */

type SiteConfig = {
  organization?: {
    email?: string
    supportEmail?: string
    telephone?: string
    addressLocality?: string
    addressCountry?: string
  }
}

const organization = (site as SiteConfig).organization ?? {}

/** A number is only published when it is a plausible real one (digits + separators). */
function realPhone(value: string | undefined): string {
  const trimmed = value?.trim() ?? ""
  if (!/^\+?[0-9][0-9\s().-]{6,}$/.test(trimmed)) return ""
  // Obvious placeholders (`+212 0 20 00 00 00`, `0000…`, repeating digits) are refused.
  const digits = trimmed.replace(/\D/g, "")
  if (/^0+$/.test(digits) || /^(\d)\1+$/.test(digits)) return ""
  if (/0{4,}/.test(digits)) return ""
  return trimmed
}

/** Public/general contact address. */
export const CONTACT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organization.email ?? "") ? organization.email!.trim() : ""
/** Help and support address. */
export const SUPPORT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organization.supportEmail ?? "") ? organization.supportEmail!.trim() : ""

/** Empty unless a real number is configured — never a placeholder. */
export const CONTACT_PHONE = realPhone(organization.telephone)

/** City name for structured data and the default (French) copy. */
export const CONTACT_CITY = organization.addressLocality?.trim() || "Tanger"
/** ISO 3166-1 alpha-2 country code for structured data. */
export const CONTACT_COUNTRY = organization.addressCountry?.trim() || "MA"

/** `+212 5 39 00 00 00` → `tel:+212539000000` */
export function telHref(phone: string = CONTACT_PHONE): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`
}
