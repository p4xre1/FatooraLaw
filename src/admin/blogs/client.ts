import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "../../lib/supabase"

/**
 * Data layer for `public.posts`.
 *
 * SECURITY NOTE — read this before adding a new function here: every call
 * below runs in the browser against the Supabase `anon` key (the same
 * client used everywhere else in this app, see src/lib/supabase.ts) and
 * is therefore fully subject to the RLS policies defined in
 * supabase/schema.sql. This file is a convenience wrapper for shaping
 * requests/responses — it is NOT the access-control layer, and it must
 * never import or reference a `service_role` key. If a mutation here ever
 * "succeeds" against a non-admin session, that's a bug in the RLS policy,
 * not a missing check in this file.
 */

const TABLE = "posts"

export type Post = {
  id: string
  title: string
  slug: string
  content: string
  published: boolean
  created_at: string
  updated_at: string
  user_id: string
}

export type PostInput = {
  title: string
  slug: string
  content: string
  published: boolean
}

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null) throw new Error("Supabase returned no data for this request.")
  return result.data
}

/**
 * All posts, newest first. Deliberately doesn't filter by `published` —
 * RLS already scopes the result set correctly for whoever is asking:
 * admins see drafts and published posts, everyone else sees published
 * only (`posts_admin_read_all` / `posts_public_read_published`). The
 * query itself never needs to know which case it's in.
 */
export async function listPosts(): Promise<Post[]> {
  const result = await supabase.from(TABLE).select("*").order("created_at", { ascending: false })
  return unwrap({ data: result.data as Post[] | null, error: result.error })
}

export async function getPost(id: string): Promise<Post> {
  const result = await supabase.from(TABLE).select("*").eq("id", id).single()
  return unwrap({ data: result.data as Post | null, error: result.error })
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const result = await supabase.from(TABLE).select("*").eq("slug", slug).single()
  return unwrap({ data: result.data as Post | null, error: result.error })
}

export async function createPost(input: PostInput): Promise<Post> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error("You must be signed in to create a post.")

  const result = await supabase
    .from(TABLE)
    .insert({ ...input, user_id: auth.user.id })
    .select()
    .single()
  return unwrap({ data: result.data as Post | null, error: result.error })
}

export async function updatePost(id: string, input: Partial<PostInput>): Promise<Post> {
  const result = await supabase.from(TABLE).update(input).eq("id", id).select().single()
  return unwrap({ data: result.data as Post | null, error: result.error })
}

export async function setPublished(id: string, published: boolean): Promise<Post> {
  return updatePost(id, { published })
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id)
  if (error) throw new Error(error.message)
}
