import type { LandingPage } from "./routes.ts"
import {
  AUTH_PATHS,
  LANDING_SECTIONS,
  MODULE_PATHS,
  NOT_FOUND_PATH,
  localeEntries,
  localizedLandingPath,
  normalizePath,
} from "./routes.ts"
import { DEFAULT_LOCALE, LOCALES, X_DEFAULT, localeInfo, type LocaleId } from "./locales.ts"

/**
 * Per-route, per-locale SEO metadata: the single source of truth used by
 *
 *   - the client (`src/marketing/Landing.tsx` → `applyDocumentHead`), so every
 *     client-side navigation updates `document.title`, the meta description,
 *     the canonical URL, `hreflang` alternates and the Open Graph URL;
 *   - the build (`vite.config.ts` → `figmaSeoPlugin`), which emits a static
 *     `sitemap.xml` (with `xhtml:link` alternates) and a JSON manifest;
 *   - the prerenderer (`scripts/prerender.mjs`), which writes one real HTML
 *     document per public route **per locale**, instead of shipping the same
 *     shell (with `canonical: https://fatorati.tech/`) to every URL — the
 *     single worst SEO defect this project had.
 *
 * Internationalisation model (see `src/lib/locales.ts`): each language is
 * published at its own URL and is declared with a language + region tag —
 * `fr-MA` for the default, unprefixed French pages, `ar-MA` for `/ar/…`,
 * `en` for `/en/…` — plus an `x-default` pointing at the French page, which is
 * what a crawler serves a visitor whose language matches nothing. Every page
 * lists **all** of its alternates and itself, and every alternate lists the
 * same set back: an asymmetric hreflang set is worse than none, because search
 * engines discard the pairs they cannot verify in both directions.
 */

export type PageSeo = {
  path: string
  /** Relative sitemap priority (0.0–1.0); `changefreq` mirrors how often the copy actually changes. */
  priority: number
  changefreq: "daily" | "weekly" | "monthly" | "yearly"
  /** `false` keeps a page out of the sitemap and out of the index. */
  index: boolean
}

/** Title + description as a searcher sees them. Aim for 120–160 characters. */
export type LocaleCopy = { title: string; description: string }

/**
 * Structural metadata, identical in every language. The localised title and
 * description live in `PAGE_COPY` below, keyed the same way.
 */
export const PAGE_SEO: Record<LandingPage, PageSeo> = {
  home: { path: "/", priority: 1, changefreq: "weekly", index: true },
  features: { path: "/features", priority: 0.9, changefreq: "monthly", index: true },
  assistant: { path: "/assistant", priority: 0.8, changefreq: "monthly", index: true },
  about: { path: "/about", priority: 0.6, changefreq: "yearly", index: true },
  benefits: { path: "/benefits", priority: 0.7, changefreq: "monthly", index: true },
  pricing: { path: "/pricing", priority: 0.9, changefreq: "monthly", index: true },
  blog: { path: "/blog", priority: 0.7, changefreq: "weekly", index: true },
  faq: { path: "/faq", priority: 0.8, changefreq: "monthly", index: true },
  contact: { path: "/contact", priority: 0.7, changefreq: "yearly", index: true },
  privacy: { path: "/privacy", priority: 0.3, changefreq: "yearly", index: true },
  terms: { path: "/terms", priority: 0.3, changefreq: "yearly", index: true },
  cookies: { path: "/cookies", priority: 0.3, changefreq: "yearly", index: true },
}

/**
 * Titles and descriptions, per page and per locale. Grouped by page so the
 * three languages of one page stay side by side and a translation cannot
 * silently go missing (`Record<LandingPage, …>` makes an omission a type
 * error, not a French page with an Arabic URL).
 */
