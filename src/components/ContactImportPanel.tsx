import { useEffect, useRef, useState } from "react"
import { Download, Upload, Users } from "lucide-react"
import { useMizan, accountStorageKey } from "../store/useMizan"
import { useTranslation } from "../lib/language/store"
import { useLocalSaveStatus } from "../lib/localSaveStatus"
import { CONTACT_IMPORT_MAX_BYTES, ContactImportError, downloadContactTemplate, parseContactImport, uniqueImportedContacts, type ImportedContact } from "../lib/contactImport"
import { Btn, Card, Field, Table, Th, Td } from "./kit"

export default function ContactImportPanel() {
  const { t: copy } = useTranslation()
  const t = copy.settings.contactImport
  const ownerId = useMizan((state) => state.auth?.id)
  const existing = useMizan((state) => state.contacts)
  const [pending, setPending] = useState<{ ownerId: string; rows: ImportedContact[] } | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const revision = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    revision.current++
    setPending(null); setReading(false); setError(""); setNotice("")
    if (input.current) input.current.value = ""
    return () => { revision.current++ }
  }, [ownerId])
  const preview = pending && pending.ownerId === ownerId ? uniqueImportedContacts(pending.rows, existing) : null

  async function readFile(file?: File) {
    const current = ++revision.current
    setPending(null); setError(""); setNotice("")
    if (!file || !ownerId) { setReading(false); return }
    setReading(true)
    try {
      if (file.size > CONTACT_IMPORT_MAX_BYTES) throw new Error(t.tooLarge)
      if (!/\.csv$/i.test(file.name)) throw new Error(t.readError)
      const text = await file.text()
      if (current !== revision.current || useMizan.getState().auth?.id !== ownerId) return
      const rows = parseContactImport(text)
      setPending({ ownerId, rows })
    } catch (cause) {
      if (current !== revision.current || useMizan.getState().auth?.id !== ownerId) return
      const message = cause instanceof ContactImportError ? t.errors[cause.code] : cause instanceof Error ? cause.message : t.readError
      setError(cause instanceof ContactImportError && cause.row ? t.row(cause.row, message) : message)
    } finally {
      if (current === revision.current) setReading(false)
    }
  }
  function confirm() {
    if (!pending || !ownerId || useMizan.getState().auth?.id !== pending.ownerId) return
    try {
      // Recheck against current records in case another action added a contact
      // while the user was reviewing this preview.
      const { contacts, skipped } = uniqueImportedContacts(pending.rows, useMizan.getState().contacts)
      if (contacts.length) useMizan.getState().importContacts(contacts)
      setPending(null)
      if (input.current) input.current.value = ""
      const issue = useLocalSaveStatus.getState().issue
      if (issue?.key === accountStorageKey(ownerId)) {
        setError(t.savedWarning)
      } else {
        setNotice(t.success(contacts.length, skipped))
      }
    } catch { setError(t.failed) }
  }
  function cancel() {
    revision.current++
    setPending(null); setReading(false); setError(""); setNotice("")
    if (input.current) input.current.value = ""
  }
  return <Card className="space-y-3 p-4">
    <h2 className="flex items-center gap-2 text-[14px] font-bold"><Users className="h-4 w-4 text-brand" />{t.title}</h2>
    <p className="text-[12.5px] leading-relaxed text-muted">{t.steps}</p>
    <p className="text-[12px] leading-relaxed text-muted">{t.hint}</p>
    <Btn variant="outline" size="sm" onClick={() => {
      try { downloadContactTemplate() } catch { setError(t.failed) }
    }}><Download className="h-4 w-4" />{t.template}</Btn>
    <Field label={t.file}>
      <input ref={input} type="file" accept=".csv,text/csv" disabled={!ownerId} className="block w-full text-[12px] text-muted file:me-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-ink" onChange={(event) => { void readFile(event.target.files?.[0]) }} />
    </Field>
    {reading && <p role="status" className="text-[12px] text-muted">{t.reading}</p>}
    {error && <p role="alert" className="text-[12px] text-serious">{error}</p>}
    {notice && <p role="status" className="text-[12px] text-emerald-brand">{notice}</p>}
    {preview && <div className="space-y-3">
      <p role="status" className="text-[12px] font-semibold">{t.preview(preview.contacts.length, preview.skipped)}</p>
      {preview.contacts.length > 0 && <div className="overflow-x-auto"><Table head={<>
        <Th>{copy.contacts.table.name}</Th><Th>{copy.contacts.table.type}</Th><Th>{copy.contacts.table.ice}</Th><Th>{copy.contacts.phone}</Th><Th>{copy.contacts.email}</Th><Th>{copy.contacts.table.city}</Th><Th>{copy.contacts.table.balance}</Th>
      </>}><>{preview.contacts.slice(0, 5).map((contact, i) => <tr key={i}>
        <Td>{contact.name}</Td><Td>{copy.contacts.type[contact.type]}</Td><Td>{contact.ice || "—"}</Td><Td>{contact.phone || "—"}</Td><Td>{contact.email || "—"}</Td><Td>{contact.city || "—"}</Td><Td>{contact.balance}</Td>
      </tr>)}</></Table></div>}
    </div>}
    {(preview || reading) && <div className="flex flex-wrap gap-2">
      {preview && preview.contacts.length > 0 && <Btn variant="outline" size="sm" onClick={confirm}><Upload className="h-4 w-4" />{t.confirm}</Btn>}
      <Btn variant="outline" size="sm" onClick={cancel}>{t.cancel}</Btn>
    </div>}
    <p className="text-[11px] leading-relaxed text-muted">{t.privacy}</p>
  </Card>
}
