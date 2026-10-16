import { useMemo, useState } from "react"
import { BarChart3, Boxes, Megaphone, Plus, Target, Truck } from "lucide-react"
import { useMizan } from "../store/useMizan"
import { parseAdReportCsv, adMetrics, type AdReportParseResult } from "../lib/adsAnalytics"
import { useTranslation } from "../lib/language/store"
import { useFormats } from "../lib/language/formats"
import { Card, SectionTitle, Btn, Badge, Table, Th, Td, Modal, Field, Input, Select, EmptyState } from "../components/kit"
import CreateOrder from "../components/CreateOrder"
import {
  adAllocations, audienceInsights, campaignPerformance, funnelSummary, orderEconomics,
  paymentStatus, stockAvailability, type AudienceSegment,
} from "../lib/deliveryAnalytics"
import type { AdPlatform, DeliveryStatus } from "../store/types"

const PLATFORMS: AdPlatform[] = ["facebook", "instagram", "google", "tiktok", "whatsapp", "other"]
const DELIVERY_STATUSES: DeliveryStatus[] = ["pending", "preparing", "shipped", "delivered", "returned", "cancelled"]

function formatDuration(hours: number | null, t: { minutes: (n: number) => string; hours: (n: number) => string; days: (n: number) => string; none: string }): string {
  if (hours === null || !Number.isFinite(hours)) return t.none
  if (hours < 1) return t.minutes(Math.max(1, Math.round(hours * 60)))
  if (hours < 48) return t.hours(Math.round(hours))
  return t.days(Math.round(hours / 24))
}

/**
 * Livraisons: the orders that came in, what each one costs (product,
 * delivery, packaging, other fees, and the ad cost of its client), the
 * stock they draw on, and the verified buyers' profile beside the work.
 */