export const PAGE_COPY: Record<LandingPage, Record<LocaleId, LocaleCopy>> = {
  home: {
    fr: {
      title: "Fatorati | Gestion, factures et conformité pour les TPE marocaines",
      description:
        "Fatorati réunit tableau de bord, projets, achats, abonnements, échéances légales et conformité Loi 09-08 dans une seule application mobile-first pour artisans, freelances et PME au Maroc.",
    },
    ar: {
      title: "فاتورتي | تدبير وفواتير وامتثال للمقاولات الصغرى المغربية",
      description:
        "فاتورتي تجمع لوحة القيادة والمشاريع والمشتريات والاشتراكات والمواعيد القانونية والامتثال للقانون 09-08 في تطبيق واحد موجّه للحرفيين والمستقلين والمقاولات الصغرى بالمغرب.",
    },
    en: {
      title: "Fatorati | Management, invoicing and compliance for Moroccan SMEs",
      description:
        "Dashboard, projects, purchases, subscriptions, legal deadlines and Law 09-08 compliance in one mobile-first app for Moroccan artisans and small businesses.",
    },
  },
  features: {
    fr: {
      title: "Fonctionnalités : calendrier, risques et trésorerie | Fatorati",
      description:
        "Découvrez les trois piliers de Fatorati : calendrier des échéances, gestion des risques et conformité marocaine, suivi des abonnements et des dépenses — avec aperçus réels de l'interface.",
    },
    ar: {
      title: "الوظائف: المواعيد والمخاطر والخزينة | فاتورتي",
      description:
        "تعرّف على أعمدة فاتورتي الثلاثة: تقويم المواعيد، وتدبير المخاطر والامتثال المغربي، وتتبّع الاشتراكات والمصروفات — مع لمحات حقيقية من الواجهة.",
    },
    en: {
      title: "Features: deadlines, risk and cash flow tracking | Fatorati",
      description:
        "Explore the three pillars of Fatorati — a deadline calendar, risk and Moroccan compliance tracking, and subscription and expense monitoring, with real interface previews.",
    },
  },
  assistant: {
    fr: {
      title: "Assistant juridique marocain : modèles et règles locales | Fatorati",
      description:
        "L'assistant Fatorati propose des modèles de contrats et les règles juridiques marocaines applicables (DOC, Loi 09-08, mention ICE, TVA 20 %) directement dans votre espace de gestion.",
    },
    ar: {
      title: "مساعد قانوني مغربي: نماذج وقواعد محلية | فاتورتي",
      description:
        "يوفّر مساعد فاتورتي نماذج عقود والقواعد القانونية المغربية المطبَّقة (ق.ل.ع، القانون 09-08، المعرّف المشترك للمقاولة، الرسم على القيمة المضافة 20 %) داخل مساحة تدبيرك.",
    },
    en: {
      title: "Moroccan legal assistant: templates and local rules | Fatorati",
      description:
        "The Fatorati assistant surfaces Moroccan contract templates and the local rules that apply — DOC, Law 09-08, ICE and 20% VAT — inside your management workspace.",
    },
  },
  about: {
    fr: {
      title: "À propos de Fatorati : notre mission au Maroc",
      description:
        "Fatorati est né d'un constat simple : les artisans, freelances et petites entreprises marocaines méritent une gestion claire, abordable et conforme, sans logiciel complexe.",
    },
    ar: {
      title: "عن فاتورتي: مهمتنا في المغرب",
      description:
        "انطلقت فاتورتي من ملاحظة بسيطة: الحرفيون والمستقلون والمقاولات الصغرى بالمغرب يستحقون تدبيراً واضحاً وبأسعار معقولة ومطابقاً للقانون، بدون برامج معقّدة.",
    },
    en: {
      title: "About Fatorati: our mission in Morocco",
      description:
        "Fatorati started from a simple observation: Moroccan artisans, freelancers and small businesses deserve clear, affordable and compliant management software.",
    },
  },
  benefits: {
    fr: {
      title: "Avantages : pourquoi choisir Fatorati pour votre TPE",
      description:
        "Gagnez du temps sur le suivi des échéances, évitez les pénalités de retard, maîtrisez vos coûts d'outils et gardez vos documents légaux au même endroit : les bénéfices concrets de Fatorati.",
    },
    ar: {
      title: "الفوائد: لماذا تختار فاتورتي لمقاولتك الصغرى",
      description:
        "اربح الوقت في تتبّع المواعيد، وتجنّب غرامات التأخير، وتحكّم في تكاليف الأدوات، واحفظ وثائقك القانونية في مكان واحد: فوائد فاتورتي العملية.",
    },
    en: {
      title: "Benefits: why Moroccan small businesses choose Fatorati",
      description:
        "Save time on deadlines, avoid late-payment penalties, keep your tool costs under control and keep your legal documents in one place — the concrete benefits of Fatorati.",
    },
  },
  pricing: {
    fr: {
      title: "Tarifs Fatorati : des offres claires pour les TPE marocaines",
      description:
        "Comparez les offres Fatorati : prix en dirhams, fonctionnalités incluses et engagement sans surprise. Sans carte bancaire pour commencer, résiliable à tout moment.",
    },
    ar: {
      title: "أسعار فاتورتي: عروض واضحة للمقاولات الصغرى بالمغرب",
      description:
        "قارن عروض فاتورتي: الأسعار بالدرهم، والوظائف المشمولة، والتزام بدون مفاجآت. بدون بطاقة بنكية للانطلاق، ويمكن الإلغاء في أي وقت.",
    },
    en: {
      title: "Fatorati pricing: clear plans for Moroccan small businesses",
      description:
        "Compare Fatorati plans: prices in dirhams, what each plan includes and no lock-in. No card required to start, and you can cancel at any time.",
    },
  },
  blog: {
    fr: {
      title: "Ressources et guides de gestion pour les TPE au Maroc | Fatorati",
      description:
        "Guides pratiques sur la TVA, l'ICE, les échéances DGI, le suivi de trésorerie et la conformité CNDP, écrits pour les artisans, freelances et petites entreprises marocaines.",
    },
    ar: {
      title: "أدلة ومصادر التدبير للمقاولات الصغرى بالمغرب | فاتورتي",
      description:
        "أدلة عملية حول الرسم على القيمة المضافة، والمعرّف المشترك للمقاولة، وآجال المديرية العامة للضرائب، وتتبّع الخزينة، والامتثال للجنة الوطنية لحماية المعطيات.",
    },
    en: {
      title: "Management guides and resources for Moroccan SMEs | Fatorati",
      description:
        "Practical guides to VAT, ICE, DGI deadlines, cash-flow tracking and CNDP compliance, written for Moroccan artisans, freelancers and small businesses.",
    },
  },
  faq: {
    fr: {
      title: "Questions fréquentes sur Fatorati et la conformité au Maroc",
      description:
        "Réponses aux questions les plus posées : compatibilité avec les TPE marocaines, usage sur mobile, sécurité et confidentialité des données, changement d'offre et accompagnement.",
    },
    ar: {
      title: "أسئلة شائعة حول فاتورتي والامتثال بالمغرب",
      description:
        "أجوبة عن أكثر الأسئلة تكراراً: ملاءمة فاتورتي للمقاولات الصغرى المغربية، والاستعمال على الهاتف، وأمن المعطيات وخصوصيتها، وتغيير العرض، والمواكبة.",
    },
    en: {
      title: "Frequently asked questions about Fatorati and compliance",
      description:
        "Answers to the questions we hear most: fit for Moroccan small businesses, using it on a phone, data security and privacy, changing plan, and the support you get.",
    },
  },
  contact: {
    fr: {
      title: "Contacter l'équipe Fatorati",
      description:
        "Une question sur Fatorati, les tarifs ou la mise en route ? Écrivez-nous : l'équipe répond aux entreprises marocaines et à leurs besoins de gestion et de conformité.",
    },
    ar: {
      title: "تواصل مع فريق فاتورتي",
      description:
        "سؤال حول فاتورتي أو الأسعار أو الانطلاق؟ راسلنا: يجيب الفريق عن المقاولات المغربية واحتياجاتها في التدبير والامتثال.",
    },
    en: {
      title: "Contact the Fatorati team",
      description:
        "A question about Fatorati, pricing or getting started? Write to us — the team answers Moroccan businesses about their management and compliance needs.",
    },
  },
  privacy: {
    fr: {
      title: "Politique de confidentialité | Fatorati",
      description:
        "Quelles données Fatorati collecte, pourquoi, combien de temps elles sont conservées, et comment exercer vos droits d'accès, de rectification et d'opposition (Loi 09-08 / CNDP).",
    },
    ar: {
      title: "سياسة الخصوصية | فاتورتي",
      description:
        "ما هي المعطيات التي تجمعها فاتورتي، ولماذا، ومدة حفظها، وكيف تمارس حقوقك في الولوج والتصحيح والتعرض (القانون 09-08 / اللجنة الوطنية لحماية المعطيات).",
    },
    en: {
      title: "Privacy policy | Fatorati",
      description:
        "What data Fatorati collects, why, how long it is kept, and how to exercise your rights of access, correction and objection (Law 09-08 / CNDP).",
    },
  },
  terms: {
    fr: {
      title: "Conditions d'utilisation | Fatorati",
      description:
        "Les règles d'utilisation du service Fatorati : usage licite, confidentialité des identifiants, évolution des fonctionnalités et responsabilités de chaque partie.",
    },
    ar: {
      title: "شروط الاستخدام | فاتورتي",
      description:
        "قواعد استعمال خدمة فاتورتي: الاستعمال المشروع، والحفاظ على سرية معرّفات الدخول، وتطوّر الوظائف، ومسؤوليات كل طرف.",
    },
    en: {
      title: "Terms of use | Fatorati",
      description:
        "The rules for using Fatorati: lawful use, keeping your credentials confidential, how features evolve, and what each party is responsible for.",
    },
  },
  cookies: {
    fr: {
      title: "Politique de cookies | Fatorati",
      description:
        "Cookies strictement nécessaires et mesure d'audience Google Analytics activée uniquement après consentement : ce que Fatorati dépose, pourquoi, et comment modifier votre choix.",
    },
    ar: {
      title: "سياسة ملفات الارتباط | فاتورتي",
      description:
        "ملفات ارتباط ضرورية بشكل صارم، وقياس الجمهور عبر Google Analytics لا يُفعّل إلا بموافقتك: ما تضعه فاتورتي، ولماذا، وكيف تغيّر اختيارك.",
    },
    en: {
      title: "Cookie policy | Fatorati",
      description:
        "Strictly necessary cookies, and Google Analytics only after you consent: what Fatorati sets, why, and how to change your choice at any time.",
    },
  },
}

