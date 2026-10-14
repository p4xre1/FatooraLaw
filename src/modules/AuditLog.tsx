import { useMemo, useState } from "react"
import { ScrollText, Download, ShieldAlert, Clock, Search } from "lucide-react"
import type { ModuleKey, Severity } from "../store/types"
import { useMizan } from "../store/useMizan"
import { toCSV } from "../lib/mizan"
import { useTranslation } from "../lib/language/store"
import { useFormats } from "../lib/language/formats"
import { Card, SectionTitle, Btn, Badge, Input, EmptyState } from "../components/kit"

/** Presentation only — the severity *names* come from the shared dictionary. */
const sevTone: Record<Severity, "neutral" | "warn" | "serious"> = {
  info: "neutral",
  warning: "warn",
  critical: "serious",
}

const FILTERS: ("all" | Severity)[] = ["all", "critical", "warning", "info"]

export default function AuditLog() {
  const audit = useMizan((s) => s.audit)
  const { t: copy } = useTranslation()
  const t = copy.audit
  const { modules, severity } = copy.shared
  const { dateTime, ago } = useFormats()
  const [q, setQ] = useState("")
  const [sev, setSev] = useState<"all" | Severity>("all")

  // An event stores its module as a key; the row shows the module's name in the
  // language on screen, and falls back to the raw key for anything a future
  // module writes before this screen knows about it.
  const moduleLabel = (k: string) => modules[k as ModuleKey] ?? k

  const last24 = audit.filter((a) => Date.now() - a.ts < 24 * 3600_000)
  const critical24 = last24.filter((a) => a.severity === "critical")

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return audit.filter((a) =>
      (sev === "all" || a.severity === sev) &&
      [a.actor, a.action, a.target, moduleLabel(a.module)].some((f) => f.toLowerCase().includes(s)),
    )
  }, [audit, q, sev])

  function exportLog() {
    toCSV(filtered.map((a) => ({
      [t.export.timestamp]: dateTime(a.ts), [t.export.actor]: a.actor, [t.export.action]: a.action, [t.export.target]: a.target,
      [t.export.module]: moduleLabel(a.module), [t.export.severity]: severity[a.severity],
    })), "fatorati-journal-audit.csv")
  }

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title={t.title} sub={t.subtitle} action={<Btn variant="outline" size="sm" onClick={exportLog}><Download className="h-4 w-4" /> {t.exportButton}</Btn>} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700"><ScrollText className="h-5 w-5" /></span><div><p className="tnum text-[20px] font-bold">{audit.length}</p><p className="text-[12px] text-muted">{t.totalEvents}</p></div></Card>
        <Card className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-good-50 text-emerald-700"><Clock className="h-5 w-5" /></span><div><p className="tnum text-[20px] font-bold">{last24.length}</p><p className="text-[12px] text-muted">{t.last24}</p></div></Card>
        <Card className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-serious-50 text-serious"><ShieldAlert className="h-5 w-5" /></span><div><p className="tnum text-[20px] font-bold text-serious">{critical24.length}</p><p className="text-[12px] text-muted">{t.critical24}</p></div></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} className="pl-9" />
        </div>
        <div className="inline-flex rounded-lg border border-line-strong bg-surface p-1">
          {FILTERS.map((k) => (
            <button key={k} onClick={() => setSev(k)} className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${sev === k ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>{k === "all" ? t.all : severity[k]}</button>
          ))}
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? <EmptyState icon={<ScrollText className="h-5 w-5" />} text={t.empty} /> : (
          <ol className="divide-y divide-line">
            {filtered.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.severity === "critical" ? "bg-serious" : a.severity === "warning" ? "bg-warn" : "bg-faint"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px]"><span className="font-semibold text-ink">{a.actor}</span> <span className="text-muted">{a.action}</span> <span className="font-medium text-ink">{a.target}</span></p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted">
                    <span>{dateTime(a.ts)}</span><span className="text-faint">·</span><span>{ago(a.ts)}</span><span className="text-faint">·</span><span className="rounded bg-canvas px-1.5 py-0.5 font-medium">{moduleLabel(a.module)}</span>
                  </p>
                </div>
                <Badge tone={sevTone[a.severity]} dot>{severity[a.severity]}</Badge>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
