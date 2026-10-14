import { Languages } from "lucide-react"
import { localeInfo } from "../locales.ts"
import { SUPPORTED_LANGUAGES, useTranslation, type Language } from "./store.ts"

/**
 * The language switcher shared by the auth screens and the signed-in shell.
 *
 * Labels come from the locale table in `lib/locales.ts` — the same native names
 * the marketing switcher shows — so a language is never spelled two ways.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useTranslation()

  return (
    <div
      role="group"
      aria-label="Language / اللغة / Langue"
      className={`inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5 ${className}`}
    >
      <Languages className="ms-1.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
      {SUPPORTED_LANGUAGES.map((code: Language) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          className={`rounded-md px-2 py-1 text-[12px] font-semibold transition-colors ${
            language === code ? "bg-brand text-white" : "text-muted hover:bg-ink/[0.05] hover:text-ink"
          }`}
        >
          {localeInfo(code).label}
        </button>
      ))}
    </div>
  )
}