export function seoCopy(page: LandingPage, locale: LocaleId = DEFAULT_LOCALE): LocaleCopy {
  return PAGE_COPY[page][locale]
}

export type SeoEntry = PageSeo & {
  page: LandingPage
  locale: LocaleId
  /** Canonical path of this page *in this locale*. */
  path: string
  title: string
  description: string
}

/** One public page in one locale. */
export function seoEntry(page: LandingPage, locale: LocaleId = DEFAULT_LOCALE): SeoEntry {
  const struct = PAGE_SEO[page]
  return {
    page,
    locale,
    ...struct,
    ...seoCopy(page, locale),
    path: localizedLandingPath(page, locale),
  }
}

/** Every public page in the default locale, home first (the unprefixed URLs). */
export function publicPages(): SeoEntry[] {
  return [
    seoEntry("home" as LandingPage, DEFAULT_LOCALE),
    ...LANDING_SECTIONS.map((page) => seoEntry(page, DEFAULT_LOCALE)),
  ]
}

/** Every public page in every locale, home first, locales in table order. */
export function localizedPages(): SeoEntry[] {
  return localeEntries().map((entry) => seoEntry(entry.page, entry.locale))
}

/** Metadata for any path (falls back to the home entry for unknown paths). */
export function seoForPath(pathname: string, locale: LocaleId = DEFAULT_LOCALE): SeoEntry {
  const path = normalizePath(pathname)
  const found = localizedPages().find((entry) => entry.path === path)
  if (found) return found
  const page = publicPages().find((entry) => entry.path === path)?.page ?? ("home" as LandingPage)
  return seoEntry(page, locale)
}

