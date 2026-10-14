import { supabase } from "../../lib/supabase"
import type { LocaleId } from "../../lib/locales"

export type CmsPageSlug = "about" | "faq" | "contact" | "terms" | "privacy"
export type CmsHomepage = {
  locale: LocaleId
  headline: string
  subheadline: string
  primary_cta: string
  feature_cards: Record<string, unknown>[]
  hero_image_url: string
  published: boolean
  updated_at?: string
}
export type CmsPage = {
  id?: string
  slug: CmsPageSlug
  locale: LocaleId
  title: string
  excerpt: string
  body: string
  seo_title: string
  seo_description: string
  canonical_url: string
  noindex: boolean
  published: boolean
  published_at?: string | null
  updated_at?: string
}
export type CmsSeoSetting = {
  route_path: string
  locale: LocaleId
  title: string
  description: string
  canonical_url: string
  indexable: boolean
  published: boolean
  updated_at?: string
}
export type CmsAsset = {
  id: string
  storage_path: string
  public_url: string
  file_name: string
  mime_type: string
  byte_size: number
  width: number | null
  height: number | null
  alt_by_locale: Partial<Record<LocaleId, string>>
  active: boolean
  created_at: string
}
export type CmsFeature = {
  id?: string
  feature_key: string
  locale: LocaleId
  title: string
  description: string
  details: string
  icon: string
  image_url: string
  sort_order: number
  published: boolean
}
export type CmsRelease = {
  id?: string
  version: string
  channel: "stable" | "beta" | "preview"
  title_by_locale: Partial<Record<LocaleId, string>>
  notes_by_locale: Partial<Record<LocaleId, string>>
  fixes: string[]
  compatibility: string
  release_date: string
  published: boolean
}
export type CmsDownload = {
  id?: string
  platform: "web" | "windows" | "macos" | "linux" | "android" | "ios" | "other"
  version: string
  label_by_locale: Partial<Record<LocaleId, string>>
  url: string
  instructions_by_locale: Partial<Record<LocaleId, string>>
  active: boolean
  sort_order: number
}
export type CmsProduct = {
  id?: string
  product_key: string
  locale: LocaleId
  name: string
  description: string
  price_amount: number
  currency: "MAD" | "EUR" | "USD"
  purchase_url: string
  active: boolean
  sort_order: number
}
export type CmsAnnouncement = {
  id?: string
  severity: "info" | "warning" | "critical"
  title_by_locale: Partial<Record<LocaleId, string>>
  body_by_locale: Partial<Record<LocaleId, string>>
  starts_at: string
  ends_at: string | null
  active: boolean
}
export type CmsSupportRequest = {
  id: string
  category: "contact" | "bug" | "feedback" | "feature_request"
  name: string
  email: string
  subject: string
  message: string
  status: "new" | "triaged" | "in_progress" | "resolved" | "closed"
  internal_note: string
  user_id: string | null
  created_at: string
  updated_at: string
}
export type CmsRevision = {
  id: string
  entity_type: string
  entity_id: string
  locale: string
  snapshot: Record<string, unknown>
  actor_id: string | null
  created_at: string
}
export type CmsBackup = { id: string; label: string; created_by: string; created_at: string }

function unwrapError(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

async function listRows<T>(table: string, order = "updated_at"): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*").order(order, { ascending: false }).limit(1000)
  unwrapError(error)
  return (data ?? []) as T[]
}

