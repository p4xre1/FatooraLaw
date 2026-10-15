/**
 * Free-form keywords on items (stock articles, expense lines).
 *
 * They exist for one reason: analysis. A keyword is how "ciment" becomes a
 * category a client can be ranked by — the stock a client's projects used
 * carries the words, so the client inherits a keyword profile. Storage is
 * a clean string array; humans type them comma-separated, in any language.
 *
 * Normalization is deliberately boring: trim, collapse inner spaces,
 * case-fold, drop empties and duplicates, cap the count and the length —
 * enough that "Ciment", "ciment " and "CIMENT" are one category, not three.
 */

export const MAX_KEYWORDS = 12
export const MAX_KEYWORD_LENGTH = 30

/** The canonical form of one keyword. */
export function normalizeKeyword(word: string): string {
  return word.trim().replace(/\s+/g, " ").toLowerCase()
}

/** "Ciment, plomberie ; Chantier" → ["ciment", "plomberie", "chantier"]. */
export function parseKeywords(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of text.split(/[,;،]/)) {
    const word = normalizeKeyword(part).slice(0, MAX_KEYWORD_LENGTH)
    if (word && !seen.has(word)) {
      seen.add(word)
      out.push(word)
      if (out.length >= MAX_KEYWORDS) break
    }
  }
  return out
}

/** Clean an already-stored list (imports, older data, hand edits). */
export function sanitizeKeywords(keywords: readonly string[] | undefined): string[] {
  if (!keywords?.length) return []
  return parseKeywords(keywords.join(","))
}

/** The text shown back in the input: "ciment, plomberie". */
export function formatKeywords(keywords: readonly string[] | undefined): string {
  return (keywords ?? []).join(", ")
}