/** Absolute canonical URL for a public page — never contains a `#`. */
export function canonicalUrl(siteUrl: string, page: LandingPage, locale: LocaleId = DEFAULT_LOCALE): string {
  return `${siteUrl.replace(/\/+$/, "")}${localizedLandingPath(page, locale)}`
}

export function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** `2026-10-13T09:00:00.000Z` → `2026-10-13` */
export function isoDate(value: Date | string = new Date()): string {
  return (typeof value === "string" ? new Date(value) : value).toISOString().slice(0, 10)
}

export type HreflangAlternate = { hreflang: string; href: string }

/**
 * The complete alternate set for one page: every locale plus `x-default`.
 *
 * Rules this implements (and that a partial implementation gets wrong):
 *   - the page declares itself, so `fr-MA` appears on the Arabic and English
 *     documents too — that is what makes the set verifiable in both directions;
 *   - the URLs are absolute, canonical and locale-specific;
 *   - `x-default` points at the default-locale URL (French), the page a
 *     visitor whose language matches nothing is sent to.
 */
export function hreflangAlternates(page: LandingPage, siteUrl: string): HreflangAlternate[] {
  const origin = siteUrl.replace(/\/+$/, "")
  return [
    ...LOCALES.map((locale) => ({
      hreflang: locale.tag,
      href: `${origin}${localizedLandingPath(page, locale.id)}`,
    })),
    { hreflang: X_DEFAULT, href: `${origin}${localizedLandingPath(page, DEFAULT_LOCALE)}` },
  ]
}

