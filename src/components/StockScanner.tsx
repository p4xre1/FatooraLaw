import { useEffect, useRef, useState } from "react"
import { Camera, Package, Plus, RotateCcw, Search, Wrench } from "lucide-react"
import { Badge, Btn, Field, Input, Modal } from "./kit"
import { useMizan } from "../store/useMizan"
import { useTranslation } from "../lib/language/store"
import { findStockByCode, isUsableCode, normalizeSku } from "../lib/barcode"
import { cameraAvailable, startCameraScan, type ScanHandle } from "../lib/scanCamera"
import { MAX_QUANTITY, parseAmount } from "../lib/businessValidation"

/**
 * The stock scanner: one code in, the article in front of you.
 *
 * Three ways in, in the order a stockroom actually uses them: the phone
 * camera (platform `BarcodeDetector`, ZXing where the platform has none —
 * see lib/scanCamera.ts), a hardware scanner (USB/Bluetooth readers type
 * the code and press Enter, which the manual field simply receives), and
 * typing. All three land in the same lookup, by SKU, exact after
 * normalization (lib/barcode.ts): a found article offers Entrée/Sortie on
 * the spot; an unknown code offers to create the article with that code —
 * which is how a delivery gets stocked.
 *
 * Included in PRO and BOOST: the scanner lives on the Stock & Matériel
 * page, which those plans already unlock.
 */
