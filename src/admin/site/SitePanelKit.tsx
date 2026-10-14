import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { Badge, Card } from "../../components/kit"
import type { LocaleId } from "../../lib/locales"
import { LOCALES } from "../../lib/locales"

export function LocaleSelect({ value, onChange }: { value: LocaleId; onChange: (value: LocaleId) => void }) {
  return <select aria-label="لغة المحتوى" value={value} onChange={(event) => onChange(event.target.value as LocaleId)} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12px] font-semibold text-ink">
    {LOCALES.map((locale) => <option key={locale.id} value={locale.id}>{locale.label}</option>)}
  </select>
}

export function PanelCard({ title, description, loading, error, notice, action, children }: { title: string; description?: string; loading?: boolean; error?: string; notice?: string; action?: ReactNode; children: ReactNode }) {
  return <Card className="overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
      <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[14px] font-bold text-ink">{title}</h2><Badge tone="neutral">CMS</Badge></div>{description && <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted">{description}</p>}</div>
      {action}
    </div>
    {error && <div role="alert" className="mx-4 mt-4 rounded-lg border border-serious/20 bg-serious-50 px-3 py-2 text-[12px] text-serious sm:mx-5">{error}</div>}
    {notice && <div role="status" className="mx-4 mt-4 rounded-lg border border-good/20 bg-good-50 px-3 py-2 text-[12px] text-emerald-800 sm:mx-5">{notice}</div>}
    {loading ? <div className="grid min-h-40 place-items-center text-muted"><Loader2 className="h-5 w-5 animate-spin" /></div> : <div className="space-y-4 p-4 sm:p-5">{children}</div>}
  </Card>
}

export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : "تعذر تنفيذ العملية." }
export function getText(value: unknown): string { return typeof value === "string" ? value : "" }
export function isoToInput(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
export function inputToIso(value: string): string | null { return value ? new Date(value).toISOString() : null }
