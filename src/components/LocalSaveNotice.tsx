import { useEffect, useState } from "react"
import { AlertTriangle, Download } from "lucide-react"
import { accountStorageKey, useMizan } from "../store/useMizan"
import { useLocalSaveStatus } from "../lib/localSaveStatus"
import { exportCurrentBackup } from "../lib/legacyBackup"
import { useTranslation } from "../lib/language/store"
import { Btn } from "./kit"

export default function LocalSaveNotice() {
  const auth = useMizan((s) => s.auth)
  const issue = useLocalSaveStatus((s) => s.issue)
  const { t: copy } = useTranslation()
  const t = copy.localSave
  const [exportError, setExportError] = useState<string | null>(null)
  const affected = !!auth && issue?.key === accountStorageKey(auth.id)
  useEffect(() => {
    if (!affected) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [affected])
  if (!affected) return null
  return (
    <div role="alert" className="mb-5 space-y-3 rounded-xl border border-warn/30 bg-warn-50 p-4 text-sm text-warn">
      <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{t.failure}</span></p>
      <Btn variant="outline" size="sm" onClick={() => {
        try { exportCurrentBackup(); setExportError(null) }
        catch { setExportError(t.exportError) }
      }}><Download className="h-4 w-4" /> {t.export}</Btn>
      {exportError && <p>{exportError}</p>}
    </div>
  )
}
