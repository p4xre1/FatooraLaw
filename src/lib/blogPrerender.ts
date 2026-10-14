import type { LocaleId } from "./locales"
import { normalizePath } from "./routes"
import type { PublicBlogPost } from "./blog"

export const BLOG_LIST_BOOTSTRAP_ID = "fatorati-blog-list-data"
export const BLOG_ARTICLE_BOOTSTRAP_ID = "fatorati-blog-article-data"

function readBootstrap<T>(id: string): { path: string; locale: LocaleId; value: T } | null {
  if (typeof document === "undefined") return null
  const script = document.getElementById(id)
  if (!script?.textContent) return null
  try {
    const parsed = JSON.parse(script.textContent) as { path?: unknown; locale?: unknown; value?: unknown }
    if (typeof parsed.path !== "string" || !["fr", "ar", "en"].includes(String(parsed.locale))) return null
    return { path: normalizePath(parsed.path), locale: parsed.locale as LocaleId, value: parsed.value as T }
  } catch {
    return null
  }
}

/** Build-time static-site data used only to hydrate the exact document that embeds it. */
export function readPrerenderedBlogPosts(pathname: string, locale: LocaleId): PublicBlogPost[] | undefined {
  const data = readBootstrap<unknown>(BLOG_LIST_BOOTSTRAP_ID)
  if (!data || data.path !== normalizePath(pathname) || data.locale !== locale || !Array.isArray(data.value)) return undefined
  return data.value.filter(isPublicBlogPost)
}

/** Static article hydration data; client-side navigations still use the public API. */
export function readPrerenderedBlogPost(pathname: string, locale: LocaleId, slug: string): PublicBlogPost | undefined {
  const data = readBootstrap<unknown>(BLOG_ARTICLE_BOOTSTRAP_ID)
  if (!data || data.path !== normalizePath(pathname) || data.locale !== locale || !isPublicBlogPost(data.value)) return undefined
  return data.value.slug === slug && data.value.locale === locale ? data.value : undefined
}

function isPublicBlogPost(value: unknown): value is PublicBlogPost {
  if (!value || typeof value !== "object") return false
  const post = value as Partial<PublicBlogPost>
  return typeof post.id === "string"
    && typeof post.slug === "string"
    && typeof post.title === "string"
    && typeof post.content === "string"
    && typeof post.author_name === "string"
    && (post.locale === "fr" || post.locale === "ar" || post.locale === "en")
}
