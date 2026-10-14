import type { LocaleId } from "./locales"
import { localeRoute, type LandingPage } from "./routes"
import { isSupabaseConfigured, supabase } from "./supabase"

export type PublicCmsHomepage = {
  locale: LocaleId
  headline: string
  subheadline: string
  primary_cta: string
  hero_image_url: string
  feature_cards: Record<string, unknown>[]
  updated_at: string
}
export type PublicCmsPage = {
  id: string
  slug: "about" | "faq" | "contact" | "terms" | "privacy"
  locale: LocaleId
  title: string
  excerpt: string
  body: string
  seo_title: string
  seo_description: string
  canonical_url: string
  noindex: boolean
  published_at: string | null
  updated_at: string
}
export type PublicCmsSeo = {
  route_path: string
  locale: LocaleId
  title: string
  description: string
  canonical_url: string
  indexable: boolean
  updated_at: string
}
export type PublicCmsFeature = {
  feature_key: string
  locale: LocaleId
  title: string
  description: string
  details: string
  icon: string
  image_url: string
  sort_order: number
}
export type PublicCmsAnnouncement = {
  id: string
  severity: "info" | "warning" | "critical"
  title_by_locale: Partial<Record<LocaleId, string>>
  body_by_locale: Partial<Record<LocaleId, string>>
  starts_at: string
  ends_at: string | null
}
export type PublicCmsRelease = {
  version: string
  channel: "stable" | "beta" | "preview"
  title_by_locale: Partial<Record<LocaleId, string>>
  notes_by_locale: Partial<Record<LocaleId, string>>
  fixes: string[]
  compatibility: string
  release_date: string
}
export type PublicCmsDownload = {
  platform: string
  version: string
  label_by_locale: Partial<Record<LocaleId, string>>
  url: string
  instructions_by_locale: Partial<Record<LocaleId, string>>
  sort_order: number
}
export type PublicCmsProduct = {
  product_key: string
  locale: LocaleId
  name: string
  description: string
  price_amount: number
  currency: "MAD" | "EUR" | "USD"
  purchase_url: string
  sort_order: number
}
export type PublicSiteCmsData = {
  path: string
  locale: LocaleId
  homepage: PublicCmsHomepage | null
  page: PublicCmsPage | null
  seo: PublicCmsSeo | null
  features: PublicCmsFeature[]
  announcements: PublicCmsAnnouncement[]
  releases: PublicCmsRelease[]
  downloads: PublicCmsDownload[]
  products: PublicCmsProduct[]
}

export async function getPublishedSiteCmsData(
  path: string,
  locale: LocaleId,
  client: typeof supabase = supabase,
): Promise<PublicSiteCmsData> {
  const normalized = localeRoute(path).path
  const base = normalized === "/" ? "/" : normalized
  if (!isSupabaseConfigured) return { path, locale, homepage: null, page: null, seo: null, features: [], announcements: [], releases: [], downloads: [], products: [] }
  const [homepageResult, pageResult, seoResult, featuresResult, announcementsResult, releasesResult, downloadsResult, productsResult] = await Promise.all([
    client.from("cms_homepage_content").select("locale,headline,subheadline,primary_cta,hero_image_url,feature_cards,updated_at").eq("locale", locale).eq("published", true).maybeSingle(),
    client.from("cms_pages").select("id,slug,locale,title,excerpt,body,seo_title,seo_description,canonical_url,noindex,published_at,updated_at").eq("slug", base.slice(1)).eq("locale", locale).eq("published", true).maybeSingle(),
    client.from("cms_seo_settings").select("route_path,locale,title,description,canonical_url,indexable,updated_at").eq("route_path", base).eq("locale", locale).eq("published", true).maybeSingle(),
    client.from("cms_features").select("feature_key,locale,title,description,details,icon,image_url,sort_order").eq("locale", locale).eq("published", true).order("sort_order", { ascending: true }).limit(50),
    client.from("cms_announcements").select("id,severity,title_by_locale,body_by_locale,starts_at,ends_at").eq("active", true).lte("starts_at", new Date().toISOString()).order("starts_at", { ascending: false }).limit(10),
    client.from("cms_releases").select("version,channel,title_by_locale,notes_by_locale,fixes,compatibility,release_date").eq("published", true).order("release_date", { ascending: false }).limit(10),
    client.from("cms_downloads").select("platform,version,label_by_locale,url,instructions_by_locale,sort_order").eq("active", true).order("sort_order", { ascending: true }).limit(50),
    client.from("cms_products").select("product_key,locale,name,description,price_amount,currency,purchase_url,sort_order").eq("locale", locale).eq("active", true).order("sort_order", { ascending: true }).limit(50),
  ])
  for (const result of [homepageResult, pageResult, seoResult, featuresResult, announcementsResult, releasesResult, downloadsResult, productsResult]) {
    if (result.error) throw new Error(result.error.message)
  }
  const announcements = (announcementsResult.data ?? []).filter((row) => !row.ends_at || new Date(row.ends_at).getTime() > Date.now())
  return {
    path,
    locale,
    homepage: (homepageResult.data as PublicCmsHomepage | null) ?? null,
    page: (pageResult.data as PublicCmsPage | null) ?? null,
    seo: (seoResult.data as PublicCmsSeo | null) ?? null,
    features: (featuresResult.data ?? []) as PublicCmsFeature[],
    announcements: announcements as PublicCmsAnnouncement[],
    releases: (releasesResult.data ?? []) as PublicCmsRelease[],
    downloads: (downloadsResult.data ?? []) as PublicCmsDownload[],
    products: (productsResult.data ?? []) as PublicCmsProduct[],
  }
}

export function getSeoRoutePath(page: LandingPage): string {
  return page === "home" ? "/" : `/${page}`
}

export async function submitCmsSupportRequest(input: {
  category: "contact" | "bug" | "feedback" | "feature_request"
  name: string
  email: string
  subject: string
  message: string
}): Promise<string> {
  const { data, error } = await supabase.rpc("submit_cms_support_request", {
    p_category: input.category,
    p_name: input.name.trim(),
    p_email: input.email.trim(),
    p_subject: input.subject.trim(),
    p_message: input.message.trim(),
  })
  if (error) throw new Error(error.message)
  return String(data)
}
