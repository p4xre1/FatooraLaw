import { useEffect, useMemo } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { DEFAULT_LOCALE, isRTL as isRTLLocale, localeInfo, type LocaleId } from "../locales.ts"
import { translations, type Translation } from "../../i18n/index.ts"

/**
 * The single language preference for the whole product — marketing pages aside,
 * which are addressed by URL (`/ar/pricing`) rather than by preference so that
 * `hreflang` stays meaningful.
 *
 * Why this lives in `lib/` and not under `modules/auth/`: it started life as the
 * auth flow's private store, but `useTranslation()` has always written
 * `dir`/`lang` to `<html>`, so it was already speaking for the whole document
 * while only translating the sign-in screens. Promoting it removes that
 * mismatch — one preference, one dictionary, one place that decides text
 * direction — and lets every module translate itself instead of hardcoding
 * French.
 *
 * `Language` is `LocaleId` from `lib/locales.ts` on purpose: the app and the
 * marketing site publish the same three languages, and two unions with the same
 * members would eventually disagree.
 */
export type Language = LocaleId

/** Order of the switcher's buttons; kept as the auth flow has always shown them. */
export const SUPPORTED_LANGUAGES: readonly Language[] = ["ar", "en", "fr"]

/**
 * The language a first-time visitor gets.
 *
 * This was `"ar"` while the store only covered the auth screens, which meant a
 * new visitor signed in through an Arabic, right-to-left form and then landed in
 * a French, left-to-right application. Now that the preference governs the whole
 * product it defaults to French, matching `DEFAULT_LOCALE` (the locale the
 * marketing site serves from its unprefixed, canonical URLs and advertises as
 * `x-default`) and matching what the application itself has always rendered.
 *
 * Anyone who has already chosen a language is unaffected: their choice is
 * persisted, and the default only applies when nothing valid is stored.
 */
export const DEFAULT_LANGUAGE: Language = DEFAULT_LOCALE

export function isRTL(language: Language): boolean {
  return isRTLLocale(language)
}

function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

/** Where the preference is persisted. */
export const LANGUAGE_STORAGE_KEY = "fatoora.language"

/**
 * The preference used to be scoped to the auth screens under this key. Carrying
 * it over means an existing user who picked Arabic or English does not silently
 * lose that choice when the store becomes app-wide. This runs before the store
 * is created, because `persist` reads storage synchronously at creation time.
 */
const LEGACY_LANGUAGE_STORAGE_KEY = "fatoora.auth.language"

if (typeof localStorage !== "undefined") {
  try {
    if (!localStorage.getItem(LANGUAGE_STORAGE_KEY)) {
      const legacy = localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY)
      if (legacy) {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, legacy)
        localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY)
      }
    }
  } catch {
    /* Storage can throw when it is full or blocked; fall back to the default. */
  }
}

type LanguageState = {
  language: Language
  setLanguage: (language: Language) => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE,
      setLanguage: (language) => set({ language: isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE }),
    }),
    {
      name: LANGUAGE_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({ language: state.language }),
      // migrate() only runs for different versions. Validate same-version
      // storage too, otherwise a bad locale crashes every translation lookup.
      merge: (persisted, current) => {
        const state = persisted as Partial<LanguageState> | undefined
        return { ...current, language: isSupportedLanguage(state?.language) ? state.language : DEFAULT_LANGUAGE }
      },
      // Guard against a corrupted/old value in localStorage forcing an unsupported language.
      migrate: (persisted) => {
        const state = persisted as Partial<LanguageState> | undefined
        return { language: isSupportedLanguage(state?.language) ? state.language : DEFAULT_LANGUAGE }
      },
    },
  ),
)

/**
 * Primary hook for every screen: exposes the active language, a setter, the
 * resolved text direction, and the translation dictionary for that language.
 * Also applies `dir`/`lang` to `<html>` so native browser behaviour (scrollbars,
 * form controls, text selection, and the `[dir="rtl"]` rules in `index.css`)
 * follows the language too.
 */
export function useTranslation(): {
  language: Language
  setLanguage: (language: Language) => void
  dir: "rtl" | "ltr"
  /**
   * BCP-47 tag for this language (`fr-MA`, `ar-MA`, `en`), from the same locale
   * table the marketing site uses for `hreflang`. Feed it to `Intl` so dates,
   * numbers and relative times are formatted for the language on screen rather
   * than for the browser's.
   */
  tag: string
  t: Translation
} {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const dir = isRTL(language) ? "rtl" : "ltr"

  useEffect(() => {
    if (typeof document === "undefined") return // prerendering has no document
    document.documentElement.dir = dir
    document.documentElement.lang = language
  }, [dir, language])

  const t = useMemo(() => translations[language] ?? translations[DEFAULT_LANGUAGE], [language])

  return { language, setLanguage, dir, tag: localeInfo(language).tag, t }
}