/**
 * XML sitemap for every indexable public page **in every locale**, each URL
 * carrying the same `xhtml:link` alternate set as its document. Google reads
 * both; keeping them identical is what lets it pick a single canonical per
 * language instead of treating `/ar/pricing` as a duplicate of `/pricing`.
 */
export function buildSitemapXml(siteUrl: string, lastmod: string = isoDate()): string {
  const origin = siteUrl.replace(/\/+$/, "")
  const entries = localizedPages()
    .filter((entry) => entry.index)
    .map((entry) => {
      const alternates = hreflangAlternates(entry.page, siteUrl).map(
        (alternate) =>
          `    <xhtml:link rel="alternate" hreflang="${escapeHtmlAttribute(alternate.hreflang)}" href="${escapeHtmlAttribute(alternate.href)}"/>`,
      )
      return [
        "  <url>",
        `    <loc>${escapeHtmlAttribute(`${origin}${entry.path}`)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority.toFixed(1)}</priority>`,
        ...alternates,
        "  </url>",
      ].join("\n")
    })
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`
}

/** `llms.txt` (https://llmstxt.org) generated from the same page list as the sitemap. */
export function buildLlmsTxt(siteUrl: string): string {
  const origin = siteUrl.replace(/\/+$/, "")
  const index = publicPages()
    .filter((entry) => entry.index)
    .map((entry) => `- [${entry.title}](${origin}${entry.path}): ${entry.description}`)
    .join("\n")
  const languages = LOCALES.map(
    (locale) =>
      `- ${locale.tag} (${locale.label}): ${origin}${localizedLandingPath("home", locale.id)} — every page above also exists under ${
        locale.prefix === "" ? "the unprefixed paths" : `${locale.prefix}/`
      }`,
  ).join("\n")

  return `# Fatorati

> Fatorati is a mobile-first management application for Moroccan artisans,
> freelancers and small businesses (TPE): financial dashboard, projects,
> clients and suppliers, purchases and expenses, stock, legal document vault,
> tax and compliance reports, deadline calendar, risk alerts, subscription and
> tool tracking, team roles and audit log — in French, English and Arabic.

Fatorati is built for the Moroccan context: it surfaces legal deadlines and
contract templates aligned with Moroccan law (DOC, Loi 09-08 / CNDP, TVA, ICE)
and keeps recurring tool and subscription costs under control.

## Pages

${index}

## Languages

${languages}

## Notes for AI assistants and crawlers

- Content may be indexed, cited and summarized. See ${origin}/robots.txt for
  crawler permissions; AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot,
  PerplexityBot, Google-Extended, CCBot, …) are explicitly allowed.
- Pricing is published in Moroccan dirhams (MAD) on ${origin}/pricing.
- The signed-in application (/dashboard, /projects, …) and the CMS (/admin)
  are private: they are marked \`noindex\` and require an account.
- Contact: bonjour@fatorati.tech
- Official figures cited on the pages (VAT 20%, CGI article 208, Law 09-08)
  come from the Direction Générale des Impôts (https://www.tax.gov.ma/) and
  the CNDP (https://www.cndp.ma/). Demo dashboard numbers are labelled as fictional.
`
}

/** Id of the single per-page structured-data script, replaced on every navigation. */
export const PAGE_JSON_LD_ID = "ld-content"

/** Tags written into the prerendered HTML documents (and reused by the client). */
export type HeadInput = {
  page: LandingPage
  /** Which language variant is being written — decides canonical, alternates and `og:locale`. */
  locale: LocaleId
  siteUrl: string
  /** The page schema, wrapped in a single `#ld-content` script (replaced, never appended). */
  jsonLd?: unknown
  /** Force `noindex, nofollow` (used for private routes and unknown paths). */
  noindex?: boolean
  /** Absolute path of the social preview image, e.g. `/og/og-default.png`. */
  socialImage?: string
  lastmod?: string
}

