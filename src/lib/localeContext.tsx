import { createContext, useCallback, useContext, type ReactNode } from "react"
import { DEFAULT_LOCALE, type LocaleId } from "./locales.ts"
import { localizedPath } from "./routes.ts"

/**
 * The locale of the page currently being rendered, published to the tree so no
 * component has to thread it through props to render a correct link.
 *
 * Two rules make this safe to rely on:
 *   - during prerendering the value always comes from the URL being rendered
 *     (`/ar/pricing` → `ar`), never from a guess, so the static HTML and the
 *     hydrated client agree on every href;
 *   - the default value is the default locale, so a component rendered outside
 *     a provider (a unit test of one section, for instance) still gets the
 *     unprefixed French URLs it expects.
 */
const LocaleContext = createContext<LocaleId>(DEFAULT_LOCALE)

export function LocaleProvider({ locale, children }: { locale: LocaleId; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleId {
  return useContext(LocaleContext)
}

/**
 * Localised link builder: `to("/pricing")` is `/pricing` on the French pages
 * and `/ar/pricing` on the Arabic ones. Non-marketing targets (auth screens,
 * the signed-in app, `mailto:`, external URLs) are returned untouched — those
 * exist in one language only.
 */
export function useLocaleHref(): (target: string) => string {
  const locale = useLocale()
  return useCallback(
    (target: string) => localizedPath(target.startsWith("/") ? target : `/${target}`, locale),
    [locale],
  )
}
