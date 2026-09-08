import { useMemo, useState } from "react"
import { ScrollText, Download, ShieldAlert, Clock, Search } from "lucide-react"
import type { Severity } from "../store/types"
import { useMizan } from "../store/useMizan"
import { fmtDateTime, timeAgo, toCSV } from "../lib/mizan"
import { NAV } from "../components/nav"
import { Card, SectionTitle, Btn, Badge, Input, EmptyState } from "../components/kit"

const sevMeta: Record<Severity, { label: string; tone: "neutral" | "warn" | "serious" }> = {
  info: { label: "Info", tone: "neutral" },
  warning: { label: "Attention", tone: "warn" },
  critical: { label: "Critique", tone: "serious" },
}
const moduleLabel = (k: string) => NAV.find((n) => n.key === k)?.label ?? k

export default function AuditLog() {
  const audit = useMizan((s) => s.audit)
  const [q, setQ] = useState("")
  const [sev, setSev] = useState<"all" | Severity>("all")

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
      Horodatage: fmtDateTime(a.ts), Acteur: a.actor, Action: a.action, Cible: a.target,
      Module: moduleLabel(a.module), Sévérité: sevMeta[a.severity].label,
    })), "fatorati-journal-audit.csv")
  }

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Journal d'audit" sub="Traçabilité immuable des événements système" action={<Btn variant="outline" size="sm" onClick={exportLog}><Download className="h-4 w-4" /> Exporter le journal</Btn>} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700"><ScrollText className="h-5 w-5" /></span><div><p className="tnum text-[20px] font-bold">{audit.length}</p><p className="text-[12px] text-muted">Événements totaux</p></div></Card>
        <Card className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-good-50 text-emerald-700"><Clock className="h-5 w-5" /></span><div><p className="tnum text-[20px] font-bold">{last24.length}</p><p className="text-[12px] text-muted">Dernières 24 h</p></div></Card>
        <Card className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-serious-50 text-serious"><ShieldAlert className="h-5 w-5" /></span><div><p className="tnum text-[20px] font-bold text-serious">{critical24.length}</p><p className="text-[12px] text-muted">Actions critiques (24 h)</p></div></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher acteur, action, cible…" className="pl-9" />
        </div>
        <div className="inline-flex rounded-lg border border-line-strong bg-surface p-1">
          {([["all", "Tout"], ["critical", "Critique"], ["warning", "Attention"], ["info", "Info"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSev(k)} className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${sev === k ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? <EmptyState icon={<ScrollText className="h-5 w-5" />} text="Aucun événement." /> : (
          <ol className="divide-y divide-line">
            {filtered.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.severity === "critical" ? "bg-serious" : a.severity === "warning" ? "bg-warn" : "bg-faint"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px]"><span className="font-semibold text-ink">{a.actor}</span> <span className="text-muted">{a.action}</span> <span className="font-medium text-ink">{a.target}</span></p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted">
                    <span>{fmtDateTime(a.ts)}</span><span className="text-faint">·</span><span>{timeAgo(a.ts)}</span><span className="text-faint">·</span><span className="rounded bg-canvas px-1.5 py-0.5 font-medium">{moduleLabel(a.module)}</span>
                  </p>
                </div>
                <Badge tone={sevMeta[a.severity].tone} dot>{sevMeta[a.severity].label}</Badge>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
