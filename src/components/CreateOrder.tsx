import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { useMizan } from "../store/useMizan"
import { useTranslation } from "../lib/language/store"
import { useFormats } from "../lib/language/formats"
import { Btn, Field, Input, Modal, Select } from "./kit"
import { MAX_QUANTITY, parseAmount } from "../lib/businessValidation"
import { stockAvailability } from "../lib/deliveryAnalytics"
import type { ContactSource, DeliveryOrder, OrderItem, SalesChannel } from "../store/types"

type Row = { stockId: string; label: string; qty: string; price: string; cost: string }

const SOURCES: ContactSource[] = ["whatsapp", "instagram", "facebook", "google", "referral", "other"]
const CHANNELS: SalesChannel[] = ["direct", "whatsapp", "instagram", "facebook", "reseller", "other"]
const NEW_CLIENT = "__new"

/**
 * The order form, shared by Livraisons (a full order) and Vérification
 * clients (a lead is an order whose client still has to be called). The
 * client is picked from the contacts — or created with the order, since a
 * lead from an ad is rarely a contact yet. Stock lines prefill their
 * product cost from the article's purchase price, and say how many are
 * still available.
 */
export default function CreateOrder({ onClose }: { onClose: () => void }) {
  const { t: copy } = useTranslation()
  const t = copy.delivery
  const contactsCopy = copy.contacts
  const { decimalMoney } = useFormats()
  const { contacts, stock, campaigns, orders, settings, addDeliveryOrder, addClientOrder } = useMizan()

  const clients = contacts.filter((c) => c.type === "client")
  const [clientChoice, setClientChoice] = useState(clients[0]?.id ?? NEW_CLIENT)
  const [newClient, setNewClient] = useState({ name: "", phone: "", city: "", source: "" as ContactSource | "", channel: "" as SalesChannel | "" })
  const [campaignId, setCampaignId] = useState("")
  const [rows, setRows] = useState<Row[]>([{ stockId: "", label: "", qty: "1", price: "", cost: "" }])
  const [fees, setFees] = useState({ delivery: "", packaging: "", other: "" })
  const [paid, setPaid] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  const availability = useMemo(() => new Map(stockAvailability(stock, orders).map((a) => [a.item.id, a])), [stock, orders])
  const revenue = rows.reduce((sum, row) => sum + (parseAmount(row.qty, false, MAX_QUANTITY) ?? 0) * (parseAmount(row.price, true) ?? 0), 0)

  function setRow(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function chooseStock(index: number, stockId: string) {
    const item = stock.find((s) => s.id === stockId)
    setRow(index, {
      stockId,
      label: item?.name ?? rows[index].label,
      cost: item?.costPrice !== undefined ? String(item.costPrice) : rows[index].cost,
    })
  }

  function submit() {
    try {
      const items: OrderItem[] = rows.map((row) => {
        const qty = parseAmount(row.qty, false, MAX_QUANTITY)
        const price = parseAmount(row.price)
        const cost = parseAmount(row.cost, true)
        if (qty === null || price === null || cost === null || !row.label.trim()) throw new Error("invalid")
        return { stockId: row.stockId || null, label: row.label.trim(), qty, unitPrice: price, unitCost: cost }
      })
      const deliveryCost = parseAmount(fees.delivery, true)
      const packagingCost = parseAmount(fees.packaging, true)
      const otherFees = parseAmount(fees.other, true)
      const amountPaid = parseAmount(paid, true)
      if (deliveryCost === null || packagingCost === null || otherFees === null || amountPaid === null) throw new Error("invalid")
      const base: Omit<DeliveryOrder, "id" | "clientId" | "stockDeducted"> = {
        campaignId: campaignId || null,
        createdAt: new Date().toISOString(),
        items,
        deliveryCost,
        packagingCost,
        otherFees,
        amountPaid,
        verificationStatus: "new",
        deliveryStatus: "pending",
        callAttempts: 0,
        firstCallAt: null,
        verifiedAt: null,
        paidAt: null,
        shippedAt: null,
        deliveredAt: null,
        notes,
      }
      if (clientChoice === NEW_CLIENT) {
        if (!newClient.name.trim()) throw new Error("invalid")
        addClientOrder(
          {
            type: "client", name: newClient.name, ice: "", phone: newClient.phone, email: "", city: newClient.city,
            balance: 0, birthYear: null, source: newClient.source || null, channel: newClient.channel || null,
          },
          base,
        )
      } else {
        addDeliveryOrder({ ...base, clientId: clientChoice })
      }
      onClose()
    } catch {
      setError(t.form.error)
    }
  }

  return (
    <Modal title={t.form.title} onClose={onClose} wide>
      <div className="space-y-4">
        {error && <p role="alert" className="text-sm text-serious">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.form.client}>
            <Select value={clientChoice} onChange={(e) => setClientChoice(e.target.value)}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NEW_CLIENT}>{t.form.newClientOption}</option>
            </Select>
          </Field>
          <Field label={t.form.campaign}>
            <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">{t.form.noCampaign}</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>

        {clientChoice === NEW_CLIENT && (
          <div className="rounded-xl border border-line p-3">
            <p className="mb-3 text-[11.5px] font-medium text-muted">{t.form.createClientHint}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.form.name}><Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></Field>
              <Field label={t.form.phone}><Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="+212 6…" /></Field>
              <Field label={t.form.city}><Input value={newClient.city} onChange={(e) => setNewClient({ ...newClient, city: e.target.value })} /></Field>
              <Field label={t.form.source}>
                <Select value={newClient.source} onChange={(e) => setNewClient({ ...newClient, source: e.target.value as ContactSource | "" })}>
                  <option value="">{contactsCopy.rank.unknown}</option>
                  {SOURCES.map((key) => <option key={key} value={key}>{contactsCopy.rank.sources[key]}</option>)}
                </Select>
              </Field>
              <Field label={t.form.channel}>
                <Select value={newClient.channel} onChange={(e) => setNewClient({ ...newClient, channel: e.target.value as SalesChannel | "" })}>
                  <option value="">{contactsCopy.rank.unknown}</option>
                  {CHANNELS.map((key) => <option key={key} value={key}>{contactsCopy.rank.channels[key]}</option>)}
                </Select>
              </Field>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.form.items}</p>
          <div className="space-y-3">
            {rows.map((row, index) => {
              const available = row.stockId ? availability.get(row.stockId) : undefined
              return (
                <div key={index} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1.2fr_1.4fr_0.6fr_0.9fr_0.9fr_auto]">
                  <Field label={index === 0 ? t.form.product : " "}>
                    <Select aria-label={`${t.form.product} ${index + 1}`} value={row.stockId} onChange={(e) => chooseStock(index, e.target.value)}>
                      <option value="">{t.form.customProduct}</option>
                      {stock.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </Select>
                  </Field>
                  <Field label={index === 0 ? t.form.label : " "}>
                    <Input aria-label={`${t.form.label} ${index + 1}`} value={row.label} onChange={(e) => setRow(index, { label: e.target.value })} />
                  </Field>
                  <Field label={index === 0 ? t.form.qty : " "}>
                    <Input aria-label={`${t.form.qty} ${index + 1}`} type="number" min={0} step="0.001" className="tnum" value={row.qty} onChange={(e) => setRow(index, { qty: e.target.value })} />
                  </Field>
                  <Field label={index === 0 ? t.form.salePrice : " "}>
                    <Input aria-label={`${t.form.salePrice} ${index + 1}`} type="number" min={0} step="0.01" className="tnum" value={row.price} onChange={(e) => setRow(index, { price: e.target.value })} />
                  </Field>
                  <Field label={index === 0 ? t.form.unitCost : " "}>
                    <Input aria-label={`${t.form.unitCost} ${index + 1}`} type="number" min={0} step="0.01" className="tnum" value={row.cost} onChange={(e) => setRow(index, { cost: e.target.value })} />
                  </Field>
                  <Btn variant="ghost" size="sm" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, i) => i !== index))} aria-label={`${t.form.removeItem} ${index + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </Btn>
                  {available && <p className="text-[11px] text-faint sm:col-span-6">{t.form.available(available.available, available.item.unit)}</p>}
                </div>
              )
            })}
          </div>
          <Btn variant="outline" size="sm" className="mt-2" onClick={() => setRows((current) => [...current, { stockId: "", label: "", qty: "1", price: "", cost: "" }])}>
            <Plus className="h-4 w-4" /> {t.form.addItem}
          </Btn>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label={t.form.deliveryCost}><Input type="number" min={0} step="0.01" className="tnum" value={fees.delivery} onChange={(e) => setFees({ ...fees, delivery: e.target.value })} /></Field>
          <Field label={t.form.packagingCost}><Input type="number" min={0} step="0.01" className="tnum" value={fees.packaging} onChange={(e) => setFees({ ...fees, packaging: e.target.value })} /></Field>
          <Field label={t.form.otherFees}><Input type="number" min={0} step="0.01" className="tnum" value={fees.other} onChange={(e) => setFees({ ...fees, other: e.target.value })} /></Field>
          <Field label={t.form.amountPaid}><Input type="number" min={0} step="0.01" className="tnum" value={paid} onChange={(e) => setPaid(e.target.value)} /></Field>
        </div>

        <Field label={t.form.notes}><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

        <div className="flex items-center justify-between gap-3">
          <p className="tnum text-[13px] font-semibold text-ink">{decimalMoney(revenue, settings.currency)}</p>
          <Btn onClick={submit}>{t.form.save}</Btn>
        </div>
      </div>
    </Modal>
  )
}
