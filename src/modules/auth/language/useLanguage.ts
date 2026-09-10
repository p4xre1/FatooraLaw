import { useEffect, useMemo } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { translations, type Translation } from "./translations"

export type Language = "ar" | "en" | "fr"

export const SUPPORTED_LANGUAGES: Language[] = ["ar", "en", "fr"]
const RTL_LANGUAGES: ReadonlySet<Language> = new Set(["ar"])
const DEFAULT_LANGUAGE: Language = "ar"

export function isRTL(language: Language): boolean {
  return RTL_LANGUAGES.has(language)
}

function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as string[]).includes(value)
}

type LanguageState = {
  language: Language
  setLanguage: (language: Language) => void
}

/**
 * Global, persisted language preference for the whole auth flow (and, if
 * imported elsewhere, the rest of the app). Backed by localStorage so the
 * active language survives reloads and stays consistent across
 * SignIn / SignUp / ForgotPassword without prop drilling.
 */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE,
      setLanguage: (language) => set({ language: isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE }),
    }),
    {
      name: "fatoora.auth.language",
      version: 1,
      // Guard against a corrupted/old value in localStorage forcing an unsupported language.
      migrate: (persisted) => {
        const state = persisted as Partial<LanguageState> | undefined
        return { language: isSupportedLanguage(state?.language) ? state.language : DEFAULT_LANGUAGE }
      },
    },
  ),
)

/**
 * Primary hook for auth screens: exposes the active language, a setter,
 * the resolved text direction, and the translation dictionary for that
 * language. Also applies `dir`/`lang` to <html> so native browser behavior
 * (scrollbars, form controls, text selection) follows the language too.
 */
export function useTranslation(): {
  language: Language
  setLanguage: (language: Language) => void
  dir: "rtl" | "ltr"
  t: Translation
} {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const dir = isRTL(language) ? "rtl" : "ltr"

  useEffect(() => {
    document.documentElement.dir = dir
    document.documentElement.lang = language
  }, [dir, language])

  const t = useMemo(() => translations[language], [language])

  return { language, setLanguage, dir, t }
}
