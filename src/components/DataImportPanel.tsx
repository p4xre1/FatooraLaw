import { useEffect, useMemo, useRef, useState } from "react"
import { Download, FileUp, Upload } from "lucide-react"
import { accountStorageKey, useMizan } from "../store/useMizan"
import { useTranslation } from "../lib/language/store"
import { useLocalSaveStatus } from "../lib/localSaveStatus"
import {
  DataImportError, IMPORT_DATASETS, IMPORT_MAX_BYTES, downloadImportTemplate, importColumnList,
  importPlan, parseImport, type ImportDataset, type ImportResult,
} from "../lib/dataImport"
import { Btn, Card, Field, Select, Table, Td, Th } from "./kit"

/**
 * Import any collection of the workspace from a CSV.
 *
 * The flow is deliberately the same for all nine record types — pick the type,
 * take its template, drop the file, read the preview, confirm — because the
 * risky part is never the parsing: it is a person believing their file landed
 * when it did not, or landing it in the wrong account. So:
 *
 * - every read is tagged with a revision and the owner's id, and a result that
 *   comes back after a sign-out, an account switch, a type change or an
 *   unmount is dropped;
 * - the preview is built from the file, not from the workspace, and the
 *   workspace is only written when Import is clicked;
 * - a storage failure after the write is reported as a failure, not as success.
 */
export default function DataImportPanel() {
  const { t: copy } = useTranslation()
  const t = copy.dataImport
  const ownerId = useMizan((state) => state.auth?.id)
  const [dataset, setDataset] = useState<ImportDataset>("contacts")
  const [pending, setPending] = useState<{ ownerId: string; dataset: ImportDataset; result: ImportResult } | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const revision = useRef(0)
  const input = useRef<HTMLInputElement>(null)

  function reset() {
    revision.current++
    setPending(null)
    setReading(false)
    setError("")
    setNotice("")
    if (input.current) input.current.value = ""
  }
  // A file read for one account or one record type must never land in another.
  useEffect(() => {
    reset()
    return () => { revision.current++ }
  }, [ownerId, dataset])

  const live = pending && pending.ownerId === ownerId && pending.dataset === dataset ? pending.result : null
  // Measured once per parsed file: fingerprinting ten thousand rows is not
  // work to repeat on every render of the Settings screen.
  const plan = useMemo(() => (live ? importPlan(live, useMizan.getState()) : null), [live])

  function message(cause: unknown): string {
    if (!(cause instanceof DataImportError)) return cause instanceof Error && cause.message ? cause.message : t.readError
    const { code, column, expected } = cause
    const text =
      code === "empty" ? t.errors.empty
      : code === "csv" ? t.errors.csv
      : code === "header" ? t.errors.header(expected || importColumnList(dataset))
      : code === "rows" ? t.errors.rows(expected)
      : code === "choice" ? t.errors.choice(column, expected)
      : t.errors[code](column)
    return cause.row ? t.row(cause.row, text) : text
  }

  async function readFile(file?: File) {
    const current = ++revision.current
    const owner = ownerId
    setPending(null); setError(""); setNotice("")
    if (!file || !owner) { setReading(false); return }
    setReading(true)
    try {
      if (file.size > IMPORT_MAX_BYTES) throw new Error(t.tooLarge)
      if (!/\.(csv|txt|tsv)$/i.test(file.name)) throw new Error(t.readError)
      const text = await file.text()
      if (current !== revision.current || useMizan.getState().auth?.id !== owner) return
      setPending({ ownerId: owner, dataset, result: parseImport(dataset, text, useMizan.getState()) })
    } catch (cause) {
      if (current !== revision.current || useMizan.getState().auth?.id !== owner) return
      setError(message(cause))
    } finally {
      if (current === revision.current) setReading(false)
    }
  }

  function confirm() {
    if (!live || !ownerId || useMizan.getState().auth?.id !== ownerId) return
    try {
      // Re-measure against the records as they are now: the user may have added
      // one by hand while this preview was on screen.
      const fresh = importPlan(live, useMizan.getState())
      if (fresh.added) useMizan.getState().importRecords(fresh.payload)
      setPending(null)
      if (input.current) input.current.value = ""
      if (useLocalSaveStatus.getState().issue?.key === accountStorageKey(ownerId)) setError(t.savedWarning)
      else setNotice(fresh.added ? t.success(fresh.added, fresh.skipped) : t.nothing)
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : t.failed)
    }
  }

  return <Card className="space-y-3 p-4">
    <h2 className="flex items-center gap-2 text-[14px] font-bold"><FileUp className="h-4 w-4 text-brand" />{t.title}</h2>
    <p className="text-[12.5px] leading-relaxed text-muted">{t.steps}</p>

    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t.dataset}>
        <Select value={dataset} onChange={(event) => setDataset(event.target.value as ImportDataset)}>
          {IMPORT_DATASETS.map((key) => <option key={key} value={key}>{t.datasets[key]}</option>)}
        </Select>
      </Field>
      <Field label={t.file}>
        <input
          ref={input}
          type="file"
          accept=".csv,.tsv,text/csv"
          disabled={!ownerId}
          className="block w-full text-[12px] text-muted file:me-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-ink"
          onChange={(event) => { void readFile(event.target.files?.[0]) }}
        />
      </Field>
    </div>

    <p className="text-[12px] leading-relaxed text-muted">{t.hints[dataset]}</p>
    <p className="text-[12px] leading-relaxed text-muted"><span className="font-semibold text-ink">{t.columns}:</span> <span dir="ltr" className="font-mono text-[11.5px]">{importColumnList(dataset)}</span></p>
    <p className="text-[11.5px] leading-relaxed text-faint">{t.columnsHint} {t.limits}</p>

    <Btn variant="outline" size="sm" onClick={() => {
      try { downloadImportTemplate(dataset); setError("") } catch { setError(t.failed) }
    }}><Download className="h-4 w-4" />{t.template} · {t.datasets[dataset]}</Btn>

    {reading && <p role="status" className="text-[12px] text-muted">{t.reading}</p>}
    {error && <p role="alert" className="text-[12px] text-serious">{error}</p>}
    {notice && <p role="status" className="text-[12px] text-emerald-brand">{notice}</p>}

    {live && plan && <div className="space-y-3">
      <p role="status" className="text-[12px] font-semibold">{t.preview(plan.added, plan.skipped)}</p>
      {plan.newContacts > 0 && <p className="text-[12px] text-muted">{t.previewClients(plan.newContacts)}</p>}
      {live.preview.length > 0 && <div className="overflow-x-auto">
        <Table head={<>{live.headers.map((header) => <Th key={header}>{header}</Th>)}</>}>
          <>{live.preview.map((row, index) => <tr key={index}>
            {row.map((cell, cellIndex) => <Td key={cellIndex}>{cell || "—"}</Td>)}
          </tr>)}</>
        </Table>
      </div>}
    </div>}

    {(live || reading) && <div className="flex flex-wrap gap-2">
      {live && plan && plan.added > 0 && <Btn variant="outline" size="sm" onClick={confirm}><Upload className="h-4 w-4" />{t.confirm}</Btn>}
      <Btn variant="outline" size="sm" onClick={reset}>{t.cancel}</Btn>
    </div>}

    <p className="text-[11px] leading-relaxed text-muted">{t.privacy}</p>
  </Card>
}
