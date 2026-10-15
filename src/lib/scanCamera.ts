/**
 * Reading a barcode or QR code from the device camera.
 *
 * Two engines, one contract: hand back the first code you read, and a
 * `stop()` that releases the camera.
 *
 *   1. The platform's own `BarcodeDetector` where it exists (Chrome and
 *      Edge on Android/desktop, recent Safari): hardware-fast, no payload.
 *   2. ZXing (`@zxing/browser`) everywhere else — notably iPhone Safari.
 *      It is imported dynamically at first use, so the decoder's weight is
 *      paid only by someone who actually opens the scanner.
 *
 * Both ask for the rear camera (`facingMode: environment`): barcodes live
 * on boxes and shelves, not on faces. Every failure mode the caller cares
 * about arrives as the DOMException name the platform already uses —
 * `NotAllowedError` (refused), `NotFoundError` (no camera), `NotSupportedError`
 * (neither engine) — so the UI can say one honest sentence and fall back to
 * typing the code, which is also how USB/Bluetooth hardware scanners work.
 */

type DetectedBarcode = { rawValue?: string }

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor
  }
}

export type ScanHandle = {
  /** Which engine is reading — shown to the user only when it matters. */
  engine: "native" | "zxing"
  stop: () => void
}

/** True when a camera can even be asked for (secure context + mediaDevices). */
export function cameraAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  )
}

export async function startCameraScan(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
): Promise<ScanHandle> {
  if (!cameraAvailable()) throw new DOMException("No camera API", "NotSupportedError")

  // Engine 1: the platform detector. Asking for the stream first means a
  // refusal fails here with the platform's own error, identically for both
  // engines, instead of deep inside a decoder.
  if (typeof window !== "undefined" && "BarcodeDetector" in window && window.BarcodeDetector) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    })
    video.srcObject = stream
    await video.play().catch(() => undefined)
    const detector = new window.BarcodeDetector()
    let stopped = false
    const timer = window.setInterval(() => {
      if (stopped || video.readyState < 2) return
      void detector
        .detect(video)
        .then((codes) => {
          const value = codes.find((code) => code.rawValue)?.rawValue
          if (value && !stopped) onCode(value)
        })
        .catch(() => undefined) // a dark frame is not an error worth showing
    }, 200)
    return {
      engine: "native",
      stop: () => {
        stopped = true
        window.clearInterval(timer)
        stream.getTracks().forEach((track) => track.stop())
        video.srcObject = null
      },
    }
  }

  // Engine 2: ZXing, lazily. decodeFromVideoDevice opens the rear camera by
  // preference order on most devices; undefined deviceId = default camera.
  const { BrowserMultiFormatReader } = await import("@zxing/browser")
  const reader = new BrowserMultiFormatReader()
  let stopped = false
  const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
    const value = result?.getText()
    if (value && !stopped) onCode(value)
  })
  return {
    engine: "zxing",
    stop: () => {
      stopped = true
      controls.stop()
    },
  }
}