export default function StockScanner({
  onClose,
  onCreateWithSku,
}: {
  onClose: () => void
  onCreateWithSku: (sku: string) => void
}) {
  const { t: copy } = useTranslation()
  const t = copy.inventory
  const { stock, projects, adjustStock } = useMizan()

  const [code, setCode] = useState("")
  const [foundId, setFoundId] = useState<string | null>(null)
  const [missed, setMissed] = useState<string | null>(null)
  const [amount, setAmount] = useState("1")
  const [moved, setMoved] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const handleRef = useRef<ScanHandle | null>(null)

  /** The found article, read live so Entrée/Sortie repaint its level. */
  const item = foundId ? stock.find((entry) => entry.id === foundId) : undefined

  function stopCamera() {
    handleRef.current?.stop()
    handleRef.current = null
    setCameraOn(false)
  }

  // The camera is released whatever door the modal leaves by.
  useEffect(() => () => handleRef.current?.stop(), [])

  function lookup(raw: string) {
    if (!isUsableCode(raw)) return
    const value = normalizeSku(raw)
    stopCamera()
    setMoved(null)
    setMoveError(null)
    setAmount("1")
    const hit = findStockByCode(stock, value)
    if (hit) {
      setFoundId(hit.id)
      setMissed(null)
      try { navigator.vibrate?.(40) } catch { /* a silent phone is fine */ }
    } else {
      setFoundId(null)
      setMissed(value)
    }
  }

  async function startCamera() {
    setCameraError(false)
    if (!videoRef.current) return
    try {
      handleRef.current = await startCameraScan(videoRef.current, lookup)
      setCameraOn(true)
    } catch {
      // Refused, absent or unreadable: one honest sentence, typing remains.
      setCameraError(true)
      setCameraOn(false)
    }
  }

  function adjust(sign: 1 | -1) {
    if (!item) return
    const n = parseAmount(amount, false, MAX_QUANTITY)
    if (n === null || n <= 0) {
      setMoveError(t.amountError)
      return
    }
    try {
      adjustStock(item.id, sign * n)
      setMoveError(null)
      setMoved(t.scan.moved(sign * n, Math.max(0, item.qty + sign * n), item.unit))
    } catch (err) {
      setMoved(null)
      setMoveError(err instanceof Error ? err.message : t.amountError)
    }
  }

  function reset() {
    setCode("")
    setFoundId(null)
    setMissed(null)
    setMoved(null)
    setMoveError(null)
  }

  const amountValue = parseAmount(amount, false, MAX_QUANTITY)

  return (
    <Modal title={t.scan.title} onClose={() => { stopCamera(); onClose() }}>
      <div className="space-y-4">
        <p className="text-[12.5px] text-muted">{t.scan.hint}</p>

        {/* ---- Camera ---- */}
        <div className="overflow-hidden rounded-xl border border-line bg-night">
          <video ref={videoRef} className={`h-44 w-full object-cover ${cameraOn ? "" : "hidden"}`} muted playsInline aria-hidden="true" />
          {!cameraOn && (
            <div className="grid h-28 place-items-center p-4">
              <Btn variant="outline" onClick={() => void startCamera()} disabled={!cameraAvailable()}>
                <Camera className="h-4 w-4" /> {t.scan.startCamera}
              </Btn>
            </div>
          )}
          {cameraOn && (
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <p className="text-[12px] font-medium text-white/85">{t.scan.scanning}</p>
              <button type="button" onClick={stopCamera} className="text-[12px] font-semibold text-white underline-offset-2 hover:underline">
                {t.scan.manualLabel}
              </button>
            </div>
          )}
        </div>
        {cameraError && <p role="alert" className="text-[12.5px] text-warn">{t.scan.cameraError}</p>}

        {/* ---- Code entry: typing, or a hardware scanner typing ---- */}
        <form
          onSubmit={(event) => { event.preventDefault(); lookup(code) }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <Field label={t.scan.manualLabel}>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={t.scan.manualPlaceholder}
                className="font-mono"
                dir="ltr"
                autoFocus
              />
            </Field>
          </div>
          <Btn type="submit" disabled={!isUsableCode(code)}>
            <Search className="h-4 w-4" /> {t.scan.lookup}
          </Btn>
        </form>

        {/* ---- Found: the article, and the two moves a scan is for ---- */}
        {item && (
          <div className="rounded-xl border border-line bg-canvas/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="inline-flex items-center gap-2 text-[15px] font-bold text-ink">
                  {item.type === "equipment" ? <Wrench className="h-4 w-4 text-muted" aria-hidden="true" /> : <Package className="h-4 w-4 text-muted" aria-hidden="true" />}
                  {item.name}
                </p>
                <p className="mt-0.5 font-mono text-[11.5px] text-muted" dir="ltr">{item.sku}</p>
                <p className="mt-1 text-[12px] text-muted">
                  {projects.find((p) => p.id === item.assignedProjectId)?.name ?? t.unassigned} · {t.table.threshold} : {item.minQty} {item.unit}
                </p>
              </div>
              <Badge tone={item.qty <= 0 ? "serious" : item.qty < item.minQty ? "warn" : "good"}>
                {item.qty <= 0 ? t.scan.out : item.qty < item.minQty ? t.scan.low : t.scan.inStock}
              </Badge>
            </div>

            <p className="tnum mt-3 font-display text-[26px] font-bold leading-none text-ink">
              {item.qty} <span className="text-[14px] font-semibold text-muted">{item.unit}</span>
            </p>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="w-24">
                <Field label={t.quantity}>
                  <Input type="number" min={0} step="any" className="tnum" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </Field>
              </div>
              <Btn variant="emerald" onClick={() => adjust(1)} disabled={amountValue === null || amountValue <= 0}>{t.scan.entry}</Btn>
              <Btn variant="outline" onClick={() => adjust(-1)} disabled={item.qty <= 0 || amountValue === null || amountValue <= 0}>{t.scan.exit}</Btn>
            </div>
            {moved && <p role="status" className="tnum mt-2 text-[12.5px] font-semibold text-emerald-700">{moved}</p>}
            {moveError && <p role="alert" className="mt-2 text-[12.5px] text-serious">{moveError}</p>}
          </div>
        )}

        {/* ---- Unknown code: stocking starts here ---- */}
        {missed && (
          <div className="rounded-xl border border-dashed border-line-strong p-4 text-center">
            <p className="text-[13px] font-medium text-ink">{t.scan.notFound(missed)}</p>
            <Btn className="mt-3" onClick={() => onCreateWithSku(missed)}>
              <Plus className="h-4 w-4" /> {t.scan.createWithCode}
            </Btn>
          </div>
        )}

        {(item || missed) && (
          <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {t.scan.scanAnother}
          </button>
        )}
      </div>
    </Modal>
  )
}
