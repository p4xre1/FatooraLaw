import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Search, Upload, Download, MessageCircle, Mail, Trash2, Users } from "lucide-react"
import type { Contact } from "../store/types"
import { useMizan } from "../store/useMizan"
import { toCSV, parseCSV } from "../lib/mizan"
import { useFormats } from "../lib/language/formats"
import { useTranslation } from "../lib/language/store"
import { Card, SectionTitle, Btn, Badge, Table, Th, Td, Modal, Field, Input, Select, EmptyState, IconBtn } from "../components/kit"
import { matchesSegment, rankClients, type ClientStats, type ClientTier } from "../lib/clientRank"
import { clientOrderLedgers } from "../lib/clientOrderLedger"
import type { ContactSource, SalesChannel } from "../store/types"
import { useToday } from "../hooks/useToday"

const TIER_TONES: Record<ClientTier, "brand" | "warn" | "neutral" | "good"> = { vip: "brand", gold: "warn", silver: "neutral", bronze: "neutral" }
const SOURCES: ContactSource[] = ["whatsapp", "instagram", "facebook", "google", "referral", "other"]
const CHANNELS: SalesChannel[] = ["direct", "whatsapp", "instagram", "facebook", "reseller", "other"]

const FACETS: ("all" | "client" | "supplier")[] = ["all", "client", "supplier"]
type HistoryKind = "project" | "contract" | "order"
type HistoryEntry = { ts: string; label: string; amount: number; kind: HistoryKind }