/** Full `<head>` inner HTML for one route in one locale, as a string (build-time only). */
export function renderHeadTags(input: HeadInput): string {
  const { page, locale, siteUrl, jsonLd, noindex = false } = input
  const entry = seoEntry(page, locale)
  const origin = siteUrl.replace(/\/+$/, "")
  const canonical = `${origin}${entry.path}`
  const image = input.socialImage ? `${origin}${input.socialImage}` : null
  const escaped = escapeHtmlAttribute
  const alternates = hreflangAlternates(page, siteUrl)

  const tags = [
    `<title>${escaped(entry.title)}</title>`,
    `<meta name="description" content="${escaped(entry.description)}">`,
    `<link rel="canonical" href="${escaped(canonical)}">`,
    // The language variants, each one pointing at its own URL, plus x-default.
    ...alternates.map(
      (alternate) =>
        `<link rel="alternate" hreflang="${escaped(alternate.hreflang)}" href="${escaped(alternate.href)}">`,
    ),
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Fatorati">`,
    `<meta property="og:locale" content="${escaped(localeInfo(locale).ogLocale)}">`,
    ...LOCALES.filter((other) => other.id !== locale).map(
      (other) => `<meta property="og:locale:alternate" content="${escaped(other.ogLocale)}">`,
    ),
    `<meta property="og:title" content="${escaped(entry.title)}">`,
    `<meta property="og:description" content="${escaped(entry.description)}">`,
    `<meta property="og:url" content="${escaped(canonical)}">`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escaped(entry.title)}">`,
    `<meta name="twitter:description" content="${escaped(entry.description)}">`,
    noindex || !entry.index
      ? `<meta name="robots" content="noindex, nofollow">`
      : `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`,
    `<meta name="theme-color" content="#3a88ea">`,
    image ? `<meta property="og:image" content="${escaped(image)}">` : "",
    image ? `<meta property="og:image:width" content="1200">` : "",
    image ? `<meta property="og:image:height" content="630">` : "",
    image ? `<meta property="og:image:alt" content="${escaped(`Fatorati — ${entry.title}`)}">` : "",
    image ? `<meta name="twitter:image" content="${escaped(image)}">` : "",
    image ? `<meta name="twitter:image:alt" content="${escaped(`Fatorati — ${entry.title}`)}">` : "",
  ].filter(Boolean)

  const ld = jsonLd ? [`<script id="${PAGE_JSON_LD_ID}" type="application/ld+json">${JSON.stringify(jsonLd)}</script>`] : []

  return [...tags, ...ld].join("\n    ")
}

export type CustomHeadTagsInput = {
  title: string
  description: string
  canonical: string
  locale: LocaleId
  alternates: HreflangAlternate[]
  siteUrl: string
  jsonLd: unknown
  socialImage?: string
  noindex?: boolean
}

/** Static head tags for a database-backed page. */
export function renderCustomHeadTags(input: CustomHeadTagsInput): string {
  const escaped = escapeHtmlAttribute
  const origin = input.siteUrl.replace(/\/+$/, "")
  const canonical = input.canonical.startsWith("http") ? input.canonical : `${origin}${input.canonical}`
  const image = input.socialImage ? `${origin}${input.socialImage}` : null
  const robotDirectives = input.noindex ? "noindex, nofollow, noarchive" : "index, follow, max-image-preview:large, max-snippet:-1"
  const tags = [
    `<title>${escaped(input.title)}</title>`,
    `<meta name="description" content="${escaped(input.description)}">`,
    `<link rel="canonical" href="${escaped(canonical)}">`,
    ...input.alternates.map((alternate) => `<link rel="alternate" hreflang="${escaped(alternate.hreflang)}" href="${escaped(alternate.href)}">`),
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Fatorati">`,
    `<meta property="og:locale" content="${escaped(localeInfo(input.locale).ogLocale)}">`,
    `<meta property="og:title" content="${escaped(input.title)}">`,
    `<meta property="og:description" content="${escaped(input.description)}">`,
    `<meta property="og:url" content="${escaped(canonical)}">`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escaped(input.title)}">`,
    `<meta name="twitter:description" content="${escaped(input.description)}">`,
    `<meta name="robots" content="${robotDirectives}">`,
    `<meta name="googlebot" content="${input.noindex ? "noindex, nofollow" : "index, follow"}">`,
    `<meta name="theme-color" content="#3a88ea">`,
    ...(image ? [`<meta property="og:image" content="${escaped(image)}">`, `<meta property="og:image:alt" content="${escaped(input.title)}">`, `<meta name="twitter:image" content="${escaped(image)}">`, `<meta name="twitter:image:alt" content="${escaped(input.title)}">`] : []),
  ]
  const jsonLd = JSON.stringify(input.jsonLd).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
  return [...tags, `<script id="${PAGE_JSON_LD_ID}" type="application/ld+json">${jsonLd}</script>`].join("\n    ")
}

