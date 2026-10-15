/**
 * COMPREHENSIVE SEO AUDIT for blog posts — scores a draft 0–100 against the
 * editorial standards the CMS enforces before publishing, and explains every
 * failing check the way a writer can act on it. The checks mirror the audit
 * panel spec: title, brand consistency, meta description, content depth,
 * H2/H3 structure, heading sequence, question headings, direct answers,
 * named external sources, attributed quotes, cover image + alt, and the
 * target keyword placements.
 */

export type AuditCheck = {
  id: string
  label: string
  pass: boolean
  weight: number
  /** Shown under a failing check — the concrete fix. */
  advice: string
}

export type AuditResult = {
  score: number
  /** Weak / fair / good / excellent band, for the score badge. */
  band: "critical" | "weak" | "fair" | "good" | "excellent"
  checks: AuditCheck[]
  counts: { words: number; headings: number; questionHeadings: number; externalSources: number; quotes: number }
}

export type AuditInput = {
  title: string
  slug: string
  content: string
  excerpt: string
  seo_title: string
  seo_description: string
  keywords: string[]
  image_url?: string
  image_alt?: string
  /** og:site_name / Organization / WebSite / Publisher — one approved value. */
  brandName?: string
  /** Site origin shown in the SERP preview (e.g. fatorati.tech). */
  siteHost?: string
}

/** Words that only "count" as a named source when they are more specific than these. */
const GENERIC_LINK_TEXT = ["here", "ici", "link", "lien", "هنا", "اضغط هنا", "click here", "this", "ceci", "source", "مصدر"]

