import { PLAN_SALES_WHATSAPP } from "./plans"

export const CLOUD_BUCKET = "business-backups"
export const CLOUD_INCLUDED_BYTES = 100_000_000
export const CLOUD_ADDON_USD_PER_GB_MONTH = 2
export const CLOUD_MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024

export type CloudQuota = {
  allowed: boolean
  limit_bytes: number
  used_bytes: number
  capacity_bytes: number
  project_used_bytes: number
  addons_enabled: boolean
}

export function storagePurchaseLink(gb = 1): string {
  if (!Number.isInteger(gb) || gb < 1 || gb > 1000) throw new Error("Invalid storage quantity")
  const text = `Bonjour Fatorati, je souhaite ajouter ${gb} GB de stockage cloud à mon compte PRO/BOOST : ${gb * CLOUD_ADDON_USD_PER_GB_MONTH} USD/mois. Merci de confirmer la disponibilité avant paiement.`
  return `https://wa.me/${PLAN_SALES_WHATSAPP}?text=${encodeURIComponent(text)}`
}
