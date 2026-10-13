import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import Settings from "../src/modules/Settings"
import { useMizan } from "../src/store/useMizan"
import { MAX_LOGO_BYTES, validateLogoDataURL, validateLogoFile } from "../src/lib/logoValidation"

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6HukAAAAASUVORK5CYII="
const GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
const readers: ControlledReader[] = []
class ControlledReader {
  static LOADING = 1
  readyState = 0
  result: string | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  constructor() { readers.push(this) }
  readAsDataURL = vi.fn(() => { this.readyState = 1 })
  abort = vi.fn(() => { this.readyState = 2; this.onabort?.() })
  complete(result: string) { this.result = result; this.readyState = 2; this.onload?.() }
}
const pngFile = () => new File([Uint8Array.from(atob(PNG.split(",")[1]), (char) => char.charCodeAt(0))], "logo.png", { type: "image/png" })
const upload = (file: File) => fireEvent.change(screen.getByLabelText("Fichier du logo"), { target: { files: [file] } })

beforeEach(() => {
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("Tester", "tester@gmail.com", "owner", "logos-account")
  readers.length = 0
  vi.stubGlobal("FileReader", ControlledReader)
})
afterEach(() => vi.unstubAllGlobals())

it("bounds file sizes, rejects empty/unsupported files, and checks the payload's raster signature", () => {
  expect(() => validateLogoFile({ size: MAX_LOGO_BYTES, type: "image/png" })).not.toThrow()
  expect(() => validateLogoFile({ size: MAX_LOGO_BYTES + 1, type: "image/png" })).toThrow(/512/)
  expect(() => validateLogoFile({ size: 0, type: "image/png" })).toThrow()
  expect(() => validateLogoFile({ size: 10, type: "image/svg+xml" })).toThrow()
  expect(() => validateLogoDataURL(PNG)).not.toThrow()
  expect(() => validateLogoDataURL(GIF)).not.toThrow()
  expect(() => validateLogoDataURL("data:image/png;base64," + btoa("<svg><script/></svg>"))).toThrow()
  expect(() => validateLogoDataURL("https://example.invalid/logo.png")).toThrow()
})

it("rejects a direct oversized or non-raster settings patch before mutating any settings", () => {
  const previous = useMizan.getState().settings
  for (const logo of ["data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "data:image/png;base64," + "A".repeat(4 * Math.ceil(MAX_LOGO_BYTES / 3) + 4)]) {
    expect(() => useMizan.getState().updateSettings({ logo, company: "Must not apply" })).toThrow()
    expect(useMizan.getState().settings).toBe(previous)
  }
})

it("rejects an oversized upload before allocating a reader and keeps the previous logo", () => {
  useMizan.getState().updateSettings({ logo: PNG })
  render(<Settings />)
  upload(new File([new Uint8Array(MAX_LOGO_BYTES + 1)], "large.png", { type: "image/png" }))
  expect(readers).toHaveLength(0)
  expect(screen.getByRole("alert").textContent).toContain("512 Ko")
  expect(screen.getByAltText("Logo").getAttribute("src")).toBe(PNG)
})

it("rejects SVG uploads before reading and allows uploading a supported raster next", () => {
  render(<Settings />)
  upload(new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }))
  expect(readers).toHaveLength(0)
  expect(screen.getByRole("alert").textContent).toContain("PNG")
  upload(pngFile())
  expect(readers).toHaveLength(1)
  expect(screen.queryByRole("alert")).toBeNull()
})

it("disables save while the logo is loading, then previews and persists a bounded image", () => {
  render(<Settings />)
  upload(pngFile())
  const save = screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement
  expect(save.disabled).toBe(true)
  act(() => readers[0].complete(PNG))
  expect(save.disabled).toBe(false)
  expect(screen.getByAltText("Logo").getAttribute("src")).toBe(PNG)
  fireEvent.click(save)
  expect(useMizan.getState().settings.logo).toBe(PNG)
})

it("catches reader errors without deleting the saved logo or leaving save permanently disabled", () => {
  useMizan.getState().updateSettings({ logo: PNG })
  render(<Settings />)
  upload(pngFile())
  act(() => { readers[0].readyState = 2; readers[0].onerror?.() })
  expect(screen.getByRole("alert").textContent).toContain("Lecture du logo impossible")
  expect(screen.getByAltText("Logo").getAttribute("src")).toBe(PNG)
  expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(false)
})

it("ignores a canceled reader's late result after the user selects another file", () => {
  render(<Settings />)
  upload(pngFile())
  const first = readers[0]
  const lateCallback = first.onload!
  upload(new File(["GIF89a"], "new.gif", { type: "image/gif" }))
  expect(first.abort).toHaveBeenCalledOnce()
  act(() => { first.result = PNG; lateCallback() })
  expect(screen.queryByAltText("Logo")).toBeNull()
  act(() => readers[1].complete(GIF))
  expect(screen.getByAltText("Logo").getAttribute("src")).toBe(GIF)
})

it("cancels pending logo reads when removing the logo and when unmounting settings", () => {
  useMizan.getState().updateSettings({ logo: PNG })
  const view = render(<Settings />)
  upload(pngFile())
  const first = readers[0]
  const lateCallback = first.onload!
  fireEvent.click(screen.getByRole("button", { name: "retirer" }))
  expect(first.abort).toHaveBeenCalledOnce()
  act(() => { first.result = PNG; lateCallback() })
  expect(screen.queryByAltText("Logo")).toBeNull()
  upload(pngFile())
  view.unmount()
  expect(readers[1].abort).toHaveBeenCalledOnce()
  expect(readers[1].onload).toBeNull()
})