/**
 * Document titles for private screens. They are only ever emitted with a
 * `noindex` head — a signed-in screen must not appear in results, but a
 * bookmark tab still deserves a readable title. Private screens are
 * French-only, so these titles are not localised.
 */
export const PRIVATE_TITLES: Record<string, string> = {
  [AUTH_PATHS.login]: "Connexion | Fatorati",
  [AUTH_PATHS.signup]: "Créer un compte | Fatorati",
  [AUTH_PATHS.forgot]: "Mot de passe oublié | Fatorati",
  [AUTH_PATHS.reset]: "Nouveau mot de passe | Fatorati",
  [MODULE_PATHS.dashboard]: "Tableau de bord | Fatorati",
  [MODULE_PATHS.projects]: "Projets | Fatorati",
  [MODULE_PATHS.contacts]: "Clients & Fournisseurs | Fatorati",
  [MODULE_PATHS.procurement]: "Achats & Dépenses | Fatorati",
  [MODULE_PATHS.inventory]: "Stock & Matériel | Fatorati",
  [MODULE_PATHS.delivery]: "Livraisons | Fatorati",
  [MODULE_PATHS.verification]: "Vérification clients | Fatorati",
  [MODULE_PATHS.calendar]: "Calendrier | Fatorati",
  [MODULE_PATHS.risk]: "Gestion des Risques | Fatorati",
  [MODULE_PATHS.tools]: "Abonnements & Outils | Fatorati",
  [MODULE_PATHS.legal]: "Coffre juridique | Fatorati",
  [MODULE_PATHS.reports]: "Rapports & Fiscalité | Fatorati",
  [MODULE_PATHS.team]: "Équipe & Rôles | Fatorati",
  [MODULE_PATHS.audit]: "Journal d'audit | Fatorati",
  [MODULE_PATHS.settings]: "Paramètres | Fatorati",
  "/admin": "Fatorati CMS",
  [NOT_FOUND_PATH]: "Page introuvable (404) | Fatorati",
}

export function privateTitleFor(pathname: string): string {
  const path = normalizePath(pathname)
  return PRIVATE_TITLES[path] ?? (path.startsWith("/admin") ? PRIVATE_TITLES["/admin"] : `${PRIVATE_TITLES[NOT_FOUND_PATH]}`)
}

/** Every private path that needs its own non-indexable document. */
export function privatePaths(): string[] {
  return [...Object.values(AUTH_PATHS), ...Object.values(MODULE_PATHS), NOT_FOUND_PATH]
}

/** Head tags for a private route (auth, dashboard, CMS, 404): title + `noindex`. */
export function renderNoIndexHeadTags(title: string): string {
  return [
    `<title>${escapeHtmlAttribute(title)}</title>`,
    `<meta name="robots" content="noindex, nofollow, noarchive">`,
    `<meta name="googlebot" content="noindex, nofollow">`,
    `<meta name="theme-color" content="#3a88ea">`,
  ].join("\n    ")
}

/**
 * Client-side equivalent: keeps `<head>` in sync after a client navigation
 * (the built documents are prerendered per route *and per locale*, so without
 * this the canonical URL and the `hreflang` set would keep describing
 * whichever page — in whichever language — the visitor loaded first).
 */
export function applyDocumentHead(input: HeadInput): void {
  if (typeof document === "undefined") return
  const { page, locale, siteUrl, jsonLd, noindex = false } = input
  const entry = seoEntry(page, locale)
  const origin = siteUrl.replace(/\/+$/, "")
  const canonical = `${origin}${entry.path}`

  // The document language follows the URL: an Arabic page announced as
  // `lang="fr"` is read aloud by the wrong voice and mis-described to crawlers.
  document.documentElement.lang = localeInfo(locale).lang
  document.documentElement.dir = localeInfo(locale).dir

  document.title = entry.title
  setMeta("name", "description", entry.description)
  setMeta("property", "og:type", "website")
  setMeta("property", "og:locale", localeInfo(locale).ogLocale)
  setMeta("property", "og:title", entry.title)
  setMeta("property", "og:description", entry.description)
  setMeta("property", "og:url", canonical)
  setMeta("name", "twitter:title", entry.title)
  setMeta("name", "twitter:description", entry.description)
  setMeta("name", "twitter:card", input.socialImage ? "summary_large_image" : "summary")
  setMeta("name", "robots", noindex || !entry.index ? "noindex, nofollow, noarchive" : "index, follow, max-image-preview:large, max-snippet:-1")
  setMeta("name", "googlebot", noindex || !entry.index ? "noindex, nofollow" : "index, follow")
  setLink("canonical", canonical)
  applyAlternateLinks(hreflangAlternates(page, siteUrl))

  if (!jsonLd) return
  // One script for the page schema, keyed by id: navigating between pages
  // replaces it instead of leaving the previous page's schema behind.
  let script = document.getElementById(PAGE_JSON_LD_ID) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement("script")
    script.id = PAGE_JSON_LD_ID
    script.type = "application/ld+json"
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(jsonLd)
}