export default function Contacts() {
  const { date, money: formatMoney } = useFormats()
  const { t: copy } = useTranslation()
  const t = copy.contacts
  const common = copy.common
  const modules = copy.shared.modules
  const { auth, contacts, projects, contracts, stock, orders, campaigns, settings, addContact, removeContact, importContacts } = useMizan()
  const today = useToday()
  const [q, setQ] = useState("")
  const [facet, setFacet] = useState<(typeof FACETS)[number]>("all")
  const [ledger, setLedger] = useState<Contact | null>(null)
  const [creating, setCreating] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [sortMode, setSortMode] = useState<"rank" | "name">("rank")
  const [segCity, setSegCity] = useState("")
  const [segSource, setSegSource] = useState<ContactSource | "">("")
  const [segChannel, setSegChannel] = useState<SalesChannel | "">("")
  const [segKeyword, setSegKeyword] = useState("")
  const importRevision = useRef(0)
  useEffect(() => {
    importRevision.current++
    setImporting(false)
    setImportError(null)
    return () => { importRevision.current++ }
  }, [auth?.id])
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return contacts.filter((c) =>
      (facet === "all" || c.type === facet) &&
      [c.name, c.ice, c.phone, c.email, c.city].some((f) => f.toLowerCase().includes(s)),
    )
  }, [contacts, q, facet])

  const orderLedgers = useMemo(() => clientOrderLedgers(orders, campaigns), [orders, campaigns])
  const balanceFor = (contact: Contact) => contact.balance + (contact.type === "client" ? orderLedgers.get(contact.id)?.outstanding ?? 0 : 0)
  const rankingContacts = useMemo(() => contacts.map((contact) => ({ ...contact, balance: balanceFor(contact) })), [contacts, orderLedgers])

  // The ranking (clients only): confirmed delivery receivables feed the
  // client's real balance before its score is computed.
  const ranked = useMemo(
    () => rankClients(rankingContacts, projects, stock, Number(today.slice(0, 4))),
    [rankingContacts, projects, stock, today],
  )
  const statsById = useMemo(() => new Map(ranked.map((r) => [r.contact.id, r])), [ranked])
  const segmentActive = Boolean(segCity || segSource || segChannel || segKeyword)
  const cityOptions = useMemo(() => [...new Set(ranked.map((r) => r.contact.city.trim()).filter(Boolean))].sort(), [ranked])
  const keywordOptions = useMemo(() => [...new Set(ranked.flatMap((r) => r.keywords))].sort(), [ranked])

  const ordered = useMemo(() => {
    const inSegment = (c: Contact) => {
      if (!segmentActive) return true
      const stats = statsById.get(c.id)
      return stats ? matchesSegment(stats, { city: segCity, source: segSource, channel: segChannel, keyword: segKeyword }) : false
    }
    const visible = filtered.filter(inSegment)
    if (sortMode === "name") return [...visible].sort((a, b) => a.name.localeCompare(b.name))
    const order = new Map(ranked.map((r, i) => [r.contact.id, i]))
    return [...visible].sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER))
  }, [filtered, ranked, sortMode, segmentActive, statsById, segCity, segSource, segChannel, segKeyword])

  function exportCsv() {
    try {
      toCSV(ordered.map((c) => ({
        [t.table.name]: c.name,
        [t.table.type]: c.type,
        [t.table.ice]: c.ice,
        [t.phone]: c.phone,
        [t.email]: c.email,
        [t.table.city]: c.city,
        [t.table.balance]: balanceFor(c),
      })), "fatorati-contacts.csv")
      setExportError(null)
    } catch { setExportError(t.exportError) }
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const revision = ++importRevision.current
    const ownerId = auth?.id
    setImportError(null)
    setImporting(true)
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error(t.fileTooLarge)
      const text = await file.text()
      if (revision !== importRevision.current || useMizan.getState().auth?.id !== ownerId) return
      const rows = parseCSV(text).slice(1).filter((r) => r[0]?.trim())
      if (rows.length > 10_000) throw new Error(t.tooManyRows(10_000))
      const contacts = rows.map((r) => {
        if (r.length !== 7) throw new Error(t.columnError(t.csvColumns))
        const balance = Number(r[6])
        if (!Number.isFinite(balance)) throw new Error(t.invalidBalance)
        return { name: r[0], type: r[1] === "supplier" ? "supplier" as const : "client" as const, ice: r[2], phone: r[3], email: r[4], city: r[5], balance }
      })
      importContacts(contacts)
    } catch (error) {
      if (revision === importRevision.current && useMizan.getState().auth?.id === ownerId) {
        setImportError(error instanceof Error ? error.message : t.readFailure)
      }
    } finally {
      if (revision === importRevision.current) setImporting(false)
    }
  }

  const historyFor = (id: string): HistoryEntry[] => [
    ...projects.filter((p) => p.clientId === id).map((p) => ({ ts: p.start, label: p.name, amount: p.budget, kind: "project" as const })),
    ...contracts.filter((c) => c.clientId === id).map((c) => ({ ts: c.date, label: c.title, amount: c.value, kind: "contract" as const })),
    ...(orderLedgers.get(id)?.entries ?? []).map(({ order, economics }) => ({
      ts: order.createdAt.slice(0, 10),
      label: order.items.map((item) => `${item.label} ×${item.qty}`).join(", "),
      amount: economics.revenue,
      kind: "order" as const,
    })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1))

  return (
    <div className="mz-view space-y-5">
      {exportError && <p role="alert" className="text-sm text-serious">{exportError}</p>}
      {importError && <p role="alert" className="text-sm text-serious">{importError}</p>}
      <SectionTitle title={modules.contacts} sub={t.subtitle} action={
        <div className="flex flex-wrap gap-2">
          <input aria-label={t.fileInput} ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onImport} />
          <Btn variant="outline" size="sm" disabled={importing} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> {importing ? t.importing : t.import}</Btn>
          <Btn variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> {t.export}</Btn>
          <Btn onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> {t.add}</Btn>
        </div>
      } />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input aria-label={t.searchLabel} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} className="ps-9" />
        </div>
        <div className="inline-flex rounded-lg border border-line-strong bg-surface p-1">
          {FACETS.map((k) => (
            <button key={k} type="button" aria-pressed={facet === k} onClick={() => setFacet(k)} className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${facet === k ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>{t.filters[k]}</button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-line-strong bg-surface p-1" role="group" aria-label={t.rank.title}>
          {(["rank", "name"] as const).map((mode) => (
            <button key={mode} type="button" aria-pressed={sortMode === mode} onClick={() => setSortMode(mode)} className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${sortMode === mode ? "bg-brand text-white" : "text-muted hover:text-ink"}`}>{mode === "rank" ? t.rank.sortRank : t.rank.sortName}</button>
          ))}
        </div>
      </div>

      {/* Segments of the ranking: city, where they found us, how they buy,
          what they buy. Each slices the same scored list. */}
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label={t.rank.allCities} value={segCity} onChange={(e) => setSegCity(e.target.value)} className="w-auto">
          <option value="">{t.rank.allCities}</option>
          {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
        </Select>
        <Select aria-label={t.rank.allSources} value={segSource} onChange={(e) => setSegSource(e.target.value as ContactSource | "")} className="w-auto">
          <option value="">{t.rank.allSources}</option>
          {SOURCES.map((key) => <option key={key} value={key}>{t.rank.sources[key]}</option>)}
        </Select>
        <Select aria-label={t.rank.allChannels} value={segChannel} onChange={(e) => setSegChannel(e.target.value as SalesChannel | "")} className="w-auto">
          <option value="">{t.rank.allChannels}</option>
          {CHANNELS.map((key) => <option key={key} value={key}>{t.rank.channels[key]}</option>)}
        </Select>
        <Select aria-label={t.rank.allKeywords} value={segKeyword} onChange={(e) => setSegKeyword(e.target.value)} className="w-auto">
          <option value="">{t.rank.allKeywords}</option>
          {keywordOptions.map((word) => <option key={word} value={word}>{word}</option>)}
        </Select>
      </div>

      <Card>
        {ordered.length === 0 ? <EmptyState icon={<Users className="h-5 w-5" />} text={t.empty} /> : (
          <Table head={<><Th>{t.table.name}</Th><Th>{t.table.type}</Th><Th>{t.rank.score}</Th><Th>{t.table.ice}</Th><Th>{t.table.contact}</Th><Th>{t.table.city}</Th><Th className="text-end">{t.table.balance}</Th><Th /></>}>
            {ordered.map((c) => {
              const balance = balanceFor(c)
              return (
              <tr key={c.id} className="transition-colors hover:bg-canvas/60">
                <Td><button type="button" onClick={() => setLedger(c)} className="font-semibold text-ink hover:text-brand">{c.name}</button></Td>
                <Td><Badge tone={c.type === "client" ? "brand" : "neutral"}>{t.type[c.type]}</Badge></Td>
                <Td>{statsById.get(c.id) ? <Badge tone={TIER_TONES[statsById.get(c.id)!.tier]}>{t.rank.tiers[statsById.get(c.id)!.tier]} · {statsById.get(c.id)!.score}</Badge> : <span className="text-faint">—</span>}</Td>
                <Td className="tnum text-muted">{c.ice}</Td>
                <Td className="text-muted">{c.phone}</Td>
                <Td className="text-muted">{c.city}</Td>
                <Td className={`tnum text-end font-semibold ${balance > 0 ? "text-warn" : balance < 0 ? "text-serious" : "text-muted"}`}>{formatMoney(balance, settings.currency)}</Td>
                <Td>
                  <div className="flex justify-end gap-0.5">
                    <IconBtn title={t.whatsapp} onClick={() => window.open(`https://wa.me/${c.phone.replace(/[^\d]/g, "")}`, "_blank")}><MessageCircle className="h-4 w-4" /></IconBtn>
                    <IconBtn title={t.emailAction} onClick={() => window.open(`mailto:${c.email}`)}><Mail className="h-4 w-4" /></IconBtn>
                    <IconBtn title={common.delete} aria-label={`${t.deleteAria} ${c.name}`} onClick={() => removeContact(c.id)} className="hover:bg-serious-50 hover:text-serious"><Trash2 className="h-4 w-4" /></IconBtn>
                  </div>
                </Td>
              </tr>
              )
            })}
          </Table>
        )}
      </Card>

      {ledger && (
        <Modal title={ledger.name} onClose={() => setLedger(null)} wide>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info label={t.table.type} value={t.type[ledger.type]} />
            <Info label={t.table.ice} value={ledger.ice} />
            <Info label={t.phone} value={ledger.phone} />
            <Info label={t.table.balance} value={formatMoney(balanceFor(ledger), settings.currency)} accent={balanceFor(ledger) > 0} />
            {ledger.type === "client" && <>
              <Info label={t.orderProfit} value={formatMoney(orderLedgers.get(ledger.id)?.profit ?? 0, settings.currency)} />
              <Info label={t.orderDebt} value={formatMoney(orderLedgers.get(ledger.id)?.outstanding ?? 0, settings.currency)} accent={(orderLedgers.get(ledger.id)?.outstanding ?? 0) > 0} />
            </>}
          </div>
          {ledger.type === "client" && statsById.get(ledger.id) && (
            <RankPanel stats={statsById.get(ledger.id)!} currency={settings.currency} />
          )}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.history}</p>
          {historyFor(ledger.id).length === 0 ? <p className="py-6 text-center text-[13px] text-muted">{t.noTransactions}</p> : (
            <Table head={<><Th>{common.date}</Th><Th>{t.table.type}</Th><Th>{common.name}</Th><Th className="text-end">{common.amount}</Th></>}>
              {historyFor(ledger.id).map((h, i) => (
                <tr key={i}><Td className="text-muted">{date(h.ts)}</Td><Td><Badge tone="neutral">{t.historyKind[h.kind as HistoryKind]}</Badge></Td><Td className="font-medium">{h.label}</Td><Td className="tnum text-end font-semibold">{formatMoney(h.amount, settings.currency)}</Td></tr>
              ))}
            </Table>
          )}
        </Modal>
      )}

      {creating && <CreateContact onClose={() => setCreating(false)} onCreate={(c) => { addContact(c); setCreating(false) }} />}
    </div>
  )
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-lg bg-canvas p-3"><p className="text-[11px] text-muted">{label}</p><p className={`tnum mt-0.5 text-[13.5px] font-bold ${accent ? "text-warn" : "text-ink"}`}>{value}</p></div>
}

