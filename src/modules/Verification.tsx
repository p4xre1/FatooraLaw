import { useMemo, useState } from "react"
import { PhoneCall, Plus, UserCheck } from "lucide-react"
import { useMizan } from "../store/useMizan"
import { useTranslation } from "../lib/language/store"
import { useFormats } from "../lib/language/formats"
import { Card, SectionTitle, Btn, Badge, Table, Th, Td, EmptyState } from "../components/kit"
import CreateOrder from "../components/CreateOrder"
import { formatDuration } from "./Delivery"
import {
  clientCosts, funnelSummary, orderRevenue, orderTimings, paymentStatus,
} from "../lib/deliveryAnalytics"
import type { VerificationStatus } from "../store/types"

/**
 * Vérification clients: the call queue. Leads wait to be called, take time
 * to convince, get verified — then payment. The stamps the store writes at
 * each stage are what the waiting and convincing times are read from, and
 * the second table answers the other question: what did each client,
 * exactly, cost us?
 */
export default function Verification() {
  const { t: copy } = useTranslation()
  const t = copy.verification
  const deliveryCopy = copy.delivery
  const modules = copy.shared.modules
  const { decimalMoney } = useFormats()
  const { orders, contacts, campaigns, settings, updateDeliveryOrder } = useMizan()
  const [creating, setCreating] = useState(false)
  const cur = settings.currency

  const now = useMemo(() => new Date().toISOString(), [])
  const funnel = useMemo(() => funnelSummary(orders, campaigns, now), [orders, campaigns, now])
  const costs = useMemo(() => clientCosts(contacts, orders, campaigns), [contacts, orders, campaigns])
  const clientOf = (id: string) => contacts.find((c) => c.id === id)
  const campaignOf = (id: string | null) => campaigns.find((c) => c.id === id)

  // The queue works the oldest waiting lead first; settled clients sink.
  const queue = useMemo(() => {
    const rank = (status: VerificationStatus) => (status === "verified" ? 2 : status === "refused" ? 3 : 0)
    return [...orders].sort(
      (a, b) => rank(a.verificationStatus) - rank(b.verificationStatus) || a.createdAt.localeCompare(b.createdAt),
    )
  }, [orders])

  const kpis: { label: string; value: string }[] = [
    { label: t.kpis.waiting, value: String(funnel.waiting) },
    { label: t.kpis.avgWait, value: formatDuration(funnel.avgWaitHours, deliveryCopy.duration) },
    { label: t.kpis.avgConvince, value: formatDuration(funnel.avgConvinceHours, deliveryCopy.duration) },
    { label: t.kpis.verifiedRate, value: funnel.verifiedRate !== null ? `${Math.round(funnel.verifiedRate * 100)}%` : "—" },
    { label: t.kpis.toCollect, value: decimalMoney(funnel.toCollect, cur, true) },
  ]

  return (
    <div className="mz-view space-y-5">
      <SectionTitle
        title={modules.verification}
        sub={t.subtitle}
        action={<Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> {t.newLead}</Btn>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-[12px] text-muted">{kpi.label}</p>
            <p className="tnum mt-1 text-[20px] font-bold">{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* ---- The call queue ---- */}
      <Card>
        <header className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <PhoneCall className="h-4 w-4 text-brand" />
          <h2 className="text-[14px] font-bold">{t.queue.title}</h2>
        </header>
        {queue.length === 0 ? (
          <EmptyState icon={<UserCheck className="h-5 w-5" />} text={t.queue.empty} />
        ) : (
          <Table head={<><Th>{t.queue.client}</Th><Th>{t.queue.campaign}</Th><Th>{t.queue.waiting}</Th><Th className="text-center">{t.queue.attempts}</Th><Th>{t.queue.status}</Th><Th>{t.times.convince}</Th><Th>{t.queue.payment}</Th></>}>
            {queue.map((order) => {
              const client = clientOf(order.clientId)
              const campaign = campaignOf(order.campaignId)
              const timings = orderTimings(order, now)
              const revenue = orderRevenue(order)
              const pay = paymentStatus(order)
              const status = order.verificationStatus
              return (
                <tr key={order.id} className="transition-colors hover:bg-canvas/60">
                  <Td>
                    <div className="font-semibold text-ink">{client?.name ?? "—"}</div>
                    <div className="text-[11px] text-muted">{client?.phone || "—"} · {client?.city || "—"}</div>
                  </Td>
                  <Td>
                    {campaign ? (
                      <>
                        <div className="text-[12.5px] font-medium text-ink">{campaign.name}</div>
                        <div className="text-[11px] text-muted">{deliveryCopy.platforms[campaign.platform]}</div>
                      </>
                    ) : (
                      <span className="text-[12px] text-muted">{client?.source ? copy.contacts.rank.sources[client.source] : deliveryCopy.platforms.organic}</span>
                    )}
                  </Td>
                  <Td>
                    <span className="tnum font-semibold">{formatDuration(timings.waitHours, deliveryCopy.duration)}</span>
                    <span className="block text-[11px] text-muted">{order.createdAt.slice(0, 10)}</span>
                  </Td>
                  <Td className="text-center">
                    <span className="tnum font-semibold">{order.callAttempts}</span>
                    <button
                      type="button"
                      className="block w-full text-[11px] font-semibold text-brand hover:underline"
                      onClick={() => updateDeliveryOrder(order.id, { callAttempts: order.callAttempts + 1, verificationStatus: status === "new" ? "calling" : status })}
                    >
                      {t.queue.addAttempt}
                    </button>
                  </Td>
                  <Td>
                    <Badge tone={status === "verified" ? "good" : status === "refused" ? "serious" : status === "new" ? "neutral" : "warn"}>
                      {deliveryCopy.verification[status]}
                    </Badge>
                    {status !== "verified" && status !== "refused" && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        <Btn size="sm" variant="outline" onClick={() => updateDeliveryOrder(order.id, { verificationStatus: "calling", callAttempts: order.callAttempts + 1 })}>{t.queue.call}</Btn>
                        <Btn size="sm" variant="outline" onClick={() => updateDeliveryOrder(order.id, { verificationStatus: "no_answer", callAttempts: order.callAttempts + 1 })}>{t.queue.noAnswer}</Btn>
                        <Btn size="sm" onClick={() => updateDeliveryOrder(order.id, { verificationStatus: "verified" })}>{t.queue.verify}</Btn>
                        <Btn size="sm" variant="danger" onClick={() => updateDeliveryOrder(order.id, { verificationStatus: "refused" })}>{t.queue.refuse}</Btn>
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="tnum">{formatDuration(timings.convinceHours, deliveryCopy.duration)}</span>
                    <span className="block text-[11px] text-muted">{t.times.totalVerify} · <span className="tnum">{formatDuration(timings.verifyHours, deliveryCopy.duration)}</span></span>
                  </Td>
                  <Td>
                    <Badge tone={pay === "paid" ? "good" : pay === "partial" ? "warn" : "neutral"}>{deliveryCopy.payment[pay]}</Badge>
                    <span className="tnum block text-[11px] text-muted">{decimalMoney(order.amountPaid, cur, true)} / {decimalMoney(revenue, cur, true)}</span>
                    {status === "verified" && pay !== "paid" && revenue > 0 && (
                      <Btn size="sm" variant="outline" className="mt-1.5" onClick={() => updateDeliveryOrder(order.id, { amountPaid: revenue })}>
                        {t.queue.markPaid}
                      </Btn>
                    )}
                  </Td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>

      {/* ---- What each client cost us ---- */}
      <Card>
        <header className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <UserCheck className="h-4 w-4 text-brand" />
          <h2 className="text-[14px] font-bold">{t.costs.title}</h2>
        </header>
        {costs.length === 0 ? (
          <EmptyState icon={<UserCheck className="h-5 w-5" />} text={t.costs.empty} />
        ) : (
          <Table head={<><Th>{t.costs.client}</Th><Th className="text-end">{t.costs.orders}</Th><Th className="text-end">{t.costs.collected}</Th><Th className="text-end">{t.costs.product}</Th><Th className="text-end">{t.costs.delivery}</Th><Th className="text-end">{t.costs.packaging}</Th><Th className="text-end">{t.costs.other}</Th><Th className="text-end">{t.costs.ads}</Th><Th className="text-end">{t.costs.total}</Th><Th className="text-end">{t.costs.profit}</Th></>}>
            {costs.map((summary) => (
              <tr key={summary.contact.id}>
                <Td>
                  <span className="font-semibold text-ink">{summary.contact.name}</span>
                  <span className="block text-[11px] text-muted">
                    {summary.contact.city || "—"}
                    {summary.avgConvinceHours !== null && <> · {t.times.convince} · <span className="tnum">{formatDuration(summary.avgConvinceHours, deliveryCopy.duration)}</span></>}
                  </span>
                </Td>
                <Td className="tnum text-end">{summary.orders}</Td>
                <Td className="tnum text-end">{decimalMoney(summary.collected, cur)}</Td>
                <Td className="tnum text-end text-muted">{decimalMoney(summary.productCost, cur)}</Td>
                <Td className="tnum text-end text-muted">{decimalMoney(summary.deliveryCost, cur)}</Td>
                <Td className="tnum text-end text-muted">{decimalMoney(summary.packagingCost, cur)}</Td>
                <Td className="tnum text-end text-muted">{decimalMoney(summary.otherFees, cur)}</Td>
                <Td className="tnum text-end text-muted">{decimalMoney(summary.adCost, cur)}</Td>
                <Td className="tnum text-end font-semibold">{decimalMoney(summary.totalCost, cur)}</Td>
                <Td className={`tnum text-end font-semibold ${summary.profit < 0 ? "text-serious" : "text-emerald-700"}`}>{decimalMoney(summary.profit, cur)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {creating && <CreateOrder onClose={() => setCreating(false)} />}
    </div>
  )
}
