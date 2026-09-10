/**
 * Text handling for CMS input. Two deliberate choices worth reading before
 * changing this file:
 *
 * 1. Post content is stored and rendered as plain text, never as HTML.
 *    Nothing else in this app calls `dangerouslySetInnerHTML` (see
 *    SECURITY.md) and this module keeps it that way: React escapes
 *    everything it renders by default, so plain-text content has no
 *    script-injection surface at all. If a future version needs rich
 *    formatting, that's a real project on its own (a markdown renderer +
 *    a vetted allow-list sanitizer, re-validated server-side) — not a
 *    quick addition here.
 * 2. Every check in this file is UX / defense-in-depth. The CHECK
 *    constraints and RLS policies on `public.posts` in supabase/schema.sql
 *    are what actually stop bad data from being stored — never assume
 *    this file ran before a row reaches the database.
 */

export const MAX_TITLE_LENGTH = 200
export const MAX_SLUG_LENGTH = 200
export const MAX_CONTENT_LENGTH = 200_000

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Matches sanitize() in src/store/useMizan.ts, except it keeps \n (0x0A) —
// stripping newlines would silently destroy multi-paragraph article content.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_EXCEPT_NEWLINE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g

/** Multi-line body text: strips control chars (keeps \n) and angle brackets, caps length. */
export function sanitizeContent(input: string): string {
  return input
    .replace(CONTROL_CHARS_EXCEPT_NEWLINE, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, MAX_CONTENT_LENGTH)
}

/** Single-line fields (titles): also collapses newlines, since a title has none. */
export function sanitizeTitle(input: string): string {
  return input
    .replace(/[\r\n]+/g, " ")
    .replace(CONTROL_CHARS_EXCEPT_NEWLINE, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, MAX_TITLE_LENGTH)
}

export function isValidSlug(value: string): boolean {
  return value.length > 0 && value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value)
}

/**
 * Best-effort title -> slug conversion for the editor's auto-fill.
 * Transliterates nothing: an Arabic (or otherwise non-Latin) title
 * collapses to an empty string here, and the author fills the slug in
 * by hand — `isValidSlug` above (and the DB CHECK constraint) still
 * enforce the final shape either way.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
}
