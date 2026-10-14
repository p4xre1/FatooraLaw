import type { LocaleId } from "./locales"
import { normalizePath } from "./routes"
import type { PublicSiteCmsData } from "./siteCms"

type EmbeddedPayload = { path: string; locale: LocaleId; value: PublicSiteCmsData }

export function readPrerenderedSiteCmsData(path: string, locale: LocaleId): PublicSiteCmsData | undefined {
  if (typeof document === "undefined") return undefined
  const node = document.getElementById("fatorati-site-cms-data")
  if (!node?.textContent) return undefined
  try {
    const payload = JSON.parse(node.textContent) as EmbeddedPayload
    if (normalizePath(payload.path) !== normalizePath(path) || payload.locale !== locale) return undefined
    return payload.value
  } catch {
    return undefined
  }
}
