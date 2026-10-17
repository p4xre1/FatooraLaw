import { useEffect, useMemo, useState } from "react"
import { Award, FileText, PhoneCall, Plus, Trash2, UserCheck, Users, UserPlus } from "lucide-react"
import { useMizan } from "../store/useMizan"
import { useTranslation } from "../lib/language/store"
import { useFormats } from "../lib/language/formats"
import { Badge, Btn, Card, EmptyState, Field, Input, Select, SectionTitle, Table, Th, Td } from "../components/kit"
import CreateOrder from "../components/CreateOrder"
import { formatDuration } from "./Delivery"
import {
  clientCosts, funnelSummary, orderRevenue, orderTimings, paymentStatus,
} from "../lib/deliveryAnalytics"
import type { VerificationCallOutcome, VerificationStatus } from "../store/types"
import { topVerificationPerformer, verificationPerformance } from "../lib/verificationAnalytics"
import { requestInvoiceFromOrder } from "../lib/invoiceHandoff"

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
  const { decimalMoney, dateTime, number } = useFormats()
  const {
    auth, orders, contacts, campaigns, settings, updateDeliveryOrder,
    verificationTeam, verificationCalls, setVerificationTeamName,
    addVerificationAgent, removeVerificationAgent, recordVerificationCall,
  } = useMizan()
  const [creating, setCreating] = useState(false)
  const [teamNameDraft, setTeamNameDraft] = useState(verificationTeam.name)
  const [memberNameDraft, setMemberNameDraft] = useState("")
  const [activeAgentId, setActiveAgentId] = useState("")
  const cur = settings.currency

  useEffect(() => setTeamNameDraft(verificationTeam.name), [verificationTeam.name])
  useEffect(() => {
    setActiveAgentId((current) => current && verificationTeam.members.some((member) => member.id === current)
      ? current
      : verificationTeam.members[0]?.id ?? "")
  }, [verificationTeam.members])

  const now = useMemo(() => new Date().toISOString(), [])
  const funnel = useMemo(() => funnelSummary(orders, campaigns, now), [orders, campaigns, now])
  const costs = useMemo(() => clientCosts(contacts, orders, campaigns), [contacts, orders, campaigns])
  const performance = useMemo(() => verificationPerformance(verificationTeam.members, verificationCalls), [verificationTeam.members, verificationCalls])
  const topPerformer = useMemo(() => topVerificationPerformer(performance), [performance])
  const callHistory = useMemo(() => [...verificationCalls].sort((a, b) => b.calledAt.localeCompare(a.calledAt)), [verificationCalls])
  const untrackedCalls = useMemo(() => {
    const loggedByOrder = new Map<string, number>()
    for (const call of verificationCalls) loggedByOrder.set(call.orderId, (loggedByOrder.get(call.orderId) ?? 0) + 1)
    return orders.reduce((sum, order) => sum + Math.max(0, order.callAttempts - (loggedByOrder.get(order.id) ?? 0)), 0)
  }, [orders, verificationCalls])
  const clientOf = (id: string) => contacts.find((c) => c.id === id)
  const campaignOf = (id: string | null) => campaigns.find((c) => c.id === id)
  const logCall = (orderId: string, outcome: VerificationCallOutcome) => recordVerificationCall(orderId, outcome, activeAgentId || null)

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

      <Card className="p-4 sm:p-5">
        <header className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-brand" />
          <h2 className="text-[14px] font-bold">{t.team.title}</h2>
        </header>
        <p className="mb-4 text-[12px] leading-relaxed text-muted">{t.team.setupHint}</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); setVerificationTeamName(teamNameDraft) }}>
            <Field label={t.team.nameLabel}>
              <Input maxLength={120} value={teamNameDraft} onChange={(event) => setTeamNameDraft(event.target.value)} placeholder={t.team.namePlaceholder} />
            </Field>
            <Btn type="submit" disabled={teamNameDraft.trim() === verificationTeam.name}>{t.team.saveName}</Btn>
          </form>
          <form className="flex items-end gap-2" onSubmit={(event) => {
            event.preventDefault()
            if (!memberNameDraft.trim()) return
            const memberId = addVerificationAgent(memberNameDraft)
            setActiveAgentId(memberId)
            setMemberNameDraft("")
          }}>
            <Field label={t.team.memberName}>
              <Input maxLength={120} value={memberNameDraft} onChange={(event) => setMemberNameDraft(event.target.value)} placeholder={t.team.memberPlaceholder} />
            </Field>
            <Btn type="submit" disabled={!memberNameDraft.trim()}><UserPlus className="h-4 w-4" /> {t.team.addMember}</Btn>
          </form>
        </div>
        <div className="mt-4 grid gap-4 border-t border-line pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
          <div>
            {verificationTeam.members.length ? (
              <ul className="flex flex-wrap gap-2">
                {verificationTeam.members.map((member) => (
                  <li key={member.id} className="flex items-center gap-2 rounded-lg border border-line bg-canvas/60 px-2.5 py-1.5 text-[12px] font-medium text-ink">
                    <span>{member.name}</span>
                    <button type="button" onClick={() => removeVerificationAgent(member.id)} aria-label={t.team.removeMemberAria(member.name)} title={t.team.removeMember} className="rounded p-0.5 text-muted hover:bg-serious-50 hover:text-serious">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-muted">{t.team.noMembers}</p>
            )}
          </div>
          <Field label={t.team.activeAgent} hint={t.team.callerHint}>
            <Select value={activeAgentId} onChange={(event) => setActiveAgentId(event.target.value)}>
              <option value="">{t.team.unassigned}</option>
              {verificationTeam.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-brand" />
            <h2 className="text-[14px] font-bold">{t.team.performanceTitle}</h2>
          </div>
          <p className="text-[11px] text-muted">{t.team.rateHelp}</p>
        </header>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2">
          <div className="rounded-lg bg-brand-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{t.team.topRate}</p>
            {topPerformer ? (
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-ink">{topPerformer.name ?? t.team.unassigned}</span>
                <span className="tnum text-[20px] font-bold text-brand">{number(Math.round((topPerformer.rate ?? 0) * 100))}%</span>
                <span className="w-full text-[11px] text-muted">{t.team.topMeta(topPerformer.verified, topPerformer.calls)}</span>
              </div>
            ) : <p className="mt-1 text-[12px] text-muted">{t.team.noTopRate}</p>}
          </div>
          {untrackedCalls > 0 && <p className="self-center text-[12px] leading-relaxed text-muted">{t.team.previousAttempts(untrackedCalls)}</p>}
        </div>
        {performance.length ? (
          <Table head={<><Th>{t.team.member}</Th><Th className="text-end">{t.team.calls}</Th><Th className="text-end">{t.team.called}</Th><Th className="text-end">{t.team.noAnswer}</Th><Th className="text-end">{t.team.verified}</Th><Th className="text-end">{t.team.refused}</Th><Th className="text-end">{t.team.rate}</Th></>}>
            {performance.map((row) => (
              <tr key={row.agentId ?? "unassigned"}>
                <Td className="font-semibold">{row.name ?? t.team.unassigned}</Td>
                <Td className="tnum text-end">{number(row.calls)}</Td>
                <Td className="tnum text-end">{number(row.called)}</Td>
                <Td className="tnum text-end">{number(row.noAnswer)}</Td>
                <Td className="tnum text-end">{number(row.verified)}</Td>
                <Td className="tnum text-end">{number(row.refused)}</Td>
                <Td className="tnum text-end font-semibold">{row.rate === null ? "—" : `${number(Math.round(row.rate * 100))}%`}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState icon={<Users className="h-5 w-5" />} text={t.team.performanceEmpty} />
        )}
      </Card>

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
                      onClick={() => logCall(order.id, "called")}
                    >
                      {t.queue.addAttempt}
                    </button>
                  </Td>
                  <Td>
                    <Badge tone={status === "verified" ? "good" : status === "refused" ? "serious" : status === "new" ? "neutral" : "warn"}>
                      {deliveryCopy.verification[status]}
                    </Badge>
                    {status === "verified" && <Btn size="sm" variant="outline" className="mt-1.5" onClick={() => requestInvoiceFromOrder(order, client, settings.taxRate, auth?.id)}><FileText className="h-3.5 w-3.5" /> {deliveryCopy.invoiceButton}</Btn>}
                    {status !== "verified" && status !== "refused" && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        <Btn size="sm" variant="outline" onClick={() => logCall(order.id, "called")}>{t.queue.call}</Btn>
                        <Btn size="sm" variant="outline" onClick={() => logCall(order.id, "no_answer")}>{t.queue.noAnswer}</Btn>
                        <Btn size="sm" onClick={() => logCall(order.id, "verified")}>{t.queue.verify}</Btn>
                        <Btn size="sm" variant="danger" onClick={() => logCall(order.id, "refused")}>{t.queue.refuse}</Btn>
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

      <Card>
        <header className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <PhoneCall className="h-4 w-4 text-brand" />
          <h2 className="text-[14px] font-bold">{t.team.historyTitle}</h2>
        </header>
        {callHistory.length === 0 ? (
          <EmptyState icon={<PhoneCall className="h-5 w-5" />} text={t.team.historyEmpty} />
        ) : (
          <Table head={<><Th>{t.team.historyClient}</Th><Th>{t.team.historyAgent}</Th><Th>{t.team.historyOutcome}</Th><Th>{t.team.historyDate}</Th></>}>
            {callHistory.map((call) => {
              const result = call.outcome === "called" ? t.team.called : deliveryCopy.verification[call.outcome]
              const tone = call.outcome === "verified" ? "good" : call.outcome === "refused" ? "serious" : call.outcome === "no_answer" ? "warn" : "brand"
              return (
                <tr key={call.id}>
                  <Td>
                    <span className="font-semibold text-ink">{call.clientName}</span>
                    <span className="block text-[11px] text-muted">{clientOf(call.clientId)?.phone || "—"}</span>
                  </Td>
                  <Td>{call.agentName ?? t.team.unassigned}</Td>
                  <Td><Badge tone={tone}>{result}</Badge></Td>
                  <Td className="tnum text-[12px]">{dateTime(Date.parse(call.calledAt))}</Td>
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