export type CustomDocumentHeadInput = {
  title: string
  description: string
  canonical: string
  locale: LocaleId
  alternates: HreflangAlternate[]
  siteUrl: string
  jsonLd: unknown
  socialImage?: string
  noindex?: boolean
}

/** Head metadata for database-backed pages such as published blog articles. */
export function applyCustomDocumentHead(input: CustomDocumentHeadInput): void {
  if (typeof document === "undefined") return
  const { title, description, canonical, locale, alternates, siteUrl, jsonLd, socialImage, noindex = false } = input
  const image = socialImage ? `${siteUrl.replace(/\/+$/, "")}${socialImage}` : null
  document.documentElement.lang = localeInfo(locale).lang
  document.documentElement.dir = localeInfo(locale).dir
  document.title = title
  setMeta("name", "description", description)
  setMeta("property", "og:type", "article")
  setMeta("property", "og:site_name", "Fatorati")
  setMeta("property", "og:locale", localeInfo(locale).ogLocale)
  setMeta("property", "og:title", title)
  setMeta("property", "og:description", description)
  setMeta("property", "og:url", canonical)
  setMeta("name", "twitter:title", title)
  setMeta("name", "twitter:description", description)
  setMeta("name", "twitter:card", image ? "summary_large_image" : "summary")
  setMeta("name", "robots", noindex ? "noindex, nofollow, noarchive" : "index, follow, max-image-preview:large, max-snippet:-1")
  setMeta("name", "googlebot", noindex ? "noindex, nofollow" : "index, follow")
  if (image) {
    setMeta("property", "og:image", image)
    setMeta("property", "og:image:alt", title)
    setMeta("name", "twitter:image", image)
    setMeta("name", "twitter:image:alt", title)
  }
  setLink("canonical", canonical)
  applyAlternateLinks(alternates)
  let script = document.getElementById(PAGE_JSON_LD_ID) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement("script")
    script.id = PAGE_JSON_LD_ID
    script.type = "application/ld+json"
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(jsonLd)
}

/**
 * Rewrite the `hreflang` alternates in place. They are keyed by `hreflang`
 * value (not by position), so a language added to the table later replaces its
 * own link instead of shuffling the existing ones.
 */
function applyAlternateLinks(alternates: HreflangAlternate[]): void {
  const keep = new Set(alternates.map((alternate) => alternate.hreflang))
  for (const tag of document.head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')) {
    if (!keep.has(tag.hreflang)) tag.remove()
  }
  for (const alternate of alternates) {
    const selector = `link[rel="alternate"][hreflang="${alternate.hreflang}"]`
    let tag = document.head.querySelector<HTMLLinkElement>(selector)
    if (!tag) {
      tag = document.createElement("link")
      tag.setAttribute("rel", "alternate")
      tag.setAttribute("hreflang", alternate.hreflang)
      document.head.appendChild(tag)
    }
    tag.setAttribute("href", alternate.href)
  }
}

/** Head for a private screen rendered in the browser (never indexed). */
export function applyNoIndexHead(title: string): void {
  if (typeof document === "undefined") return
  document.title = title
  setMeta("name", "robots", "noindex, nofollow, noarchive")
  setMeta("name", "googlebot", "noindex, nofollow")
}

function setMeta(attribute: "name" | "property", key: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!tag) {
    tag = document.createElement("meta")
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute("content", content)
}

function setLink(rel: string, href: string): void {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!tag) {
    tag = document.createElement("link")
    tag.setAttribute("rel", rel)
    document.head.appendChild(tag)
  }
  tag.setAttribute("href", href)
}
