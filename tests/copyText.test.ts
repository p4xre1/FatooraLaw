import { afterEach, describe, expect, it, vi } from "vitest"
import { copyText } from "../src/lib/copyText"

/**
 * The clipboard helper every copy button goes through: the async API first,
 * the legacy execCommand path when that API is missing or refuses, and an
 * honest `false` when neither works — so a button only ever says "copied"
 * when the text is really on the clipboard.
 */
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard")
const originalExecCommand = (document as unknown as { execCommand?: unknown }).execCommand

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard)
  else delete (navigator as unknown as { clipboard?: unknown }).clipboard
  if (typeof originalExecCommand === "function") {
    (document as unknown as { execCommand: unknown }).execCommand = originalExecCommand
  } else {
    delete (document as unknown as { execCommand?: unknown }).execCommand
  }
  document.body.innerHTML = ""
})

describe("copyText", () => {
  it("uses the async clipboard when it works", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    await expect(copyText("FT-7K4M-92QD")).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith("FT-7K4M-92QD")
  })

  it("falls back to execCommand when the async clipboard rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"))
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    const execCommand = vi.fn().mockReturnValue(true)
    ;(document as unknown as { execCommand: unknown }).execCommand = execCommand
    await expect(copyText("PRO-1M-A1B2C3D4")).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith("copy")
    // The helper textarea is removed again.
    expect(document.querySelector("textarea")).toBeNull()
  })

  it("falls back when there is no async clipboard at all", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true })
    ;(document as unknown as { execCommand: unknown }).execCommand = vi.fn().mockReturnValue(true)
    await expect(copyText("hello")).resolves.toBe(true)
    expect(document.querySelector("textarea")).toBeNull()
  })

  it("says false when both paths fail", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"))
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    ;(document as unknown as { execCommand: unknown }).execCommand = vi.fn().mockReturnValue(false)
    await expect(copyText("hello")).resolves.toBe(false)
  })

  it("says false with nothing to copy", async () => {
    await expect(copyText("")).resolves.toBe(false)
  })
})
