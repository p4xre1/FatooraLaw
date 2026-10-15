import { useMemo, useState } from "react"
import { FileDown, Printer, Loader2, FileSpreadsheet, Info } from "lucide-react"
import { useMizan } from "../store/useMizan"
import { dashboardData } from "../lib/dashboardData"
import { useToday } from "../hooks/useToday"
import { toCSV, runAsync } from "../lib/mizan"
import { useFormats } from "../lib/language/formats"
import { useTranslation } from "../lib/language/store"
import { Card, SectionTitle, Btn, Badge, Table, Th, Td } from "../components/kit"
import MoroccoMap from "../components/MoroccoMap"
import { rankClients } from "../lib/clientRank"
import { aggregateByCity, matchCity } from "../lib/cities"
import { audienceInsights, type AudienceSegment } from "../lib/deliveryAnalytics"
import { BarChart } from "../components/charts"

const SUMMARY_KEYS = ["budget", "collected", "expenses", "receivables"] as const

export default function Reports() {
  const { decimalMoney } = useFormats()
  const { language, t: copy } = useTranslation()
  const t = copy.reports
  const dashboardCopy = copy.dashboard
  const modules = copy.shared.modules
  const { projects, expenses, contacts, audit, stock, orders, campaigns, settings } = useMizan()
  const today = useToday()
  const [range, setRange] = useState<6 | 8 | 12>(8)
  const [busy, setBusy] = useState(false)
  const [mapMetric, setMapMetric] = useState<"clients" | "spent">("spent")
  const [mapCity, setMapCity] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const m = useMemo(() => dashboardData({ projects, expenses, contacts, audit }, range, today, dashboardCopy.months), [projects, expenses, contacts, audit, range, today, dashboardCopy.months])
  const cur = settings.currency

  // Clients on the map: ranked once (score order), rolled up per city.
  const rankedClients = useMemo(
    () => rankClients(contacts, projects, stock, Number(today.slice(0, 4))),
    [contacts, projects, stock, today],
  )
  const cityAggregates = useMemo(
    () => aggregateByCity(rankedClients.map((r) => ({ city: r.contact.city, spent: r.spent }))),
    [rankedClients],
  )
  const cityLabelOf = (raw: string) => matchCity(raw)?.fr ?? raw.trim()
  const selectedClients = mapCity
    ? rankedClients.filter((r) => cityLabelOf(r.contact.city) === mapCity).slice(0, 5)
    : []
  // The audience the ads actually bought: verified buyers of orders.
  const audience = useMemo(
    () => audienceInsights({ contacts, orders, campaigns, stock, currentYear: Number(today.slice(0, 4)) }),
    [contacts, orders, campaigns, stock, today],
  )
  const totalAdSpend = campaigns.reduce((sum, c) => sum + c.spend, 0)
  const campaignVerified = audience.campaigns.reduce((sum, p) => sum + p.verifiedClients, 0)
  const campaignLeads = audience.campaigns.reduce((sum, p) => sum + p.leads, 0)
  const avgCac = campaignVerified ? totalAdSpend / campaignVerified : null
  const campaignConversion = campaignLeads ? campaignVerified / campaignLeads : null

  const values = {
    budget: m.budget,
    collected: m.collected,
    expenses: m.approvedExpenses,
    receivables: m.receivables,
  }

  async function exportExpenses() {
    if (busy || !m.monthly.periodCount) return
    setBusy(true); setExportError(null)
    const rows = m.monthly.labels.map((month, i) => ({
      [t.exportColumns.month]: month,
      [t.exportColumns.expenses]: m.monthly.values[i],
      [t.exportColumns.count]: m.monthly.entries[i],
    }))
    try { await runAsync(() => toCSV(rows, "fatorati-rapport-depenses-approuvees.csv")) }
    catch { setExportError(t.exportError) }
    finally { setBusy(false) }
  }

  return (
    <div className="mz-view space-y-5">
      {exportError && <p role="alert" className="text-sm text-serious">{exportError}</p>}
      <SectionTitle title={modules.reports} sub={t.subtitle} action={<div className="flex flex-wrap gap-2">
        <select aria-label={t.period} value={range} onChange={(event) => setRange(Number(event.target.value) as 6 | 8 | 12)} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink">{[6, 8, 12].map((n) => <option key={n} value={n}>{t.months(n)}</option>)}</select>
        <Btn variant="outline" size="sm" onClick={exportExpenses} disabled={busy || !m.monthly.periodCount}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} {t.exportExpenses}</Btn>
        <Btn variant="dark" size="sm" onClick={() => window.print()} disabled={!m.hasRecords}><Printer className="h-4 w-4" /> {t.pdf}</Btn>
      </div>} />
      {!m.hasRecords && <Card className="border-dashed p-6 text-center"><h2 className="font-bold">{t.emptyTitle}</h2><p className="mt-2 text-sm text-muted">{t.emptyBody}</p></Card>}
      {m.hiddenDemoCount > 0 && <p className="text-[12px] text-muted">{t.hiddenSamples(m.hiddenDemoCount)}</p>}
      {(m.invalidCount + m.invalidDateCount) > 0 && <p role="alert" className="text-[12px] text-warn">{t.invalidRecords(m.invalidCount + m.invalidDateCount)}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{SUMMARY_KEYS.map((key) => <Card key={key} className="p-4"><p className="text-[12px] text-muted">{t.summaries[key].label}</p><p className="tnum mt-1 text-[20px] font-bold">{decimalMoney(values[key], cur)}</p><p className="mt-1 text-[11px] text-faint">{t.allPeriods}</p></Card>)}</div>

      <Card className="border-warn/30 bg-warn-50 p-5"><div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-warn" /><div><h2 className="text-[14px] font-bold">{t.tax.title}</h2><p className="mt-2 text-[13px] leading-relaxed text-muted">{t.tax.body}</p><p className="mt-2 text-[13px] leading-relaxed text-muted">{t.tax.limits}</p></div></div></Card>

      <Card className="p-5"><div className="mb-3"><h2 className="text-[14px] font-bold">{t.monthly.title}</h2><p className="text-[12px] text-muted">{t.monthly.note(cur)}</p></div>
        {m.monthly.periodCount ? <BarChart labels={m.monthly.labels} series={[{ name: t.monthly.series, values: m.monthly.values }]} format={(n) => decimalMoney(n, cur, true)} /> : <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">{t.monthly.empty}</div>}
      </Card>
      <Card><header className="flex items-center gap-2 border-b border-line px-5 py-3.5"><FileSpreadsheet className="h-4 w-4 text-brand" /><h2 className="text-[14px] font-bold">{t.totals}</h2></header><Table head={<><Th>{t.table.line}</Th><Th>{t.table.source}</Th><Th className="text-end">{t.table.amount}</Th></>}>
        {SUMMARY_KEYS.map((key) => <tr key={key}><Td className="font-medium text-ink">{t.summaries[key].label}</Td><Td className="text-muted">{t.summaries[key].source}</Td><Td className="tnum text-end font-semibold">{decimalMoney(values[key], cur)}</Td></tr>)}
      </Table></Card>

      {/* ---- Clients by city: every client a point on the map ---- */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-bold">{t.clientsMap.title}</h2>
            <p className="mt-0.5 text-[12px] text-muted">{t.clientsMap.subtitle}</p>
          </div>
          <div className="inline-flex rounded-lg border border-line-strong bg-surface p-1" role="group" aria-label={t.clientsMap.title}>
            {(["clients", "spent"] as const).map((key) => (
              <button key={key} type="button" aria-pressed={mapMetric === key} onClick={() => setMapMetric(key)} className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${mapMetric === key ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>
                {key === "clients" ? t.clientsMap.byClients : t.clientsMap.bySpent}
              </button>
            ))}
          </div>
        </div>

        {rankedClients.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">{t.clientsMap.noClients}</p>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[1fr_230px]">
            <div>
              <MoroccoMap aggregates={cityAggregates} metric={mapMetric} selected={mapCity} onSelect={setMapCity} />
              <p className="mt-1 text-[10.5px] text-faint">{t.clientsMap.schematic}</p>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.clientsMap.topCities}</p>
              <ul className="space-y-1">
                {cityAggregates.map((a) => (
                  <li key={a.label}>
                    <button
                      type="button"
                      aria-pressed={mapCity === a.label}
                      onClick={() => setMapCity(mapCity === a.label ? null : a.label)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-start text-[12.5px] transition-colors ${mapCity === a.label ? "bg-brand-50 font-bold text-ink" : "hover:bg-canvas"}`}
                    >
                      <span className="min-w-0 truncate">{a.city ? a.label : `${a.label} · ${t.clientsMap.otherPlaces}`}</span>
                      <span className="tnum shrink-0 text-muted">{a.clients} · {decimalMoney(a.spent, cur, true)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {mapCity && selectedClients.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-[12.5px] font-bold">{t.clientsMap.bestIn(mapCity)}</p>
            <ul className="space-y-1.5">
              {selectedClients.map((r) => (
                <li key={r.contact.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="font-semibold text-ink">{r.contact.name}</span>
                  <Badge tone={r.tier === "vip" ? "brand" : r.tier === "gold" ? "warn" : "neutral"}>{r.score}</Badge>
                  <span className="tnum text-muted">{decimalMoney(r.spent, cur)}</span>
                  {r.keywords.slice(0, 3).map((word) => <span key={word} className="rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-semibold text-brand-700">{word}</span>)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* ---- Target audience & acquisition: who the ads bought ---- */}
      <Card className="p-5">
        <div className="mb-3">
          <h2 className="text-[14px] font-bold">{t.audience.title}</h2>
          <p className="mt-0.5 text-[12px] text-muted">{t.audience.subtitle}</p>
        </div>
        {audience.buyers === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">{t.audience.empty}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="p-4"><p className="text-[12px] text-muted">{t.audience.spend}</p><p className="tnum mt-1 text-[20px] font-bold">{decimalMoney(totalAdSpend, cur)}</p></Card>
              <Card className="p-4"><p className="text-[12px] text-muted">{t.audience.buyers}</p><p className="tnum mt-1 text-[20px] font-bold">{audience.buyers}</p></Card>
              <Card className="p-4"><p className="text-[12px] text-muted">{t.audience.cac}</p><p className="tnum mt-1 text-[20px] font-bold">{avgCac !== null ? decimalMoney(avgCac, cur) : "—"}</p></Card>
              <Card className="p-4"><p className="text-[12px] text-muted">{t.audience.conversion}</p><p className="tnum mt-1 text-[20px] font-bold">{campaignConversion !== null ? `${Math.round(campaignConversion * 100)}%` : "—"}</p></Card>
            </div>

            {audience.campaigns.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.audience.campaigns}</p>
                <Table head={<><Th>{t.audience.campaign}</Th><Th>{t.audience.platform}</Th><Th className="text-end">{t.audience.spend}</Th><Th className="text-end">{t.audience.leads}</Th><Th className="text-end">{t.audience.verified}</Th><Th className="text-end">{t.audience.cac}</Th><Th className="text-end">{t.audience.collected}</Th></>}>
                  {audience.campaigns.map((perf) => (
                    <tr key={perf.campaign.id}>
                      <Td className="font-medium text-ink">{perf.campaign.name}</Td>
                      <Td className="text-muted">{copy.delivery.platforms[perf.campaign.platform]}</Td>
                      <Td className="tnum text-end">{decimalMoney(perf.campaign.spend, cur)}</Td>
                      <Td className="tnum text-end">{perf.leads}</Td>
                      <Td className="tnum text-end">{perf.verifiedClients}</Td>
                      <Td className="tnum text-end font-semibold">{perf.cac !== null ? decimalMoney(perf.cac, cur) : "—"}</Td>
                      <Td className="tnum text-end">{decimalMoney(perf.collected, cur)}</Td>
                    </tr>
                  ))}
                </Table>
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <AudienceList title={t.audience.cities} segments={audience.byCity} label={(v) => v} money={(n) => decimalMoney(n, cur, true)} clientsLabel={t.audience.clients} />
              <AudienceList title={t.audience.sources} segments={audience.bySource} label={(v) => (copy.contacts.rank.sources as Record<string, string>)[v] ?? copy.delivery.audience.unknown} money={(n) => decimalMoney(n, cur, true)} clientsLabel={t.audience.clients} />
              <AudienceList title={t.audience.channels} segments={audience.byChannel} label={(v) => (copy.contacts.rank.channels as Record<string, string>)[v] ?? copy.delivery.audience.unknown} money={(n) => decimalMoney(n, cur, true)} clientsLabel={t.audience.clients} />
              <AudienceList title={t.audience.ages} segments={audience.byAge} label={(v) => (v === "unknown" ? copy.delivery.audience.unknown : v)} money={(n) => decimalMoney(n, cur, true)} clientsLabel={t.audience.clients} />
              <AudienceList title={t.audience.products} segments={audience.byKeyword} label={(v) => v} money={(n) => decimalMoney(n, cur, true)} clientsLabel={t.audience.clients} />
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

function AudienceList({ title, segments, label, money, clientsLabel }: {
  title: string
  segments: AudienceSegment[]
  label: (value: string) => string
  money: (n: number) => string
  clientsLabel: (n: number) => string
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      {segments.length === 0 ? (
        <p className="text-[12px] text-faint">—</p>
      ) : (
        <ul className="space-y-1.5">
          {segments.slice(0, 5).map((segment) => (
            <li key={segment.value} className="text-[12.5px]">
              <span className="font-medium text-ink">{label(segment.value)}</span>
              <span className="tnum block text-[11px] text-muted">{clientsLabel(segment.clients)} · {Math.round(segment.share * 100)}% · {money(segment.collected)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