export default function Delivery() {
  const { t: copy } = useTranslation()
  const t = copy.delivery
  const a = copy.ads
  const modules = copy.shared.modules
  const { decimalMoney } = useFormats()
  const { orders, campaigns, contacts, stock, settings, updateDeliveryOrder } = useMizan()
  const [creating, setCreating] = useState(false)
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [adImportOpen, setAdImportOpen] = useState(false)
  const cur = settings.currency

  const now = useMemo(() => new Date().toISOString(), [])
  const funnel = useMemo(() => funnelSummary(orders, campaigns, now), [orders, campaigns, now])
  const allocations = useMemo(() => adAllocations(orders, campaigns), [orders, campaigns])
  const performances = useMemo(() => campaignPerformance(campaigns, orders), [campaigns, orders])
  const availability = useMemo(() => stockAvailability(stock, orders), [stock, orders])
  const audience = useMemo(
    () => audienceInsights({ contacts, orders, campaigns, stock, currentYear: Number(now.slice(0, 4)) }),
    [contacts, orders, campaigns, stock, now],
  )
  const clientOf = (id: string) => contacts.find((c) => c.id === id)
  const toShip = orders.filter((o) => o.verificationStatus === "verified" && (o.deliveryStatus === "pending" || o.deliveryStatus === "preparing")).length

  const kpis: { label: string; value: string; tone?: string }[] = [
    { label: t.kpis.orders, value: String(funnel.orders) },
    { label: t.kpis.waiting, value: String(funnel.waiting + funnel.inCall) },
    { label: t.kpis.toShip, value: String(toShip) },
    { label: t.kpis.delivered, value: String(funnel.delivered) },
    { label: t.kpis.collected, value: decimalMoney(funnel.collected, cur, true) },
    { label: t.kpis.totalCost, value: decimalMoney(funnel.totalCost, cur, true) },
    { label: t.kpis.profit, value: decimalMoney(funnel.profit, cur, true), tone: funnel.profit < 0 ? "text-serious" : "text-emerald-700" },
  ]

  return (
    <div className="mz-view space-y-5">
      <SectionTitle
        title={modules.delivery}
        sub={t.subtitle(orders.length, funnel.delivered)}
        action={(
          <span className="flex flex-wrap gap-2">
            <Btn variant="outline" onClick={() => setAdImportOpen(true)}><BarChart3 className="h-4 w-4" /> {a.importButton}</Btn>
            <Btn variant="outline" onClick={() => setCampaignOpen(true)}><Megaphone className="h-4 w-4" /> {t.newCampaign}</Btn>
            <Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> {t.newOrder}</Btn>
          </span>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-[12px] text-muted">{kpi.label}</p>
            <p className={`tnum mt-1 text-[20px] font-bold ${kpi.tone ?? ""}`}>{kpi.value}</p>
          </Card>
        ))}
      </div>

      <AdPerformance campaigns={campaigns} currency={cur} labels={a} />

      {/* ---- Orders: the sale, what was collected, every cost, the profit ---- */}
      <Card>
        {orders.length === 0 ? (
          <EmptyState icon={<Truck className="h-5 w-5" />} text={t.empty} />
        ) : (
          <Table head={<><Th>{t.table.date}</Th><Th>{t.table.client}</Th><Th>{t.table.items}</Th><Th className="text-end">{t.table.sale}</Th><Th className="text-end">{t.table.collected}</Th><Th>{t.table.costs}</Th><Th className="text-end">{t.table.total}</Th><Th className="text-end">{t.table.profit}</Th><Th>{t.table.verify}</Th><Th>{t.table.payment}</Th><Th>{t.table.delivery}</Th></>}>
            {orders.map((order) => {
              const eco = orderEconomics(order, allocations.get(order.id) ?? 0)
              const client = clientOf(order.clientId)
              const pay = paymentStatus(order)
              return (
                <tr key={order.id} className="transition-colors hover:bg-canvas/60">
                  <Td className="tnum whitespace-nowrap text-muted">{order.createdAt.slice(0, 10)}</Td>
                  <Td>
                    <div className="font-semibold text-ink">{client?.name ?? "—"}</div>
                    <div className="text-[11px] text-muted">{client?.city || "—"}</div>
                  </Td>
                  <Td>
                    {order.items.map((item, i) => (
                      <div key={i} className="text-[12px]">{item.label} <span className="tnum text-muted">×{item.qty}</span></div>
                    ))}
                  </Td>
                  <Td className="tnum text-end">{decimalMoney(eco.revenue, cur)}</Td>
                  <Td className="tnum text-end">{decimalMoney(eco.collected, cur)}</Td>
                  <Td>
                    <div className="space-y-0.5 text-[11px] text-muted">
                      <div>{t.costParts.product} · <span className="tnum">{decimalMoney(eco.productCost, cur, true)}</span></div>
                      <div>{t.costParts.delivery} · <span className="tnum">{decimalMoney(order.deliveryCost, cur, true)}</span></div>
                      <div>{t.costParts.packaging} · <span className="tnum">{decimalMoney(order.packagingCost, cur, true)}</span></div>
                      <div>{t.costParts.other} · <span className="tnum">{decimalMoney(order.otherFees, cur, true)}</span></div>
                      <div>{t.costParts.ads} · <span className="tnum">{decimalMoney(eco.adCost, cur, true)}</span></div>
                    </div>
                  </Td>
                  <Td className="tnum text-end font-semibold">{decimalMoney(eco.totalCost, cur)}</Td>
                  <Td className={`tnum text-end font-semibold ${eco.profit < 0 ? "text-serious" : "text-emerald-700"}`}>{decimalMoney(eco.profit, cur)}</Td>
                  <Td><Badge tone={order.verificationStatus === "verified" ? "good" : order.verificationStatus === "refused" ? "serious" : "warn"}>{t.verification[order.verificationStatus]}</Badge></Td>
                  <Td><Badge tone={pay === "paid" ? "good" : pay === "partial" ? "warn" : "neutral"}>{t.payment[pay]}</Badge></Td>
                  <Td>
                    <Select
                      aria-label={`${t.table.delivery}: ${client?.name ?? order.id}`}
                      value={order.deliveryStatus}
                      onChange={(e) => updateDeliveryOrder(order.id, { deliveryStatus: e.target.value as DeliveryStatus })}
                      className="w-36 py-1.5 text-[12px]"
                    >
                      {DELIVERY_STATUSES.map((status) => <option key={status} value={status}>{t.deliveryStatus[status]}</option>)}
                    </Select>
                  </Td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {/* ---- Stock: what we have, what is already promised ---- */}
        <Card>
          <header className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <Boxes className="h-4 w-4 text-brand" />
            <div>
              <h2 className="text-[14px] font-bold">{t.stock.title}</h2>
              <p className="text-[11.5px] text-muted">{t.stock.subtitle}</p>
            </div>
          </header>
          {availability.length === 0 ? (
            <EmptyState icon={<Boxes className="h-5 w-5" />} text={t.stock.empty} />
          ) : (
            <Table head={<><Th>{t.stock.item}</Th><Th className="text-end">{t.stock.onHand}</Th><Th className="text-end">{t.stock.reserved}</Th><Th className="text-end">{t.stock.available}</Th></>}>
              {availability.map(({ item, onHand, reserved, available }) => (
                <tr key={item.id}>
                  <Td>
                    <span className="font-medium text-ink">{item.name}</span>
                    <span className="block text-[11px] text-muted">{item.sku}</span>
                  </Td>
                  <Td className="tnum text-end">{onHand} {item.unit}</Td>
                  <Td className="tnum text-end text-muted">{reserved} {item.unit}</Td>
                  <Td className={`tnum text-end font-semibold ${available <= item.minQty ? "text-warn" : ""}`}>{available} {item.unit}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        {/* ---- Campaigns: what a client costs to win ---- */}
        <Card>
          <header className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <Megaphone className="h-4 w-4 text-brand" />
            <h2 className="text-[14px] font-bold">{t.campaigns.title}</h2>
          </header>
          {performances.length === 0 ? (
            <EmptyState icon={<Megaphone className="h-5 w-5" />} text={t.campaigns.empty} />
          ) : (
            <Table head={<><Th>{t.campaigns.name}</Th><Th className="text-end">{t.campaigns.spend}</Th><Th className="text-end">{t.campaigns.leads}</Th><Th className="text-end">{t.campaigns.verified}</Th><Th className="text-end">{t.campaigns.cac}</Th><Th className="text-end">{t.campaigns.collected}</Th></>}>
              {performances.map((perf) => (
                <tr key={perf.campaign.id}>
                  <Td>
                    <span className="font-medium text-ink">{perf.campaign.name}</span>
                    <span className="block text-[11px] text-muted">{t.platforms[perf.campaign.platform]}</span>
                  </Td>
                  <Td className="tnum text-end">{decimalMoney(perf.campaign.spend, cur, true)}</Td>
                  <Td className="tnum text-end">{perf.leads}</Td>
                  <Td className="tnum text-end">
                    {perf.verifiedClients}
                    {perf.conversionRate !== null && <span className="block text-[11px] text-muted">{Math.round(perf.conversionRate * 100)}%</span>}
                  </Td>
                  <Td className="tnum text-end font-semibold">{perf.cac !== null ? decimalMoney(perf.cac, cur, true) : "—"}</Td>
                  <Td className="tnum text-end">{decimalMoney(perf.collected, cur, true)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {/* ---- The audience, beside the work ---- */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-brand" />
          <div>
            <h2 className="text-[14px] font-bold">{t.audience.title}</h2>
            <p className="text-[12px] text-muted">{t.audience.subtitle} · {t.audience.buyers(audience.buyers)}</p>
          </div>
        </div>
        {audience.buyers === 0 ? (
          <p className="py-4 text-center text-[13px] text-muted">{t.audience.empty}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <SegmentList title={t.audience.cities} segments={audience.byCity} label={(v) => v} />
            <SegmentList title={t.audience.sources} segments={audience.bySource} label={(v) => (copy.contacts.rank.sources as Record<string, string>)[v] ?? t.audience.unknown} />
            <SegmentList title={t.audience.channels} segments={audience.byChannel} label={(v) => (copy.contacts.rank.channels as Record<string, string>)[v] ?? t.audience.unknown} />
            <SegmentList title={t.audience.ages} segments={audience.byAge} label={(v) => (v === "unknown" ? t.audience.unknown : v)} />
            <SegmentList title={t.audience.products} segments={audience.byKeyword} label={(v) => v} />
          </div>
        )}
      </Card>

      {creating && <CreateOrder onClose={() => setCreating(false)} />}
      {campaignOpen && <CreateCampaign onClose={() => setCampaignOpen(false)} />}
      {adImportOpen && <ImportAdReport onClose={() => setAdImportOpen(false)} /> }
    </div>
  )
}

function SegmentList({ title, segments, label }: { title: string; segments: AudienceSegment[]; label: (value: string) => string }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      {segments.length === 0 ? (
        <p className="text-[12px] text-faint">—</p>
      ) : (
        <ul className="space-y-1">
          {segments.slice(0, 4).map((segment) => (
            <li key={segment.value} className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="min-w-0 truncate font-medium text-ink">{label(segment.value)}</span>
              <span className="tnum shrink-0 text-muted">{segment.clients} · {Math.round(segment.share * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CreateCampaign({ onClose }: { onClose: () => void }) {
  const { t: copy } = useTranslation()
  const t = copy.delivery
  const { addCampaign } = useMizan()
  const [name, setName] = useState("")
  const [platform, setPlatform] = useState<AdPlatform>("facebook")
  const [spend, setSpend] = useState("")
  const [startedAt, setStartedAt] = useState("")
  const [endedAt, setEndedAt] = useState("")
  const [error, setError] = useState<string | null>(null)

  return (
    <Modal title={t.newCampaign} onClose={onClose}>
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-serious">{error}</p>}
        <Field label={t.campaigns.name}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.campaigns.platform}>
            <Select value={platform} onChange={(e) => setPlatform(e.target.value as AdPlatform)}>
              {PLATFORMS.map((key) => <option key={key} value={key}>{t.platforms[key]}</option>)}
            </Select>
          </Field>
          <Field label={t.campaigns.spend}><Input type="number" min={0} step="0.01" className="tnum" value={spend} onChange={(e) => setSpend(e.target.value)} /></Field>
          <Field label={t.campaigns.start}><Input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} /></Field>
          <Field label={t.campaigns.end}><Input type="date" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} /></Field>
        </div>
        <Btn
          className="w-full"
          disabled={!name.trim() || spend.trim() === "" || Number(spend) < 0}
          onClick={() => {
            try {
              addCampaign({ name, platform, spend: Number(spend), startedAt, endedAt })
              onClose()
            } catch (err) {
              setError(err instanceof Error ? err.message : t.campaigns.empty)
            }
          }}
        >
          {t.campaigns.save}
        </Btn>
      </div>
    </Modal>
  )
}

export { formatDuration }

function AdPerformance({ campaigns, currency, labels }: { campaigns: import("../store/types").AdCampaign[]; currency: "MAD" | "EUR" | "USD"; labels: ReturnType<typeof useTranslation>["t"]["ads"] }) {
  const { decimalMoney } = useFormats()
  const rows = campaigns.filter((campaign) => campaign.impressions !== undefined || campaign.clicks !== undefined || campaign.conversions !== undefined || campaign.conversionValue !== undefined)
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0)
  const totalClicks = rows.reduce((sum, row) => sum + (row.clicks ?? 0), 0)
  const totalConversions = rows.reduce((sum, row) => sum + (row.conversions ?? 0), 0)
  return (
    <Card>
      <header className="border-b border-line px-5 py-3.5">
        <h2 className="text-[14px] font-bold">{labels.performance}</h2>
        <p className="text-[11.5px] text-muted">{labels.performanceSubtitle}</p>
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-muted">{labels.noMetrics}</p>
      ) : (
        <>
          <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3">
            <Metric label={labels.totalSpend} value={decimalMoney(totalSpend, currency, true)} />
            <Metric label={labels.totalClicks} value={String(totalClicks)} />
            <Metric label={labels.totalConversions} value={String(totalConversions)} />
          </div>
          <Table head={<><Th>{labels.platform}</Th><Th>{labels.impressions}</Th><Th>{labels.clicks}</Th><Th>{labels.conversions}</Th><Th>{labels.ctr}</Th><Th>{labels.cpc}</Th><Th>{labels.cpa}</Th><Th>{labels.conversionValue}</Th><Th>{labels.roas}</Th></>}>
            {rows.map((row) => {
              const metrics = adMetrics(row)
              return <tr key={row.id}>
                <Td><div className="font-medium">{row.name}</div><div className="text-[11px] text-muted">{row.platform} · {row.startedAt}{row.endedAt && row.endedAt !== row.startedAt ? ` – ${row.endedAt}` : ""}</div></Td>
                <Td className="tnum">{row.impressions ?? "—"}</Td><Td className="tnum">{row.clicks ?? "—"}</Td><Td className="tnum">{row.conversions ?? "—"}</Td>
                <Td className="tnum">{metrics.ctr === null ? "—" : `${(metrics.ctr * 100).toFixed(2)}%`}</Td>
                <Td className="tnum">{metrics.cpc === null ? "—" : decimalMoney(metrics.cpc, currency, true)}</Td>
                <Td className="tnum">{metrics.cpa === null ? "—" : decimalMoney(metrics.cpa, currency, true)}</Td>
                <Td className="tnum">{decimalMoney(row.conversionValue ?? 0, currency, true)}</Td>
                <Td className="tnum">{metrics.roas === null ? "—" : `${metrics.roas.toFixed(2)}×`}</Td>
              </tr>
            })}
          </Table>
        </>
      )}
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-canvas p-3"><p className="text-[11px] text-muted">{label}</p><p className="tnum mt-1 font-bold">{value}</p></div>
}

function ImportAdReport({ onClose }: { onClose: () => void }) {
  const { t: copy } = useTranslation()
  const a = copy.ads
  const { addCampaign } = useMizan()
  const [platform, setPlatform] = useState<AdPlatform>("facebook")
  const [parsed, setParsed] = useState<AdReportParseResult | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function readFile(file?: File) {
    setParsed(null)
    setError("")
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError(a.fileTooLarge); return }
    try {
      const result = parseAdReportCsv(await file.text(), platform)
      setParsed(result)
      if (!result.campaigns.length) setError(result.errors[0] ?? a.empty)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : a.empty)
    }
  }

  return (
    <Modal title={a.modalTitle} onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-lg bg-canvas p-3 text-[12px] text-muted">{a.privacy}</p>
        {error && <p role="alert" className="text-sm text-serious">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={a.platform}><Select value={platform} onChange={(e) => { setPlatform(e.target.value as AdPlatform); setParsed(null) }}><option value="facebook">Meta (Facebook / Instagram)</option><option value="google">Google Ads</option></Select></Field>
          <Field label={a.file}><Input type="file" accept=".csv,text/csv" onChange={(e) => void readFile(e.target.files?.[0])} /></Field>
        </div>
        {parsed && <div className="space-y-2">
          <p className="text-[12px] font-semibold">{a.preview}: {parsed.rowCount} {a.rows} · {parsed.campaigns.length} {a.campaigns}</p>
          {parsed.errors.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-[12px] text-amber-900"><strong>{a.errors}</strong><ul className="list-inside list-disc">{parsed.errors.slice(0, 5).map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
          <div className="max-h-48 overflow-auto rounded-lg border border-line">
            {parsed.campaigns.map((row) => <div key={row.name} className="flex items-center justify-between gap-3 border-b border-line p-2 text-[12px]"><span className="truncate">{row.name}</span><span className="tnum shrink-0">{row.spend.toFixed(2)} · {row.clicks} clicks · {row.conversions} conversions</span></div>)}
          </div>
          <Btn className="w-full" disabled={busy || parsed.campaigns.length === 0} onClick={() => {
            setBusy(true)
            try { parsed.campaigns.forEach((campaign) => addCampaign(campaign)); onClose() }
            catch (reason) { setError(reason instanceof Error ? reason.message : a.empty); setBusy(false) }
          }}>{a.save}</Btn>
        </div>}
      </div>
    </Modal>
  )
}
