import type { ReactNode } from "react"
import { ShieldCheck } from "lucide-react"
import { useAuthTranslation } from "../language/useAuthTranslation"
import { LanguageSwitcher } from "../../../lib/language/LanguageSwitcher"

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  const { dir, language } = useAuthTranslation()
  // Tajawal (already loaded in index.css) reads far better for Arabic than the Latin sans stack.
  const fontClass = language === "ar" ? "font-arabic" : "font-sans"

  return (
    <div dir={dir} lang={language} className={`min-h-screen w-full bg-canvas ${fontClass}`}>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row">
        {/* Brand panel — hidden on small screens, order follows `dir` automatically via document flow */}
        <div className="relative hidden w-full shrink-0 overflow-hidden bg-navy px-10 py-12 text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between">
          <div className="flex items-center gap-2 text-[15px] font-bold">
            <ShieldCheck className="h-5 w-5 text-brand-100" aria-hidden="true" />
            Fatoora
          </div>
          <div>
            <h1 className="font-display text-[28px] font-bold leading-tight">{title}</h1>
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/70">{subtitle}</p>
          </div>
          <p className="text-[12px] text-white/40">© {new Date().getFullYear()} Fatoora</p>
        </div>

        {/* Form panel */}
        <div className="flex w-full flex-1 flex-col px-6 py-8 sm:px-10 lg:px-14">
          {/* `flex-wrap` keeps the segmented switcher on screen on the narrowest
              phones: it drops to its own line rather than being pushed off the
              right edge by the wordmark beside it. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[15px] font-bold text-ink lg:hidden">
              <ShieldCheck className="h-5 w-5 text-brand" aria-hidden="true" />
              Fatoora
            </div>
            <LanguageSwitcher className="ms-auto" />
          </div>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>

          {footer && <div className="mx-auto w-full max-w-sm pb-6 text-center text-[13px] text-muted">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
