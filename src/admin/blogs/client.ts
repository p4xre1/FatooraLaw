import type { BlogContent, BlogPost, BlogTranslationLocale } from "../../lib/blog"
import type { LocaleId } from "../../lib/locales"
import type { BlogCategory } from "../../lib/routes"
import { supabase } from "../../lib/supabase"
import { getCmsPost, listCmsPosts } from "../../lib/blog"

/**
 * Admin conveniences for the public `posts` and `post_translations` tables.
 * Authorization remains in Postgres RLS; this client never uses a service key.
 */
export type Post = BlogPost
export type PostInput = {
  locales: Record<LocaleId, BlogContent>
  author_name: string
  published: boolean
  /** One editorial section per post, shared by every translation. */
  category?: BlogCategory
  /** Cover image, post-level (the French canonical row). */
  image_url?: string
  image_alt?: string
}

const BASE_WRITE_COLUMNS = (content: BlogContent) => ({
  title: content.title,
  slug: content.slug,
  content: content.content,
  excerpt: content.excerpt,
  seo_title: content.seo_title,
  seo_description: content.seo_description,
  keywords: content.keywords,
})

async function translationsPayload(postId: string, input: PostInput) {
  const locales: BlogTranslationLocale[] = ["ar", "en"]
  return locales.map((locale) => ({
    post_id: postId,
    locale,
    ...BASE_WRITE_COLUMNS(input.locales[locale]),
  }))
}

async function saveTranslations(postId: string, input: PostInput): Promise<void> {
  const { error } = await supabase.from("post_translations")
    .upsert(await translationsPayload(postId, input), { onConflict: "post_id,locale" })
  if (error) throw new Error(error.message)
}

export async function listPosts(): Promise<Post[]> {
  return listCmsPosts()
}

export async function getPost(id: string): Promise<Post> {
  return getCmsPost(id)
}

export async function createPost(input: PostInput): Promise<Post> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error("يجب تسجيل الدخول قبل إنشاء مقال.")

  // Save as a draft first so the database publication guard can verify all
  // translations and SEO fields atomically before the final publish update.
  const { data, error } = await supabase.from("posts")
    .insert({
      ...BASE_WRITE_COLUMNS(input.locales.fr),
      ...(input.category ? { category: input.category } : {}),
      ...(input.image_url !== undefined ? { image_url: input.image_url } : {}),
      ...(input.image_alt !== undefined ? { image_alt: input.image_alt } : {}),
      author_name: input.author_name,
      published: false,
      user_id: auth.user.id,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)

  const id = String((data as { id: string }).id)
  await saveTranslations(id, input)
  if (input.published) {
    const { error: publishError } = await supabase.from("posts").update({ published: true }).eq("id", id)
    if (publishError) throw new Error(publishError.message)
  }
  return getPost(id)
}

export async function updatePost(id: string, input: PostInput): Promise<Post> {
  // A published post is briefly made a draft while its language versions are
  // saved separately through PostgREST; the final update re-runs DB checks.
  const { error: unpublishError } = await supabase.from("posts").update({ published: false }).eq("id", id)
  if (unpublishError) throw new Error(unpublishError.message)

  const { error } = await supabase.from("posts").update({
    ...BASE_WRITE_COLUMNS(input.locales.fr),
    ...(input.category ? { category: input.category } : {}),
    ...(input.image_url !== undefined ? { image_url: input.image_url } : {}),
    ...(input.image_alt !== undefined ? { image_alt: input.image_alt } : {}),
    author_name: input.author_name,
  }).eq("id", id)
  if (error) throw new Error(error.message)

  await saveTranslations(id, input)
  if (input.published) {
    const { error: publishError } = await supabase.from("posts").update({ published: true }).eq("id", id)
    if (publishError) throw new Error(publishError.message)
  }
  return getPost(id)
}

export async function setPublished(id: string, published: boolean): Promise<Post> {
  const { error } = await supabase.from("posts").update({ published }).eq("id", id)
  if (error) throw new Error(error.message)
  return getPost(id)
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from("posts").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
