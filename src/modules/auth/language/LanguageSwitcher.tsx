import { Languages } from "lucide-react"
import { SUPPORTED_LANGUAGES, useTranslation, type Language } from "./useLanguage"

const LABELS: Record<Language, string> = {
  ar: "العربية",
  en: "English",
  fr: "Français",
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useTranslation()

  return (
    <div
      role="group"
      aria-label="Language / اللغة / Langue"
      className={`inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5 ${className}`}
    >
      <Languages className="ms-1.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
      {SUPPORTED_LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          className={`rounded-md px-2 py-1 text-[12px] font-semibold transition-colors ${
            language === code ? "bg-brand text-white" : "text-muted hover:bg-ink/[0.05] hover:text-ink"
          }`}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  )
}
