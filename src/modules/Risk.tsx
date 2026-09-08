import { useMemo, useState } from "react"
import { ShieldAlert, ShieldCheck, Bell, AlertTriangle, Search } from "lucide-react"
import { Card, SectionTitle, Badge, Input } from "../components/kit"

type Level = "high" | "medium" | "ok"
type Risk = { id: string; label: string; category: string; desc: string; due: string; level: Level }

const LEVEL_META: Record<Level, { label: string; tone: "serious" | "warn" | "good"; rail: string; icon: typeof Bell }> = {
  high: { label: "Élevé", tone: "serious", rail: "bg-serious", icon: AlertTriangle },
  medium: { label: "Moyen", tone: "warn", rail: "bg-warn", icon: Bell },
  ok: { label: "OK", tone: "good", rail: "bg-emerald-brand", icon: ShieldCheck },
}

const RISKS: Risk[] = [
  { id: "r1", label: "Déclaration TVA — T3 2026", category: "Fiscalité", due: "30/09/2026", level: "high", desc: "Dépôt et télépaiement obligatoires auprès de la DGI avant le 30/09. Une majoration de 15% s'applique en cas de retard, plus 0,5% par mois." },
  { id: "r2", label: "Acompte IS — 1er versement", category: "Fiscalité", due: "15/09/2026", level: "high", desc: "Premier acompte de l'impôt sur les sociétés basé sur le résultat fiscal N-1 à régler à la Trésorerie Générale du Royaume." },
  { id: "r3", label: "Contrat client — PME locale", category: "Contrats", due: "22/09/2026", level: "medium", desc: "La clause de pénalité de retard (art. 264 DOC) doit être révisée avant reconduction. Plafond actuel non conforme au marché." },
  { id: "r4", label: "Registre du commerce — Modèle J", category: "Registre commercial", due: "—", level: "ok", desc: "Modèle J à jour auprès du tribunal de commerce de Casablanca. Prochaine mise à jour requise après l'AGO." },
  { id: "r5", label: "Assurance RC Professionnelle", category: "Contrats", due: "20/09/2026", level: "medium", desc: "Échéance trimestrielle de la prime. Vérifier l'adéquation des plafonds de garantie aux chantiers en cours." },
  { id: "r6", label: "CNSS — déclaration mensuelle", category: "Social", due: "—", level: "ok", desc: "Télédéclaration et paiement des cotisations effectués via le portail DAMANCOM. À jour." },
  { id: "r7", label: "Conformité RGPD / Loi 09-08", category: "Données personnelles", due: "—", level: "ok", desc: "Traitement des données clients déclaré à la CNDP. Registre des traitements tenu et sanitisation des saisies active." },
]

const FILTERS: { key: Level | "all"; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "high", label: "Élevé" },
  { key: "medium", label: "Moyen" },
  { key: "ok", label: "OK" },
]

export default function Risk() {
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Level | "all">("all")

  const counts = useMemo(() => ({
    high: RISKS.filter((r) => r.level === "high").length,
    medium: RISKS.filter((r) => r.level === "medium").length,
    ok: RISKS.filter((r) => r.level === "ok").length,
  }), [])

  const list = useMemo(
    () => RISKS.filter((r) => (filter === "all" || r.level === filter) && (r.label + r.category + r.desc).toLowerCase().includes(q.toLowerCase())),
    [q, filter],
  )

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Gestion des Risques" sub="Alertes de conformité proactives adaptées à la réglementation marocaine" />

      <div className="grid gap-4 sm:grid-cols-3">
        {([["high", "Risques élevés", counts.high], ["medium", "Avertissements", counts.medium], ["ok", "Contrôles conformes", counts.ok]] as [Level, string, number][]).map(([lvl, label, n]) => {
          const M = LEVEL_META[lvl]
          return (
            <Card key={lvl} className="flex items-center gap-3.5 p-4">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${M.rail}`}><M.icon className="h-5 w-5" /></span>
              <div>
                <p className="text-[22px] font-bold leading-none text-ink tnum">{n}</p>
                <p className="mt-1 text-[12px] text-muted">{label}</p>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${filter === f.key ? "bg-navy text-white" : "border border-line-strong bg-surface text-muted hover:text-ink"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une alerte…" className="pl-9" />
        </div>
      </div>

      <div className="space-y-2.5">
        {list.map((r) => {
          const M = LEVEL_META[r.level]
          return (
            <Card key={r.id} className="relative overflow-hidden p-4 pl-5">
              <span className={`absolute inset-y-0 left-0 w-1.5 ${M.rail}`} />
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${r.level === "ok" ? "bg-good-50 text-emerald-700" : r.level === "medium" ? "bg-warn-50 text-warn" : "bg-serious-50 text-serious"}`}>
                  <M.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold text-ink">{r.label}</h3>
                      <Badge tone="neutral">{r.category}</Badge>
                    </div>
                    <Badge tone={M.tone} dot>{M.label}</Badge>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{r.desc}</p>
                  {r.due !== "—" && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-faint">
                      <ShieldAlert className="h-3.5 w-3.5" /> Échéance : <span className="text-ink">{r.due}</span>
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
