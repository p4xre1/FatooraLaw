import { useMemo, useState } from "react"
import { Wrench, Plus, Trash2, AlertCircle } from "lucide-react"
import type { SubscriptionTool } from "../store/types"
import { useMizan } from "../store/useMizan"
import { useToday } from "../hooks/useToday"
import { daysUntil, validDateRange } from "../lib/calendarDates"
import { MAX_AMOUNT, parseAmount } from "../lib/businessValidation"
import { monthlySubscriptionCosts, subscriptionStatus } from "../lib/subscriptions"
import { useTranslation } from "../lib/language/store"
import { useFormats } from "../lib/language/formats"
import { AreaChart } from "../components/charts"
import { Card, SectionTitle, Btn, Badge, Modal, Field, Input, Table, Th, Td, IconBtn } from "../components/kit"

export default function Tools() {
  const { t: copy } = useTranslation()
  const t = copy.tools
  const common = copy.common
  const { modules } = copy.shared
  const { date, number } = useFormats()
  const { tools, addTool, removeTool } = useMizan()
  const [open, setOpen] = useState(false)
  const today = useToday()
  const active = useMemo(() => tools.filter((tool) => subscriptionStatus(tool, today) === "active"), [tools, today])
  const total = active.reduce((sum, tool) => sum + tool.cost, 0)
  const expiringSoon = active.filter((tool) => { const days = daysUntil(tool.expiry, today); return days !== null && days >= 0 && days <= 30 }).length
  const trend = useMemo(() => monthlySubscriptionCosts(tools, today), [tools, today])

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title={modules.tools} sub={t.subtitle} action={<Btn onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t.addTool}</Btn>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[12px] text-muted">{t.activeMonthlyCost}</p>
          <p className="tnum mt-1.5 text-[26px] font-bold leading-none text-ink">{number(total)} <span className="text-[13px] font-semibold text-muted">MAD</span></p>
          <p className="mt-2 text-[11.5px] text-faint">{t.activeMonthlyCostHint}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-muted">{t.activeTools}</p>
          <p className="tnum mt-1.5 text-[26px] font-bold leading-none text-ink">{active.length}</p>
          <p className="mt-2 text-[11.5px] text-faint">{t.ofRecorded(tools.length)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] text-muted">{t.expiringSoon}</p>
          <p className="tnum mt-1.5 text-[26px] font-bold leading-none text-ink">{expiringSoon}</p>
          <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-warn"><AlertCircle className="h-3.5 w-3.5" /> {t.renewSoon}</p>
        </Card>
      </div>
      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-ink">{t.projectedTitle}</h2>
          <Badge tone="brand" dot>{t.lastSevenMonths}</Badge>
        </div>
        <p className="mb-3 text-[12px] text-muted">{t.projectedNote}</p>
        <AreaChart labels={trend.labels} series={[{ name: t.projectedSeries, values: trend.values }]} height={200} format={(value) => `${number(value)} MAD`} />
      </Card>
      <Card className="overflow-hidden">
        <Table head={<><Th>{t.table.tool}</Th><Th className="text-right">{t.table.costPerMonth}</Th><Th>{t.table.startDate}</Th><Th>{t.table.expiry}</Th><Th>{common.status}</Th><Th /></>}>
          {tools.map((tool) => {
            const status = subscriptionStatus(tool, today)
            const days = daysUntil(tool.expiry, today)
            const soon = status === "active" && days !== null && days <= 30
            return (
              <tr key={tool.id} className="transition-colors hover:bg-canvas/60">
                <Td><span className="flex items-center gap-2.5 font-semibold text-ink"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand"><Wrench className="h-3.5 w-3.5" /></span>{tool.name}</span></Td>
                <Td className="tnum text-right font-semibold text-ink">{number(tool.cost)} MAD</Td>
                <Td className="tnum text-muted">{tool.start ? date(tool.start) : "—"}</Td>
                <Td className="tnum text-muted">{tool.expiry ? date(tool.expiry) : t.noExpiry}</Td>
                <Td>
                  {status === "expired" ? <Badge tone="serious" dot>{t.status.expired}</Badge> : status === "scheduled" ? <Badge tone="brand" dot>{t.status.scheduled}</Badge> : status === "unknown" ? <Badge tone="neutral">{t.status.unknown}</Badge> : soon ? <Badge tone="warn" dot>{t.status.expiresIn(days!)}</Badge> : <Badge tone="good" dot>{t.status.active}</Badge>}
                </Td>
                <Td className="text-right"><IconBtn onClick={() => removeTool(tool.id)} aria-label={t.removeAria(tool.name)}><Trash2 className="h-4 w-4" /></IconBtn></Td>
              </tr>
            )
          })}
        </Table>
        {tools.length === 0 && <p className="p-6 text-center text-sm text-muted">{t.empty}</p>}
      </Card>
      {open && <AddTool onClose={() => setOpen(false)} onAdd={(tool) => { addTool(tool); setOpen(false) }} />}
    </div>
  )
}

function AddTool({ onClose, onAdd }: { onClose: () => void; onAdd: (tool: Omit<SubscriptionTool, "id">) => void }) {
  const { t: copy } = useTranslation()
  const t = copy.tools
  const { common } = copy
  const [name, setName] = useState("")
  const [cost, setCost] = useState("")
  const [start, setStart] = useState("")
  const [expiry, setExpiry] = useState("")
  const [error, setError] = useState<string | null>(null)
  const amount = parseAmount(cost)
  const valid = !!name.trim() && amount !== null && validDateRange(start, expiry)
  return (
    <Modal title={t.modalTitle} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault()
        if (!valid || amount === null) return
        try { onAdd({ name, cost: amount, start, expiry }) }
        catch (err) { setError(err instanceof Error ? err.message : t.addError) }
      }}>
        {error && <p role="alert" className="text-sm text-serious">{error}</p>}
        <Field label={t.toolName}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.toolNamePlaceholder} autoFocus /></Field>
        <Field label={t.monthlyCost}><Input type="number" min={0} max={MAX_AMOUNT} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="299" className="tnum" /></Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label={t.table.startDate} hint={common.optionalFem}><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="tnum" /></Field>
          <Field label={t.table.expiry} hint={common.optionalFem}><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="tnum" /></Field>
        </div>
        {!validDateRange(start, expiry) && <p role="alert" className="text-sm text-serious">{t.dateOrderError}</p>}
        <div className="flex justify-end gap-2 pt-1"><Btn variant="outline" type="button" onClick={onClose}>{common.cancel}</Btn><Btn type="submit" disabled={!valid}><Plus className="h-4 w-4" /> {common.add}</Btn></div>
      </form>
    </Modal>
  )
}
