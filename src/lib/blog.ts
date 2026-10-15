import { supabase } from "./supabase"
import type { LocaleId } from "./locales"
import { BLOG_CATEGORIES, blogCategory, type BlogCategory } from "./routes"

/**
 * The five editorial sections of the blog, re-exported from `routes.ts` (the
 * URL contract owns the keys — they are path segments under `/blog/`). The
 * localized display labels live here, next to the rest of the public copy.
 */
export { BLOG_CATEGORIES, blogCategory, type BlogCategory }

export type BlogTranslationLocale = Exclude<LocaleId, "fr">

/** Sidebar labels, per locale. Never used in a URL. */
export const BLOG_CATEGORY_LABELS: Record<BlogCategory, Record<LocaleId, string>> = {
  tips: { fr: "Conseils", en: "Tips", ar: "نصائح" },
  news: { fr: "Actualités", en: "News", ar: "أخبار" },
  articles: { fr: "Articles", en: "Articles", ar: "مقالات" },
  products: { fr: "Produits", en: "Products", ar: "منتجات" },
  guides: { fr: "Guides", en: "Guides", ar: "أدلة" },
}

export type BlogContent = {
  title: string
  slug: string
  content: string
  excerpt: string
  seo_title: string
  seo_description: string
  keywords: string[]
  image_url?: string
  image_alt?: string
  image_source?: "r2" | "supabase" | "url" | "none"
  viral_score?: number // 0-100 calculated from SEO standards
}

export type BlogTranslation = BlogContent & {
  post_id: string
  locale: BlogTranslationLocale
  updated_at: string
}

export type BlogPost = BlogContent & {
  id: string
  author_name: string
  category: BlogCategory
  published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
  user_id: string
  translations: Partial<Record<BlogTranslationLocale, BlogTranslation>>
}

export type PublicBlogPost = BlogContent & {
  id: string
  locale: LocaleId
  author_name: string
  category: BlogCategory
  published_at: string
  updated_at: string
  canonical_slug_fr: string
  translations: Partial<Record<LocaleId, BlogContent & { slug: string }>>
}

const BASE_COLUMNS = "id,title,slug,content,excerpt,seo_title,seo_description,keywords,author_name,category,image_url,image_alt,published,published_at,created_at,updated_at,user_id"
const TRANSLATION_COLUMNS = "post_id,locale,title,slug,content,excerpt,seo_title,seo_description,keywords,updated_at"

function asKeywords(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []
}

function toBase(post: Record<string, unknown>, translations: BlogTranslation[] = []): BlogPost {
  const mapped: BlogPost = {
    id: String(post.id),
    title: String(post.title ?? ""),
    slug: String(post.slug ?? ""),
    content: String(post.content ?? ""),
    excerpt: String(post.excerpt ?? ""),
    seo_title: String(post.seo_title ?? ""),
    seo_description: String(post.seo_description ?? ""),
    keywords: asKeywords(post.keywords),
    author_name: String(post.author_name ?? "Fatorati"),
    category: blogCategory(post.category),
    image_url: String(post.image_url ?? ""),
    image_alt: String(post.image_alt ?? ""),
    published: post.published === true,
    published_at: typeof post.published_at === "string" ? post.published_at : null,
    created_at: String(post.created_at ?? ""),
    updated_at: String(post.updated_at ?? ""),
    user_id: String(post.user_id ?? ""),
    translations: {},
  }
  for (const translation of translations) mapped.translations[translation.locale] = translation
  return mapped
}

async function readTranslations(postIds: string[], client: typeof supabase = supabase): Promise<BlogTranslation[]> {
  if (!postIds.length) return []
  const { data, error } = await client.from("post_translations").select(TRANSLATION_COLUMNS).in("post_id", postIds)
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as Record<string, unknown>[]).flatMap((row) => {
    if (row.locale !== "ar" && row.locale !== "en") return []
    return [{
      post_id: String(row.post_id),
      locale: row.locale,
      title: String(row.title ?? ""),
      slug: String(row.slug ?? ""),
      content: String(row.content ?? ""),
      excerpt: String(row.excerpt ?? ""),
      seo_title: String(row.seo_title ?? ""),
      seo_description: String(row.seo_description ?? ""),
      keywords: asKeywords(row.keywords),
      updated_at: String(row.updated_at ?? ""),
    }]
  })
}

export async function listCmsPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase.from("posts").select(BASE_COLUMNS).order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  const translations = await readTranslations(rows.map((row) => String(row.id)))
  return rows.map((row) => toBase(row, translations.filter((translation) => translation.post_id === row.id)))
}

export async function getCmsPost(id: string): Promise<BlogPost> {
  const { data, error } = await supabase.from("posts").select(BASE_COLUMNS).eq("id", id).single()
  if (error) throw new Error(error.message)
  const translations = await readTranslations([id])
  return toBase(data as unknown as Record<string, unknown>, translations)
}

