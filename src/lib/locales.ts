/**
 * The locale table — the single source of truth for every language variant
 * this site publishes, and the only place that knows an `hreflang` code.
 *
 * Why it exists: the marketing pages used to switch language in component
 * state, so French, Arabic and English were all served from *one* URL. Search
 * engines cannot use `hreflang` in that situation — an alternate that points
 * at the same URL as the page is not an alternate — so each language now has
 * its own URL tree, and this table pairs every language with the region it is
 * written for, the prefix it lives under and the direction it renders in.
 *
 * Everything else is derived from this file: the route helpers
 * (`src/lib/routes.ts`), the canonical URL and `hreflang` tags
 * (`src/lib/seo.ts`), the sitemap, the prerendered documents
 * (`scripts/prerender.mjs`, `src/entry-server.tsx`), the generated
 * `_redirects` (`vite.config.ts`) and the `Content-Language` response header
 * (`public/_headers`).
 *
 * Adding a language = one entry here, its copy in `src/lib/seo.ts` and its
 * dictionary in `src/marketing/Landing.tsx`. Nothing else needs to change.
 */

/** Every language the site publishes. Keep in sync with `TABLE` below. */
export type LocaleId = "fr" | "ar" | "en"

export type Locale = {
  id: LocaleId
  /**
   * BCP-47 tag: language subtag + the region the copy is written for.
   * Used verbatim as the `hreflang` value, the sitemap `xhtml:link` value,
   * the `Content-Language` header and schema.org `inLanguage`. `en` carries
   * no region on purpose: the English copy is not targeted at one country.
   */
  tag: string
  /** The `lang` attribute of `<html>` — the language subtag alone. */
  lang: string
  /** ISO 3166-1 alpha-2 region of the audience, or null when not regional. */
  region: string | null
  dir: "ltr" | "rtl"
  /**
   * URL prefix for this locale. The default locale is served from the
   * unprefixed URLs every existing link, canonical and sitemap entry already
   * points at, so localising the site added URLs without moving any.
   */
  prefix: string
  /** Native name, shown in the language switcher. */
  label: string
  /** Open Graph locale (underscored tag, e.g. `fr_MA`). */
  ogLocale: string
  /** The variant crawlers are sent to when no language matches (`x-default`). */
  isDefault: boolean
}

const TABLE = [
  {
    id: "fr",
    tag: "fr-MA",
    lang: "fr",
    region: "MA",
    dir: "ltr",
    prefix: "",
    label: "Français",
    ogLocale: "fr_MA",
    isDefault: true,
  },
  {
    id: "ar",
    tag: "ar-MA",
    lang: "ar",
    region: "MA",
    dir: "rtl",
    prefix: "/ar",
    label: "العربية",
    ogLocale: "ar_MA",
    isDefault: false,
  },
  {
    // Region-less on purpose: there is no English *Morocco* audience to
    // target, and claiming `en-US`/`en-GB` would misdeclare the content.
    id: "en",
    tag: "en",
    lang: "en",
    region: null,
    dir: "ltr",
    prefix: "/en",
    label: "English",
    ogLocale: "en",
    isDefault: false,
  },
] as const satisfies readonly Locale[]

export const LOCALES: readonly Locale[] = TABLE
export const LOCALE_IDS: readonly LocaleId[] = TABLE.map((locale) => locale.id)

/** The variant served from the canonical, unprefixed URLs and used for `x-default`. */
export const DEFAULT_LOCALE: LocaleId = "fr"

/** The `hreflang` value that tells crawlers which URL to use when nothing matches. */
export const X_DEFAULT = "x-default"

export function localeInfo(id: LocaleId = DEFAULT_LOCALE): Locale {
  return LOCALES.find((locale) => locale.id === id) ?? LOCALES[0]
}

export function isLocaleId(value: unknown): value is LocaleId {
  return typeof value === "string" && LOCALE_IDS.includes(value as LocaleId)
}

/** `ar` → `ar-MA`. */
export function hreflang(id: LocaleId): string {
  return localeInfo(id).tag
}

export function isRTL(id: LocaleId): boolean {
  return localeInfo(id).dir === "rtl"
}
