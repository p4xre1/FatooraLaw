/**
 * VIRAL / SEO STANDARDS CHECKLIST — for blog posts
 * Scores 0-100; writer uses this before publishing.
 */
export type SEOScore = { score: number; checks: { label: string; pass: boolean; weight: number }[] }

export function scoreBlog(post: {
  title: string
  slug: string
  content: string
  excerpt: string
  seo_title: string
  seo_description: string
  keywords: string[]
  image_url?: string
  image_alt?: string
}): SEOScore {
  const checks = [
    { label: "Title 40-70 chars", pass: post.title.length >= 40 && post.title.length <= 70, weight: 10 },
    { label: "Slug has keyword", pass: /[a-z0-9]{3,}/.test(post.slug), weight: 5 },
    { label: "Excerpt 120-160 chars", pass: post.excerpt.length >= 120 && post.excerpt.length <= 160, weight: 10 },
    { label: "SEO title 40-60 chars", pass: post.seo_title.length >= 40 && post.seo_title.length <= 60, weight: 10 },
    { label: "SEO desc 120-155 chars", pass: post.seo_description.length >= 120 && post.seo_description.length <= 155, weight: 10 },
    { label: "Content > 1000 chars", pass: post.content.length > 1000, weight: 10 },
    { label: "Keyword in first 100 chars", pass: post.content.slice(0, 100).toLowerCase().includes(post.keywords[0]?.toLowerCase() ?? ""), weight: 10 },
    { label: "Has image + alt", pass: !!post.image_url && !!post.image_alt && post.image_alt.length > 5, weight: 10 },
    { label: "3-7 keywords", pass: post.keywords.length >= 3 && post.keywords.length <= 7, weight: 10 },
    { label: "No duplicate keywords", pass: new Set(post.keywords.map((k) => k.toLowerCase())).size === post.keywords.length, weight: 5 },
  ]
  const score = Math.round(checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0))
  return { score, checks }
}

export const VIRAL_GUIDE = [
  "Title with number + emotional word (e.g., '7 Secrets...')",
  "Start with a question or bold statement in first 90 chars",
  "Use H2/H3 headers every 300-400 words",
  "Insert image between paragraphs 2-3",
  "Add external authoritative link (boosts E-E-A-T)",
  "End with call-to-action (subscribe / share)",
  "Share-card image 1200x630 with text overlay",
  "Post on peak hours (Thu-Fri 9-11am local)",
]
