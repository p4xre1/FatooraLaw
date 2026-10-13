export const MAX_LOGO_BYTES = 512 * 1024
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const
export const LOGO_SIZE_MESSAGE = "Le logo ne doit pas dépasser 512 Ko."
export const LOGO_TYPE_MESSAGE = "Choisissez une image PNG, JPEG, WebP ou GIF."

export function validateLogoFile(file: Pick<File, "type" | "size">) {
  if (!LOGO_TYPES.includes(file.type as typeof LOGO_TYPES[number])) throw new Error(LOGO_TYPE_MESSAGE)
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error("Le fichier du logo est vide.")
  if (file.size > MAX_LOGO_BYTES) throw new Error(LOGO_SIZE_MESSAGE)
}

/** Bound the saved payload too; file-input accept/type hints are not validation. */
export function validateLogoDataURL(value: unknown) {
  if (value === null) return
  if (typeof value !== "string" || value.length > 4 * Math.ceil(MAX_LOGO_BYTES / 3) + 64) throw new Error(LOGO_SIZE_MESSAGE)
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match || match[2].length % 4 !== 0) throw new Error(LOGO_TYPE_MESSAGE)
  const body = match[2]
  const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0
  if ((body.length / 4) * 3 - padding > MAX_LOGO_BYTES) throw new Error(LOGO_SIZE_MESSAGE)
  // Check the raster signature as well as the declared MIME; decode only a short prefix.
  const header = atob(body.slice(0, 32))
  const valid = match[1] === "png" ? header.startsWith("\x89PNG\r\n\x1a\n")
    : match[1] === "jpeg" ? header.startsWith("\xff\xd8\xff")
    : match[1] === "gif" ? /^(GIF87a|GIF89a)/.test(header)
    : header.startsWith("RIFF") && header.slice(8, 12) === "WEBP"
  if (!valid) throw new Error("Le contenu du fichier ne correspond pas au format d'image annoncé.")
}