function CreateContact({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Omit<Contact, "id">) => void }) {
  const { t: copy } = useTranslation()
  const t = copy.contacts
  const common = copy.common
  const [f, setF] = useState<Omit<Contact, "id">>({ type: "client", name: "", ice: "", phone: "", email: "", city: "", balance: 0, birthYear: null, source: null, channel: null })
  return (
    <Modal title={t.newContact} onClose={onClose}>
      <div className="space-y-4">
        <Field label={t.table.type}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Contact["type"] })}><option value="client">{t.type.client}</option><option value="supplier">{t.type.supplier}</option></Select></Field>
        <Field label={t.nameOrCompany}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.table.ice}><Input value={f.ice} onChange={(e) => setF({ ...f, ice: e.target.value })} /></Field>
          <Field label={t.table.city}><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label={t.phone}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder={t.phonePlaceholder} /></Field>
          <Field label={t.email}><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label={t.rank.birthYear}><Input type="number" min={1900} max={new Date().getFullYear()} className="tnum" value={f.birthYear ?? ""} onChange={(e) => setF({ ...f, birthYear: e.target.value ? Number(e.target.value) : null })} placeholder="1990" /></Field>
          <Field label={t.rank.sourceLabel}><Select value={f.source ?? ""} onChange={(e) => setF({ ...f, source: (e.target.value || null) as ContactSource | null })}><option value="">{t.rank.unknown}</option>{SOURCES.map((key) => <option key={key} value={key}>{t.rank.sources[key]}</option>)}</Select></Field>
          <Field label={t.rank.channelLabel}><Select value={f.channel ?? ""} onChange={(e) => setF({ ...f, channel: (e.target.value || null) as SalesChannel | null })}><option value="">{t.rank.unknown}</option>{CHANNELS.map((key) => <option key={key} value={key}>{t.rank.channels[key]}</option>)}</Select></Field>
        </div>
        <Btn className="w-full" disabled={!f.name.trim()} onClick={() => onCreate(f)}>{common.save}</Btn>
      </div>
    </Modal>
  )
}