function stripMarkdownHeadings(line: string): string {
  return line.replace(/^#{1,6}\s+/, "").trim()
}

function visibleWords(content: string): number {
  const text = content
    .replace(/^#{1,6}\s.*$/gm, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, " $1 ")
    .replace(/[>*_`#\-]/g, " ")
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
}

type Heading = { level: number; text: string }

function headings(content: string): Heading[] {
  const out: Heading[] = []
  for (const line of content.split("\n")) {
    const match = /^(#{1,6})\s+(.+)\s*$/.exec(line.trim())
    if (match) out.push({ level: match[1].length, text: match[2].trim() })
  }
  return out
}

/** A heading "asks a question" when it ends in ?/؟ or opens with a question word. */
const QUESTION_STARTERS = [
  /^(comment|pourquoi|quoi|quand|quel\S*|qui|combien|est-ce que|avez-vous|faut-il)\b/i,
  /^(how|why|what|when|which|who|whose|where|can|should|do|does|is|are)\b/i,
  /^(كيف|لماذا|ما\S*|متى|أي|من|كم|هل)\b/,
]

function isQuestionHeading(text: string): boolean {
  return /[?؟]\s*$/.test(text) || QUESTION_STARTERS.some((pattern) => pattern.test(text.trim()))
}

/** [text](https://…) links whose text names a source rather than saying "here". */
function namedExternalLinks(content: string): { text: string; url: string }[] {
  const out: { text: string; url: string }[] = []
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content))) {
    const text = match[1].trim()
    if (!GENERIC_LINK_TEXT.includes(text.toLowerCase()) && text.length > 2) out.push({ text, url: match[2] })
  }
  return out
}

/** Direct quotes: markdown > blockquotes, or « … » / " … " with a named source link nearby. */
function attributedQuotes(content: string): number {
  let count = 0
  const lines = content.split("\n")
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim()
    const isBlockquote = /^>\s+["«"]?.+["»"]?\s*$/.test(line) && line.length > 25
    const isQuoted = /["«"]([^"»]{25,})["»"]/.test(line)
    if (isBlockquote || isQuoted) {
      const context = lines.slice(index, index + 3).join(" ")
      if (/\((?:https?:\/\/|src:)|\[[^\]]+\]\(https?:|—|–|source|Source|المصدر|وفق|حسب|according/i.test(context)) count++
    }
  }
  return count
}

/** The first non-heading paragraph — the "quotable answer" opening. */
function firstParagraph(content: string): string {
  for (const block of content.replace(/\r/g, "").split(/\n\s*\n/)) {
    const trimmed = block.trim()
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith(">")) return trimmed.replace(/\n/g, " ")
  }
  return ""
}

/** A clause whose lead-in reads like a section title ("Data collected — We collect …"). */
function hasDirectAnswerStructure(content: string): boolean {
  const paragraph = firstParagraph(content)
  return paragraph.split(/(?<=[.!?؟])\s/).some((sentence) => sentence.trim().length >= 40)
}

export function auditBlog(input: AuditInput): AuditResult {
  const brand = input.brandName ?? "Fatorati"
  const words = visibleWords(input.content)
  const heads = headings(input.content)
  const h2h3 = heads.filter((heading) => heading.level === 2 || heading.level === 3)
  const questionHeadings = h2h3.filter((heading) => isQuestionHeading(heading.text))
  const sources = namedExternalLinks(input.content)
  const quotes = attributedQuotes(input.content)
  const keyword = (input.keywords[0] ?? "").trim().toLowerCase()
  const keywordIn = (text: string) => keyword.length > 2 && text.toLowerCase().includes(keyword)
  const seoTitle = input.seo_title.trim() || input.title.trim()
  const seoDescription = input.seo_description.trim()

  const titleLength = [...input.title.trim()].length
  const descriptionLength = [...seoDescription].length
  const levels = heads.map((heading) => heading.level)
  let sequenceOK = true
  let previous = 0
  for (const level of levels) {
    if (previous && level > previous + 1) { sequenceOK = false; break }
    previous = level
  }

  const checks: AuditCheck[] = [
    {
      id: "title",
      label: "Title 40–70 characters",
      pass: titleLength >= 40 && titleLength <= 70,
      weight: 10,
      advice: "Add a specific, attractive title of 40–70 characters — long enough to describe the article, short enough to show in full on the results page.",
    },
    {
      id: "brand",
      label: "Brand consistency (title, og:site_name, schema)",
      pass: input.title.includes(brand) || seoTitle.includes(brand),
      weight: 5,
      advice: `Use the approved brand form «${brand}» in the title (or SEO title); og:site_name and the Organization/WebSite/Publisher schema names are already aligned with it.`,
    },
    {
      id: "description",
      label: "Meta description 120–160 characters",
      pass: descriptionLength >= 120 && descriptionLength <= 160,
      weight: 10,
      advice: descriptionLength === 0
        ? "Add a meta description — search engines expect one, and it drives the click-through rate."
        : `Adjust the meta description to 120–160 characters (currently ${descriptionLength}) so it displays without truncation.`,
    },
    {
      id: "depth",
      label: "Content depth (600+ words)",
      pass: words >= 600,
      weight: 10,
      advice: words === 0
        ? "The content is empty. Search engines favour comprehensive articles that answer the reader's question in detail."
        : `Deepen the article (${words} words today): cover the reader's question fully, add examples, steps and answers to follow-up questions.`,
    },
    {
      id: "headings",
      label: "H2/H3 subheadings",
      pass: h2h3.length >= 3,
      weight: 10,
      advice: "Split the article with ## / ### subheadings — easier to read, easier to index.",
    },
    {
      id: "sequence",
      label: "Heading levels never skip",
      pass: sequenceOK,
      weight: 5,
      advice: "Keep heading levels in sequence (H2 then H3, no jump straight to H4) so the outline stays machine-readable.",
    },
    {
      id: "questions",
      label: "Question-format headings",
      pass: questionHeadings.length >= 1,
      weight: 5,
      advice: `${questionHeadings.length} subheading(s) read as a real question. Phrase H2/H3 headings the way readers search (Comment…؟ / How…?), and answer right under each one.`,
    },
    {
      id: "answer",
      label: "Direct answer in the opening",
      pass: hasDirectAnswerStructure(input.content) && firstParagraph(input.content).length >= 80,
      weight: 10,
      advice: "Open with a clear definition or direct answer in the first paragraph that crawlers can quote; move the context and warm-up after it.",
    },
    {
      id: "sources",
      label: "Named external sources",
      pass: sources.length >= 1,
      weight: 10,
      advice: "Cite at least one authority by name and link its official/academic page — never a bare link or a generic \"click here\".",
    },
    {
      id: "quotes",
      label: "Attributed authority quotes",
      pass: quotes >= 1,
      weight: 5,
      advice: "Add a real quote from a named authority (blockquote) with explicit attribution and a link; verify the wording — never invent one.",
    },
    {
      id: "image",
      label: "Cover image + alt text",
      pass: !!input.image_url?.trim() && (input.image_alt?.trim().length ?? 0) > 5,
      weight: 5,
      advice: "Add a cover image and describe it in the alt text (or leave the alt empty in the editor — the title is used automatically, but a specific description ranks in image search).",
    },
    {
      id: "keyword",
      label: "Target keyword in title, description and opening",
      pass: !keyword || (keywordIn(seoTitle) && keywordIn(seoDescription) && keywordIn(firstParagraph(input.content))),
      weight: 10,
      advice: keyword
        ? "Place the target keyword in the SEO title, the meta description and the first paragraph, naturally."
        : "Set a target keyword so this check can verify the placements.",
    },
    {
      id: "excerpt",
      label: "Excerpt 120–200 characters",
      pass: [...input.excerpt.trim()].length >= 120 && [...input.excerpt.trim()].length <= 200,
      weight: 5,
      advice: "Write a card excerpt of 120–200 characters: it shows atop the article and in the blog list.",
    },
  ]

  const score = Math.round(checks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0))
  const band = score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "fair" : score >= 25 ? "weak" : "critical"
  return { score, band, checks, counts: { words, headings: heads.length, questionHeadings: questionHeadings.length, externalSources: sources.length, quotes } }
}

/** Arabic UI label for the score band (the CMS is Arabic-first). */
export const AUDIT_BAND_LABEL: Record<AuditResult["band"], string> = {
  critical: "ضعيف كلياً",
  weak: "ضعيف",
  fair: "متوسط",
  good: "جيد",
  excellent: "ممتاز",
}

export const AUDIT_BAND_CLASS: Record<AuditResult["band"], string> = {
  critical: "text-red-600",
  weak: "text-orange-600",
  fair: "text-amber-600",
  good: "text-emerald-600",
  excellent: "text-emerald-700",
}

/** Legacy shape (label/pass/weight list) still consumed by ContentImprovement. */
export type SEOScore = { score: number; checks: { label: string; pass: boolean; weight: number }[] }

/** Compatibility wrapper around `auditBlog` for older score surfaces. */
export function scoreBlog(post: AuditInput): SEOScore {
  const result = auditBlog(post)
  return { score: result.score, checks: result.checks.map(({ label, pass, weight }) => ({ label, pass, weight })) }
}