export async function listPublishedPosts(locale: LocaleId, client: typeof supabase = supabase): Promise<PublicBlogPost[]> {
  const { data, error } = await client.from("posts").select(BASE_COLUMNS).eq("published", true).order("published_at", { ascending: false })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  const translations = await readTranslations(rows.map((row) => String(row.id)), client)

  return rows.flatMap((row) => {
    const id = String(row.id)
    const base = toBase(row, translations.filter((translation) => translation.post_id === id))
    const translation = locale === "fr" ? null : base.translations[locale as BlogTranslationLocale] ?? null
    if (locale !== "fr" && !translation) return []
    const content = locale === "fr" ? base : translation!
    return [{
      id,
      locale,
      title: content.title,
      slug: content.slug,
      content: content.content,
      excerpt: content.excerpt,
      seo_title: content.seo_title,
      seo_description: content.seo_description,
      keywords: content.keywords,
      author_name: base.author_name,
      category: base.category,
      image_url: base.image_url,
      image_alt: base.image_alt,
      published_at: String(row.published_at ?? row.created_at),
      updated_at: String(row.updated_at ?? row.created_at),
      canonical_slug_fr: base.slug,
      translations: {
        fr: {
          title: base.title, slug: base.slug, content: base.content, excerpt: base.excerpt,
          seo_title: base.seo_title, seo_description: base.seo_description, keywords: base.keywords,
        },
        ...(base.translations.ar ? { ar: base.translations.ar } : {}),
        ...(base.translations.en ? { en: base.translations.en } : {}),
      },
    }]
  })
}

async function readTranslationsForPublic(postIds: string[], locale: LocaleId): Promise<BlogTranslation[]> {
  if (locale === "fr" || !postIds.length) return []
  const { data, error } = await supabase.from("post_translations")
    .select(TRANSLATION_COLUMNS).eq("locale", locale).in("post_id", postIds)
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    post_id: String(row.post_id),
    locale: locale as BlogTranslationLocale,
    title: String(row.title ?? ""),
    slug: String(row.slug ?? ""),
    content: String(row.content ?? ""),
    excerpt: String(row.excerpt ?? ""),
    seo_title: String(row.seo_title ?? ""),
    seo_description: String(row.seo_description ?? ""),
    keywords: asKeywords(row.keywords),
    updated_at: String(row.updated_at ?? ""),
  }))
}

export async function getPublishedPostBySlug(locale: LocaleId, slug: string): Promise<PublicBlogPost | null> {
  if (locale === "fr") {
    const { data, error } = await supabase.from("posts").select(BASE_COLUMNS).eq("slug", slug).eq("published", true).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    const row = data as unknown as Record<string, unknown>
    const base = toBase(row)
    const allTranslations = await readTranslations([base.id])
    base.translations = Object.fromEntries(allTranslations.map((translation) => [translation.locale, translation]))
    return asPublicPost(base, "fr")
  }

  const { data: translationRow, error: translationError } = await supabase.from("post_translations")
    .select(TRANSLATION_COLUMNS).eq("locale", locale).eq("slug", slug).maybeSingle()
  if (translationError) throw new Error(translationError.message)
  if (!translationRow) return null
  const translation = (await readTranslations([String(translationRow.post_id)])).find((item) => item.locale === locale)
  if (!translation) return null
  const { data, error } = await supabase.from("posts").select(BASE_COLUMNS)
    .eq("id", translation.post_id).eq("published", true).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const base = toBase(data as unknown as Record<string, unknown>, [translation])
  return asPublicPost(base, locale)
}

function asPublicPost(post: BlogPost, locale: LocaleId): PublicBlogPost {
  const content = locale === "fr" ? post : post.translations[locale]
  if (!content) throw new Error(`Translation '${locale}' is missing.`)
  return {
    id: post.id,
    locale,
    title: content.title,
    slug: content.slug,
    content: content.content,
    excerpt: content.excerpt,
    seo_title: content.seo_title,
    seo_description: content.seo_description,
    keywords: content.keywords,
    author_name: post.author_name,
    category: post.category,
    image_url: post.image_url,
    image_alt: post.image_alt,
    published_at: post.published_at ?? post.created_at,
    updated_at: post.updated_at,
    canonical_slug_fr: post.slug,
    translations: {
      fr: { title: post.title, slug: post.slug, content: post.content, excerpt: post.excerpt, seo_title: post.seo_title, seo_description: post.seo_description, keywords: post.keywords },
      ...(post.translations.ar ? { ar: post.translations.ar } : {}),
      ...(post.translations.en ? { en: post.translations.en } : {}),
    },
  }
}