export async function listHomepageContent(): Promise<CmsHomepage[]> {
  return listRows<CmsHomepage>("cms_homepage_content")
}
export async function saveHomepageContent(row: CmsHomepage, actorId: string): Promise<void> {
  const { error } = await supabase.from("cms_homepage_content").upsert({ ...row, updated_by: actorId }, { onConflict: "locale" })
  unwrapError(error)
}
export async function listManagedPages(): Promise<CmsPage[]> { return listRows<CmsPage>("cms_pages") }
export async function saveManagedPage(row: CmsPage, actorId: string): Promise<void> {
  const { error } = await supabase.from("cms_pages").upsert({ ...row, updated_by: actorId, published_at: row.published ? row.published_at || new Date().toISOString() : row.published_at ?? null }, { onConflict: "slug,locale" })
  unwrapError(error)
}
export async function deleteManagedPage(id: string): Promise<void> { const { error } = await supabase.from("cms_pages").delete().eq("id", id); unwrapError(error) }
export async function listSeoSettings(): Promise<CmsSeoSetting[]> { return listRows<CmsSeoSetting>("cms_seo_settings") }
export async function saveSeoSetting(row: CmsSeoSetting, actorId: string): Promise<void> {
  const { error } = await supabase.from("cms_seo_settings").upsert({ ...row, updated_by: actorId }, { onConflict: "route_path,locale" })
  unwrapError(error)
}
export async function deleteSeoSetting(path: string, locale: LocaleId): Promise<void> { const { error } = await supabase.from("cms_seo_settings").delete().eq("route_path", path).eq("locale", locale); unwrapError(error) }
export async function listAssets(): Promise<CmsAsset[]> { return listRows<CmsAsset>("cms_assets", "created_at") }
export async function uploadCmsAsset(file: File, locale: LocaleId, alt: string): Promise<CmsAsset> {
  const permitted = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"])
  if (!permitted.has(file.type)) throw new Error("الصيغ المدعومة: PNG وJPEG وWebP وSVG فقط.")
  if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("يجب ألا يتجاوز حجم الصورة 10 MB.")
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img"
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from("cms-assets").upload(storagePath, file, { contentType: file.type, cacheControl: "31536000", upsert: false })
  unwrapError(uploadError)
  const { data: publicUrl } = supabase.storage.from("cms-assets").getPublicUrl(storagePath)
  let width: number | null = null
  let height: number | null = null
  if (file.type !== "image/svg+xml" && typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file)
      width = bitmap.width
      height = bitmap.height
      bitmap.close()
    } catch { /* dimensions are optional */ }
  }
  const row = {
    storage_path: storagePath,
    public_url: publicUrl.publicUrl,
    file_name: file.name.slice(0, 255),
    mime_type: file.type,
    byte_size: file.size,
    width,
    height,
    alt_by_locale: { [locale]: alt.trim() },
    active: true,
  }
  const { data, error } = await supabase.from("cms_assets").insert(row).select("*").single()
  if (error) {
    await supabase.storage.from("cms-assets").remove([storagePath])
    throw new Error(error.message)
  }
  return data as CmsAsset
}
export async function updateCmsAsset(row: CmsAsset): Promise<void> {
  const { error } = await supabase.from("cms_assets").update({ active: row.active, alt_by_locale: row.alt_by_locale }).eq("id", row.id)
  unwrapError(error)
}
export async function deleteCmsAsset(row: CmsAsset): Promise<void> {
  const { error } = await supabase.from("cms_assets").delete().eq("id", row.id)
  unwrapError(error)
  const { error: storageError } = await supabase.storage.from("cms-assets").remove([row.storage_path])
  unwrapError(storageError)
}
export async function listFeatures(): Promise<CmsFeature[]> { return listRows<CmsFeature>("cms_features") }
export async function saveFeature(row: CmsFeature, actorId: string): Promise<void> {
  const { error } = await supabase.from("cms_features").upsert({ ...row, updated_by: actorId }, { onConflict: "feature_key,locale" })
  unwrapError(error)
}
export async function deleteFeature(id: string): Promise<void> { const { error } = await supabase.from("cms_features").delete().eq("id", id); unwrapError(error) }
export async function listReleases(): Promise<CmsRelease[]> { return listRows<CmsRelease>("cms_releases", "release_date") }
export async function saveRelease(row: CmsRelease, actorId: string): Promise<void> {
  const { error } = await supabase.from("cms_releases").upsert({ ...row, created_by: actorId }, { onConflict: "version,channel" })
  unwrapError(error)
}
export async function deleteRelease(id: string): Promise<void> { const { error } = await supabase.from("cms_releases").delete().eq("id", id); unwrapError(error) }
export async function listDownloads(): Promise<CmsDownload[]> { return listRows<CmsDownload>("cms_downloads") }
export async function saveDownload(row: CmsDownload, actorId: string): Promise<void> {
  const { error } = await supabase.from("cms_downloads").upsert({ ...row, updated_by: actorId }, row.id ? { onConflict: "id" } : undefined)
  unwrapError(error)
}
export async function deleteDownload(id: string): Promise<void> { const { error } = await supabase.from("cms_downloads").delete().eq("id", id); unwrapError(error) }
export async function listProducts(): Promise<CmsProduct[]> { return listRows<CmsProduct>("cms_products") }
export async function saveProduct(row: CmsProduct, actorId: string): Promise<void> {
  const { error } = await supabase.from("cms_products").upsert({ ...row, updated_by: actorId }, { onConflict: "product_key,locale" })
  unwrapError(error)
}
export async function deleteProduct(id: string): Promise<void> { const { error } = await supabase.from("cms_products").delete().eq("id", id); unwrapError(error) }
export async function listAnnouncements(): Promise<CmsAnnouncement[]> { return listRows<CmsAnnouncement>("cms_announcements", "created_at") }
export async function saveAnnouncement(row: CmsAnnouncement, actorId: string): Promise<void> {
  const { error } = await supabase.from("cms_announcements").upsert({ ...row, created_by: actorId }, row.id ? { onConflict: "id" } : undefined)
  unwrapError(error)
}
export async function deleteAnnouncement(id: string): Promise<void> { const { error } = await supabase.from("cms_announcements").delete().eq("id", id); unwrapError(error) }
export async function listSupportRequests(): Promise<CmsSupportRequest[]> { return listRows<CmsSupportRequest>("cms_support_requests", "created_at") }
export async function updateSupportRequest(row: Pick<CmsSupportRequest, "id" | "status" | "internal_note">): Promise<void> {
  const { error } = await supabase.from("cms_support_requests").update({ status: row.status, internal_note: row.internal_note }).eq("id", row.id)
  unwrapError(error)
}
export async function listCmsRevisions(limit = 200): Promise<CmsRevision[]> {
  const { data, error } = await supabase.from("cms_content_revisions").select("*").order("created_at", { ascending: false }).limit(limit)
  unwrapError(error)
  return (data ?? []) as CmsRevision[]
}
export async function listCmsBackups(): Promise<CmsBackup[]> {
  const { data, error } = await supabase.from("cms_backups").select("id,label,created_by,created_at").order("created_at", { ascending: false }).limit(100)
  unwrapError(error)
  return (data ?? []) as CmsBackup[]
}
export async function createCmsBackup(label: string): Promise<{ id: string; label: string; created_at: string }> {
  const { data, error } = await supabase.rpc("create_cms_backup", { p_label: label })
  unwrapError(error)
  return data as { id: string; label: string; created_at: string }
}
export async function restoreCmsBackup(id: string): Promise<void> {
  const { error } = await supabase.rpc("restore_cms_backup", { p_backup_id: id })
  unwrapError(error)
}
