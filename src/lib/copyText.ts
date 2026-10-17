/**
 * Copy text to the clipboard, everywhere the app runs.
 *
 * `navigator.clipboard.writeText` is the happy path, but it rejects outside a
 * secure context (plain HTTP on a LAN, some WebViews), when the page has no
 * clipboard permission (embedded previews and iframes without the allowlist),
 * or when the browser simply has no async clipboard API. Every copy button in
 * the app used to call it directly, so on those surfaces the button silently
 * did nothing.
 *
 * This helper tries the async API first and falls back to the legacy
 * `execCommand("copy")` path with a temporary off-screen textarea, which works
 * wherever a user gesture is running. It resolves `true` when the text is on
 * the clipboard and `false` when both paths failed, so callers can say
 * "copied" honestly — and only then.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false
  try {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined
    if (clipboard?.writeText) {
      await clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    if (typeof document === "undefined" || typeof document.execCommand !== "function") return false
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.top = "-9999px"
    area.style.left = "-9999px"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.focus({ preventScroll: true })
    area.select()
    try {
      area.setSelectionRange(0, area.value.length)
    } catch {
      // Some browsers throw on setSelectionRange for a hidden field; the
      // select() above is enough for the copy command.
    }
    const ok = document.execCommand("copy")
    document.body.removeChild(area)
    return ok === true
  } catch {
    return false
  }
}