/** What the client's score is made of — every point accounted for. */
function RankPanel({ stats, currency }: { stats: ClientStats; currency: SettingsCurrency }) {
  const { t: copy } = useTranslation()
  const t = copy.contacts
  const { money: formatMoney } = useFormats()
  const rows: { label: string; points: number; max: number }[] = [
    { label: t.rank.parts.spend, points: stats.parts.spend, max: 50 },
    { label: t.rank.parts.projects, points: stats.parts.projects, max: 15 },
    { label: t.rank.parts.balance, points: stats.parts.balance, max: 15 },
    { label: t.rank.parts.age, points: stats.parts.age, max: 10 },
  ]
  return (
    <div className="mb-4 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t.rank.breakdown}</p>
        <Badge tone={TIER_TONES[stats.tier]}>{t.rank.tiers[stats.tier]} · {stats.score}/100</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Info label={t.rank.spent} value={formatMoney(stats.spent, currency)} />
        <Info label={t.rank.contracted} value={formatMoney(stats.contracted, currency)} />
        <Info label={t.rank.age} value={stats.age !== null ? t.rank.years(stats.age) : t.rank.unknown} />
        <Info label={t.rank.projects} value={String(stats.projectsCount)} />
      </div>
      <div className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-[12px]">
            <span className="w-36 shrink-0 text-muted">{row.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (row.points / row.max) * 100)}%` }} />
            </span>
            <span className="tnum w-12 text-end font-semibold text-ink">{row.points}/{row.max}</span>
          </div>
        ))}
      </div>
      {(stats.contact.source || stats.contact.channel) && (
        <p className="mt-3 text-[12px] text-muted">
          {stats.contact.source && <>{t.rank.sourceLabel} : <span className="font-semibold text-ink">{t.rank.sources[stats.contact.source]}</span></>}
          {stats.contact.source && stats.contact.channel && " · "}
          {stats.contact.channel && <>{t.rank.channelLabel} : <span className="font-semibold text-ink">{t.rank.channels[stats.contact.channel]}</span></>}
        </p>
      )}
      {stats.keywords.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.rank.buys}</p>
          <div className="flex flex-wrap gap-1.5">
            {stats.keywords.map((word) => <Badge key={word} tone="neutral">{word}</Badge>)}
          </div>
        </div>
      )}
    </div>
  )
}

type SettingsCurrency = ReturnType<typeof useMizan.getState>["settings"]["currency"]
