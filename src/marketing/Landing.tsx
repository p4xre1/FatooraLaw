import { useEffect, useId, useRef, useState } from "react"
import {
  ArrowRight, Sparkles, ShieldCheck, CalendarDays, ShieldAlert, Wrench, FileText,
  Check, TrendingUp, Zap, Plus, Bell, ScrollText, LayoutDashboard, ChevronRight,
  Globe, ChevronDown, Sun, Moon, Mail, Phone, MapPin, BookOpen, CheckCircle2,
  Menu, X, Download, ShoppingBag, Megaphone, Monitor, Smartphone, Send,
} from "lucide-react"
import { Logo } from "../components/nav"
import { Brand } from "../components/Brand"
import { SITE_URL } from "../lib/site"
import { listPublishedPosts, getPublishedPostBySlug, type PublicBlogPost } from "../lib/blog"
import { CONTACT_CITY, CONTACT_COUNTRY, CONTACT_EMAIL, CONTACT_PHONE, telHref } from "../lib/contact"
import { readCookieConsent, writeCookieConsent, useMarketingAnalytics } from "../lib/cookieConsent"
import { recordSiteEvent, useSiteVisitTracking } from "../lib/siteAnalytics"
import { applyDocumentHead, applyCustomDocumentHead, applyNoIndexHead, seoForPath, type CustomDocumentHeadInput, type HreflangAlternate } from "../lib/seo"
import { getPublishedSiteCmsData, submitCmsSupportRequest, type PublicCmsAnnouncement, type PublicCmsDownload, type PublicCmsFeature, type PublicCmsProduct, type PublicCmsRelease, type PublicSiteCmsData } from "../lib/siteCms"
import { LANDING_PAGES, landingPath, landingPageFromPath, localeRoute, localizedBlogArticlePath, localizedLandingPath, normalizePath, type LandingPage } from "../lib/routes"
import { LOCALES, isRTL, localeInfo, type LocaleId } from "../lib/locales"
import { LocaleProvider, useLocaleHref } from "../lib/localeContext"
import { currentHistoryState, navigate, onInternalLinkClick, useRoutePath } from "../lib/router"
import useLandingMotion from "./useLandingMotion"
import { CONTENT_PUBLISHED, CONTENT_UPDATED } from "./contentMeta"
import { PageIntro, ReferenceSection, referenceFaq, referenceHowTo } from "./references"
import "./landing.css"

const GRAD = "linear-gradient(135deg, var(--l-primary), var(--l-primary-hover))"
const DASHBOARD_GRAD = "linear-gradient(135deg, var(--l-primary), #4f9bf7)"

/* --------------------------- Structured data ------------------------
 * Per-page JSON-LD ("Content Schema") that complements the site-wide
 * Organization/WebSite JSON-LD emitted at build time (see vite.config.ts).
 * Kept next to the copy it describes so it can never drift from what's
 * actually rendered on the page.
 * ---------------------------------------------------------------- */
/**
 * Node identifiers inside JSON-LD keep a `#fragment` on purpose: they name a
 * graph node (`/#organization`, `/features#content`) that is referenced by
 * `@id` from other documents — they are not links a visitor or crawler ever
 * navigates to. Every *navigable* URL in this project is fragment-free.
 */
const ORG_REF = { "@id": `${SITE_URL}/#organization` }

/** MAD price strings appear as either "199 MAD" (fr/ar) or "MAD 199" (en); pull the digits either way. */
function priceDigits(price: string): string {
  return price.replace(/\D/g, "") || "0"
}

function offersFromPlans(plans: ExtraCopy["pricing"]["plans"], locale: LocaleId) {
  return plans.map((plan, i) => ({
    "@type": "Offer",
    position: i + 1,
    name: plan.name,
    description: plan.desc,
    price: priceDigits(plan.price),
    priceCurrency: "MAD",
    url: `${SITE_URL}${localizedLandingPath("pricing", locale)}`,
  }))
}

function faqEntities(items: { q: string; a: string }[]) {
  return items.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  }))
}

export function buildJsonLd(page: LandingPage, lang: Lang, t: Dict, extra: ExtraCopy): Record<string, unknown> {
  // The localized URL: the Arabic pricing page is a different document from
  // the French one, and its schema must say so (`@id`, `url`, breadcrumbs).
  const url = `${SITE_URL}${localizedLandingPath(page, lang)}`
  const questions = [
    ...referenceFaq(lang),
    ...(page === "home" || page === "faq" ? extra.faq.items : []),
  ]
  const howto = referenceHowTo(lang)
  const base = {
    "@id": `${url}#content`,
    url,
    inLanguage: localeInfo(lang).tag,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    author: ORG_REF,
    publisher: ORG_REF,
    datePublished: CONTENT_PUBLISHED,
    dateModified: CONTENT_UPDATED,
  }

  const pageNode: Record<string, unknown> = (() => {
    switch (page) {
      case "faq":
        return { ...base, "@type": "FAQPage", name: extra.faq.title, mainEntity: faqEntities(questions) }
      case "pricing":
        return {
          ...base,
          "@type": "WebPage",
          name: extra.pricing.title,
          description: extra.pricing.sub,
          mainEntity: { "@type": "ItemList", itemListElement: offersFromPlans(extra.pricing.plans, lang) },
        }
      case "home":
        return {
          ...base,
          // Product is the type AI answer engines look for; SoftwareApplication
          // stays so the offers and category are not lost.
          "@type": ["SoftwareApplication", "Product"],
          name: "Fatorati",
          description: t.hero.sub,
          brand: { "@type": "Brand", name: "Fatorati" },
          applicationCategory: "BusinessApplication",
          applicationSubCategory: "Gestion d'entreprise",
          operatingSystem: "Web",
          softwareVersion: "1.0",
          inLanguage: LOCALES.map((locale) => locale.tag),
          offers: offersFromPlans(extra.pricing.plans, lang),
          featureList: [t.f1.title, t.f2.title, t.f3.title],
        }
      case "about":
        return { ...base, "@type": "AboutPage", name: extra.about.title, description: extra.about.desc }
      case "benefits":
        return { ...base, "@type": "WebPage", name: extra.benefits.title, description: extra.benefits.sub }
      case "assistant":
        return { ...base, "@type": "WebPage", name: t.asst.title, description: t.asst.desc }
      case "features":
        return { ...base, "@type": "WebPage", name: t.feat.title, description: t.feat.sub }
      case "contact":
        return {
          ...base,
          "@type": "ContactPage",
          name: extra.contact.title,
          description: extra.contact.sub,
          about: { ...ORG_REF, name: "Fatorati" },
          mainEntity: {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            email: CONTACT_EMAIL || undefined,
            address: { "@type": "PostalAddress", addressLocality: CONTACT_CITY, addressCountry: CONTACT_COUNTRY },
          },
        }
      case "blog":
        return { ...base, "@type": "CollectionPage", name: extra.blog.title, description: `${extra.blog.eyebrow} — Fatorati` }
      case "privacy":
        return { ...base, "@type": "WebPage", name: extra.legal.privacy, description: extra.legal.privacyText.slice(0, 400) }
      case "terms":
        return { ...base, "@type": "WebPage", name: extra.legal.terms, description: extra.legal.termsText.slice(0, 400) }
      case "cookies":
        return { ...base, "@type": "WebPage", name: extra.legal.cookies, description: extra.legal.cookiesText.slice(0, 400) }
    }
  })()

  const nodes: Record<string, unknown>[] = [pageNode]
  if (page !== "faq") {
    nodes.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      url,
      inLanguage: localeInfo(lang).tag,
      mainEntity: faqEntities(questions),
    })
  }
  nodes.push({
    "@type": "HowTo",
    "@id": `${url}#howto`,
    name: howto.name,
    description: howto.description,
    inLanguage: localeInfo(lang).tag,
    step: howto.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  })
  if (page === "home" || page === "pricing") {
    nodes.push({
      "@type": "Product",
      "@id": `${SITE_URL}/#product`,
      name: "Fatorati",
      description: t.hero.sub,
      brand: { "@type": "Brand", name: "Fatorati" },
      offers: offersFromPlans(extra.pricing.plans, lang),
    })
  }
  if (page !== "home") {
    nodes.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: String(pageNode.name ?? page), item: url },
      ],
    })
  }

  return { "@context": "https://schema.org", "@graph": nodes }
}

export function buildManagedSiteHead(data: PublicSiteCmsData | undefined, page: LandingPage, locale: LocaleId, siteUrl = SITE_URL): CustomDocumentHeadInput | null {
  const seo = data?.seo
  const managedPage = data?.page
  if (!seo && !managedPage) return null
  const normalizedPath = page === "home" ? "/" : `/${page}`
  const defaults = seoForPath(normalizedPath, locale)
  const origin = siteUrl.replace(/\/+$/, "")
  const title = seo?.title.trim() || managedPage?.seo_title.trim() || managedPage?.title.trim() || defaults.title
  const description = seo?.description.trim() || managedPage?.seo_description.trim() || managedPage?.excerpt.trim() || defaults.description
  const canonical = seo?.canonical_url.trim() || managedPage?.canonical_url.trim() || `${origin}${localizedLandingPath(page, locale)}`
  const alternates: HreflangAlternate[] = LOCALES.map((item) => ({ hreflang: item.tag, href: `${origin}${localizedLandingPath(page, item.id)}` }))
  alternates.push({ hreflang: "x-default", href: `${origin}${localizedLandingPath(page, "fr")}` })
  const jsonLd = managedPage ? {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: canonical.startsWith("http") ? canonical : `${origin}${canonical}`,
    inLanguage: localeInfo(locale).tag,
    dateModified: managedPage.updated_at,
  } : buildJsonLd(page, locale, T[locale], EXTRA[locale])
  return {
    title,
    description,
    canonical,
    locale,
    alternates,
    siteUrl: origin,
    jsonLd,
    noindex: Boolean(managedPage?.noindex || seo?.indexable === false),
  }
}

/**
 * Keeps the document head in sync with the page being shown.
 *
 * The built documents are prerendered per route (scripts/prerender.mjs), so
 * this is what stops a client-side navigation from leaving the previous
 * page's title, description, `canonical` and JSON-LD behind — the classic
 * "every page claims to be the homepage" SPA bug.
 */
function usePageHead(page: LandingPage, lang: Lang, t: Dict, extra: ExtraCopy) {
  useEffect(() => {
    // `locale` is passed explicitly: the canonical URL, the `hreflang`
    // alternates and `og:locale` all depend on which language tree we are in.
    applyDocumentHead({ page, locale: lang, siteUrl: SITE_URL, jsonLd: buildJsonLd(page, lang, t, extra) })
  }, [page, lang, t, extra])
}

export type Lang = "fr" | "en" | "ar"
type Theme = "dark" | "light"
type Seg = { t: string; hi?: boolean }

export type ExtraCopy = {
  nav: { benefits: string; pricing: string; faq: string }
  about: { eyebrow: string; title: string; desc: string; points: string[] }
  benefits: { eyebrow: string; title: string; sub: string; items: { title: string; desc: string }[] }
  pricing: { eyebrow: string; title: string; sub: string; plans: { name: string; price: string; period: string; desc: string; cta: string; items: string[]; featured?: boolean }[] }
  blog: { eyebrow: string; title: string; posts: { tag: string; title: string; desc: string; date: string; iso: string }[] }
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] }
  contact: { eyebrow: string; title: string; sub: string; email: string; phone: string; city: string; cta: string }
  legal: { privacy: string; privacyText: string; terms: string; termsText: string; cookies: string; cookiesText: string }
}

/** The switcher's options, straight from the locale table (same order). */
const LANGS: { code: LocaleId; label: string }[] = LOCALES.map((locale) => ({ code: locale.id, label: locale.label }))

export const T: Record<Lang, {
  nav: { features: string; assistant: string; benefits: string; pricing: string; blog: string; faq: string; about: string; contact: string }
  signup: string; explore: string
  hero: { headline: Seg[]; sub: string; note: string }
  feat: { eyebrow: string; title: string; sub: string }
  f1: { tag: string; title: string; desc: string }
  f2: { tag: string; title: string; desc: string; items: { label: string; desc: string; level: string }[] }
  f3: { tag: string; title: string; desc: string; add: string; cols: [string, string, string, string]; tools: [string, string, string, string][]; blocks: [string, string][]; trend: string }
  cal: { month: string; renew: string; pay: string; legal: string; days: string[]; upcoming: string; events: { day: number; type: "renew" | "pay" | "legal"; label: string }[] }
  prev: { greet: string; title: string; add: string; stats: string[]; trend: string; plan: string; nav: string[]; caption: string }
  asst: { badge: string; title: string; desc: string; cta: string; panel: string; panelSub: string; rules: string[]; verified: string }
  footer: { title: string; compliance: string; copy: string }
}> = {
  fr: {
    nav: { features: "Fonctionnalités", assistant: "Assistant", benefits: "Avantages", pricing: "Tarifs", blog: "Blog", faq: "FAQ", about: "À propos", contact: "Contact" },
    signup: "S'inscrire", explore: "Explorer",
    hero: {
      headline: [{ t: "Le logiciel simple qui pilote vos " }, { t: "finances", hi: true }, { t: ", vos " }, { t: "abonnements", hi: true }, { t: " et vos " }, { t: "risques", hi: true }, { t: "." }],
      sub: "Conçu mobile-first pour les artisans, freelances et petites entreprises marocaines : suivez vos échéances, maîtrisez vos coûts d'outils et restez conforme, depuis votre poche.",
      note: "Sans carte bancaire · Conforme Loi 09-08",
    },
    feat: { eyebrow: "Tout-en-un", title: "Trois outils, une seule application", sub: "Chaque fonctionnalité pensée pour la réalité du terrain marocain." },
    f1: { tag: "Planification", title: "Outil de Calendrier", desc: "Un calendrier de time-blocking épuré pour ne jamais manquer une date clé : échéances légales, renouvellements de contrats et paiements." },
    f2: { tag: "Conformité", title: "Gestion des Risques", desc: "Des alertes proactives et des contrôles de conformité locaux, adaptés aux réglementations des entreprises marocaines.", items: [{ label: "Déclaration TVA — T3 2026", desc: "À déposer auprès de la DGI. L'article 208 du CGI porte la pénalité à 20 % si la TVA est versée hors délai.", level: "Élevé" }, { label: "Contrat client — PME locale", desc: "Clause de pénalité de retard à réviser avant renouvellement.", level: "Moyen" }, { label: "Registre du commerce (RC)", desc: "Modèle J mis à jour au tribunal de commerce de Casablanca.", level: "OK" }] },
    f3: { tag: "Finances", title: "Suivi des Abonnements & Outils", desc: "Saisissez chaque outil, visualisez vos totaux et suivez la tendance de vos dépenses mensuelles.", add: "Ajouter un outil", cols: ["Outil", "Coût / mois", "Début", "Expiration"], tools: [["Adobe Creative Cloud", "299 MAD", "01/03/26", "01/03/27"], ["Microsoft 365", "129 MAD", "12/01/26", "12/01/27"], ["Sage Compta", "450 MAD", "05/06/26", "05/06/27"], ["Hébergement OVH", "89 MAD", "20/02/26", "20/02/27"]], blocks: [["Total / mois", "1 720"], ["Outils actifs", "14"], ["Expire < 30j", "3"]], trend: "Tendance mensuelle" },
    cal: { month: "Septembre 2026", renew: "Renouv.", pay: "Paiement", legal: "Échéance légale", days: ["L", "M", "M", "J", "V", "S", "D"], upcoming: "Dates cruciales à venir", events: [{ day: 8, type: "pay", label: "Paiement Adobe CC — 299 MAD" }, { day: 15, type: "renew", label: "Renouvellement Microsoft 365" }, { day: 23, type: "legal", label: "Déclaration TVA (DGI)" }, { day: 27, type: "renew", label: "Fin abonnement Sage Compta" }] },
    prev: { greet: "Bonjour, Karim 👋", title: "Suivi des outils", add: "Ajouter", stats: ["Dépense / mois", "Outils actifs", "Échéances 7j"], trend: "Tendance des dépenses", plan: "Plan Pro", nav: ["Tableau", "Contrats", "Calendrier", "Risques", "Outils"], caption: "Aperçu de démonstration — les montants (1 720 MAD, +12 %) sont fictifs." },
    asst: { badge: "Fatorati Assistant", title: "Intégration juridique intelligente", desc: "Un panneau léger et intelligent qui vous sert dynamiquement les règles juridiques locales exactes et des modèles de contrats prêts à l'emploi — adaptés au droit marocain.", cta: "Découvrir l'assistant", panel: "Modèles suggérés", panelSub: "Basés sur votre activité", rules: ["Contrat de prestation — art. 723 DOC", "Clause de confidentialité (Loi 09-08)", "Facture conforme ICE + TVA 20%"], verified: "Vérifié selon le DOC & la Loi 09-08" },
    footer: { title: "Prêt à équilibrer votre gestion ?", compliance: "Conforme Loi 09-08 (CNDP)", copy: `© 2026 Fatorati · ${CONTACT_CITY}, Maroc` },
  },
  en: {
    nav: { features: "Features", assistant: "Assistant", benefits: "Benefits", pricing: "Pricing", blog: "Blog", faq: "FAQ", about: "About", contact: "Contact" },
    signup: "Sign up", explore: "Explore",
    hero: {
      headline: [{ t: "The simple software that runs your " }, { t: "finances", hi: true }, { t: ", your " }, { t: "subscriptions", hi: true }, { t: " and your " }, { t: "risks", hi: true }, { t: "." }],
      sub: "Built mobile-first for Moroccan artisans, freelancers and small businesses: track your deadlines, control your tool costs and stay compliant — right from your pocket.",
      note: "No credit card · Law 09-08 compliant",
    },
    feat: { eyebrow: "All-in-one", title: "Three tools, one single app", sub: "Every feature designed for the Moroccan field reality." },
    f1: { tag: "Planning", title: "Calendar Tool", desc: "A clean time-blocking calendar so you never miss a key date: legal deadlines, contract renewals and payments." },
    f2: { tag: "Compliance", title: "Risk Management", desc: "Proactive alerts and local compliance checks, tailored to Moroccan business regulations.", items: [{ label: "VAT return — Q3 2026", desc: "File with the DGI. Article 208 of the CGI raises the penalty to 20% when VAT is paid late.", level: "High" }, { label: "Client contract — local SME", desc: "Late-payment penalty clause to review before renewal.", level: "Medium" }, { label: "Trade register (RC)", desc: "Model J updated at the Casablanca commercial court.", level: "OK" }] },
    f3: { tag: "Finance", title: "Subscriptions & Tools Tracking", desc: "Log each tool, view your totals and track your monthly spending trend.", add: "Add a tool", cols: ["Tool", "Cost / month", "Start", "Expiry"], tools: [["Adobe Creative Cloud", "299 MAD", "01/03/26", "01/03/27"], ["Microsoft 365", "129 MAD", "12/01/26", "12/01/27"], ["Sage Compta", "450 MAD", "05/06/26", "05/06/27"], ["OVH Hosting", "89 MAD", "20/02/26", "20/02/27"]], blocks: [["Total / month", "1 720"], ["Active tools", "14"], ["Expiring < 30d", "3"]], trend: "Monthly trend" },
    cal: { month: "September 2026", renew: "Renewal", pay: "Payment", legal: "Legal deadline", days: ["M", "T", "W", "T", "F", "S", "S"], upcoming: "Upcoming crucial dates", events: [{ day: 8, type: "pay", label: "Adobe CC payment — 299 MAD" }, { day: 15, type: "renew", label: "Microsoft 365 renewal" }, { day: 23, type: "legal", label: "VAT return (DGI)" }, { day: 27, type: "renew", label: "Sage Compta subscription ends" }] },
    prev: { greet: "Hello, Karim 👋", title: "Tools tracking", add: "Add", stats: ["Spend / month", "Active tools", "Due in 7d"], trend: "Spending trend", plan: "Pro plan", nav: ["Dashboard", "Contracts", "Calendar", "Risks", "Tools"], caption: "Demo preview — the figures (MAD 1,720, +12%) are fictional." },
    asst: { badge: "Fatorati Assistant", title: "Smart legal integration", desc: "A lightweight, intelligent panel that dynamically serves the exact local legal rules and ready-to-use contract templates — tailored to Moroccan law.", cta: "Discover the assistant", panel: "Suggested templates", panelSub: "Based on your activity", rules: ["Service contract — art. 723 DOC", "Confidentiality clause (Law 09-08)", "Invoice compliant ICE + VAT 20%"], verified: "Verified against the DOC & Law 09-08" },
    footer: { title: "Ready to balance your management?", compliance: "Law 09-08 compliant (CNDP)", copy: `© 2026 Fatorati · ${CONTACT_CITY}, Morocco` },
  },
  ar: {
    nav: { features: "الميزات", assistant: "المساعد", benefits: "المزايا", pricing: "الأسعار", blog: "المدونة", faq: "الأسئلة", about: "عن فاتورتي", contact: "تواصل معنا" },
    signup: "إنشاء حساب", explore: "استكشاف",
    hero: {
      headline: [{ t: "البرنامج البسيط الذي يدير " }, { t: "أموالك", hi: true }, { t: " و" }, { t: "اشتراكاتك", hi: true }, { t: " و" }, { t: "مخاطرك", hi: true }, { t: "." }],
      sub: "مصمم للهاتف أولاً للحرفيين والمستقلين والشركات الصغيرة في المغرب: تابع مواعيدك، وتحكّم في تكاليف أدواتك، وابقَ ممتثلاً — من جيبك.",
      note: "بدون بطاقة بنكية · متوافق مع القانون 09-08",
    },
    feat: { eyebrow: "الكل في واحد", title: "ثلاث أدوات، تطبيق واحد", sub: "كل ميزة مصممة لواقع الميدان المغربي." },
    f1: { tag: "تخطيط", title: "أداة التقويم", desc: "تقويم بسيط لحجز الوقت حتى لا تفوّت أي موعد مهم: المواعيد القانونية وتجديد العقود والمدفوعات." },
    f2: { tag: "امتثال", title: "إدارة المخاطر", desc: "تنبيهات استباقية وفحوصات امتثال محلية، مصممة للوائح الشركات المغربية.", items: [{ label: "إقرار الضريبة على القيمة المضافة — الربع 3 2026", desc: "يُودَع لدى المديرية العامة للضرائب. المادة 208 ترفع الذعيرة إلى 20٪ إذا دُفعت الضريبة خارج الأجل.", level: "مرتفع" }, { label: "عقد العميل أطلس BTP", desc: "بند غرامة التأخير يجب مراجعته قبل التجديد.", level: "متوسط" }, { label: "السجل التجاري", desc: "النموذج J محدّث لدى المحكمة التجارية بالدار البيضاء.", level: "سليم" }] },
    f3: { tag: "المالية", title: "متابعة الاشتراكات والأدوات", desc: "سجّل كل أداة، اطّلع على إجمالياتك وتابع اتجاه نفقاتك الشهرية.", add: "إضافة أداة", cols: ["الأداة", "التكلفة / شهر", "البدء", "الانتهاء"], tools: [["Adobe Creative Cloud", "299 MAD", "01/03/26", "01/03/27"], ["Microsoft 365", "129 MAD", "12/01/26", "12/01/27"], ["Sage Compta", "450 MAD", "05/06/26", "05/06/27"], ["استضافة OVH", "89 MAD", "20/02/26", "20/02/27"]], blocks: [["الإجمالي / شهر", "1 720"], ["أدوات نشطة", "14"], ["تنتهي < 30 يوم", "3"]], trend: "الاتجاه الشهري" },
    cal: { month: "شتنبر 2026", renew: "تجديد", pay: "دفع", legal: "موعد قانوني", days: ["ن", "ث", "ر", "خ", "ج", "س", "ح"], upcoming: "مواعيد حاسمة قادمة", events: [{ day: 8, type: "pay", label: "دفع Adobe CC — 299 MAD" }, { day: 15, type: "renew", label: "تجديد Microsoft 365" }, { day: 23, type: "legal", label: "إقرار الضريبة (DGI)" }, { day: 27, type: "renew", label: "انتهاء اشتراك Sage Compta" }] },
    prev: { greet: "مرحباً كريم 👋", title: "متابعة الأدوات", add: "إضافة", stats: ["الإنفاق / شهر", "أدوات نشطة", "استحقاق 7 أيام"], trend: "اتجاه الإنفاق", plan: "خطة برو", nav: ["لوحة", "عقود", "تقويم", "مخاطر", "أدوات"], caption: "عرض توضيحي — المبالغ (1 720 درهماً، +12٪) خيالية." },
    asst: { badge: "مساعد فاتورتي", title: "تكامل قانوني ذكي", desc: "لوحة خفيفة وذكية تقدّم لك القواعد القانونية المحلية الدقيقة ونماذج عقود جاهزة — مصممة للقانون المغربي.", cta: "اكتشف المساعد", panel: "نماذج مقترحة", panelSub: "بناءً على نشاطك", rules: ["عقد خدمة — المادة 723 ق.ل.ع", "بند السرية (القانون 09-08)", "فاتورة مطابقة ICE + ض.ق.م 20%"], verified: "تم التحقق وفق ق.ل.ع والقانون 09-08" },
    footer: { title: "مستعد لموازنة إدارتك؟", compliance: "متوافق مع القانون 09-08 (CNDP)", copy: `© 2026 فاتورتي · ${CONTACT_CITY}، المغرب` },
  },
}

export const EXTRA: Record<Lang, ExtraCopy> = {
  fr: {
    nav: { benefits: "Avantages", pricing: "Tarifs", faq: "FAQ" },
    about: { eyebrow: "À propos", title: "La gestion pensée pour le terrain marocain.", desc: "Fatorati réunit les outils essentiels des artisans, freelances et petites entreprises dans un espace clair, mobile et conforme.", points: ["Une expérience simple, en français et en arabe.", "Des échéances, contrats et dépenses visibles au même endroit.", "Une approche conçue avec les réalités des TPE marocaines."] },
    benefits: { eyebrow: "Pourquoi Fatorati", title: "Moins d'oubli. Plus de maîtrise.", sub: "Une vue claire pour décider vite et travailler sereinement.", items: [{ title: "Gagnez du temps", desc: "Retrouvez vos clients, dépenses, contrats et échéances sans passer d'un outil à l'autre." }, { title: "Restez conforme", desc: "Anticipez vos obligations et conservez une trace utile de chaque action importante." }, { title: "Pilotez depuis votre poche", desc: "Une interface mobile-first qui reste lisible au bureau comme sur le terrain." }, { title: "Travaillez en équipe", desc: "Attribuez les bons rôles et gardez le contrôle sur les accès sensibles." }] },
    pricing: { eyebrow: "Tarifs", title: "Un plan pour chaque étape.", sub: "Commencez simplement, puis adaptez votre espace à votre activité.", plans: [{ name: "Essentiel", price: "0 MAD", period: "/ pour commencer", desc: "Pour découvrir les fondamentaux.", cta: "Commencer", items: ["Tableau de bord", "Calendrier des échéances", "Gestion des contacts"] }, { name: "Pro", price: "199 MAD", period: "/ mois", desc: "Pour piloter une activité en croissance.", cta: "Choisir Pro", featured: true, items: ["Tout dans Essentiel", "Contrats et coffre juridique", "Rapports et exports", "Rôles et permissions"] }, { name: "Équipe", price: "499 MAD", period: "/ mois", desc: "Pour une équipe qui veut aller plus loin.", cta: "Parler à l'équipe", items: ["Tout dans Pro", "Équipe multi-utilisateurs", "Suivi avancé et audit", "Accompagnement prioritaire"] }] },
    blog: { eyebrow: "Ressources", title: "Le journal Fatorati.", posts: [{ tag: "Gestion", title: "Les 5 échéances à ne plus laisser passer", desc: "Une méthode simple pour organiser vos obligations mensuelles et trimestrielles.", date: "12 sept. 2026", iso: "2026-09-12" }, { tag: "Conformité", title: "Préparer ses contrats avec plus de sérénité", desc: "Les points à vérifier avant de signer une prestation au Maroc.", date: "04 sept. 2026", iso: "2026-09-04" }, { tag: "Trésorerie", title: "Où part vraiment votre budget outils ?", desc: "Comment repérer les abonnements inutilisés et reprendre la main sur vos coûts.", date: "28 août 2026", iso: "2026-08-28" }] },
    faq: { eyebrow: "FAQ", title: "Questions fréquentes.", items: [
      { q: "Fatorati, c'est quoi ?", a: "Fatorati est une application de gestion mobile-first pour les artisans, freelances et TPE au Maroc. Elle réunit échéances, contrats, abonnements et alertes de conformité. Ce n'est pas un logiciel de comptabilité certifié : les déclarations fiscales restent à déposer auprès de la DGI, avec votre expert-comptable si vous en avez un." },
      { q: "Fatorati est-il gratuit ou payant ?", a: "L'offre Essentiel est à 0 MAD pour commencer, sans carte bancaire. Pro est à 199 MAD par mois et Équipe à 499 MAD par mois. Les prix sont en dirhams, sur la page Tarifs, et la formule se change ou s'arrête à tout moment." },
      { q: "Fatorati est-il conforme à la CNDP ?", a: "Le produit est conçu pour la loi 09-08 : accès limité au compte, pas de revente des données, mesure d'audience seulement après consentement. La déclaration d'un traitement auprès de la CNDP, lorsqu'elle est exigée, reste à la charge du responsable du traitement. Le détail est dans la politique de confidentialité." },
      { q: "Quelle est la différence avec un logiciel de comptabilité ?", a: "Un logiciel de comptabilité produit le journal, le bilan et les liasses. Fatorati pilote le quotidien : dates, contrats, coût des outils et risques. Les deux se complètent. Fatorati ne télé-déclare pas et ne remplace pas l'expert-comptable." },
      { q: "Fatorati est-il adapté aux petites entreprises marocaines ?", a: "Oui. L'application est conçue pour les artisans, freelances, TPE et PME qui veulent centraliser leur gestion sans complexité inutile, en français et en arabe." },
      { q: "Puis-je utiliser Fatorati sur mobile ?", a: "Oui. L'interface est mobile-first et reste confortable sur téléphone, tablette et ordinateur." },
      { q: "Mes données sont-elles protégées ?", a: "Fatorati applique des contrôles d'accès, une session sécurisée et une traçabilité des actions importantes. Consultez la politique de confidentialité et la page de la CNDP sur la loi 09-08 pour le cadre légal." },
      { q: "Puis-je changer de formule ?", a: "Oui. Vous pouvez faire évoluer votre formule selon la taille de votre activité. Les exports sont inclus dans Pro et Équipe ; la conservation légale des pièces (comptabilité, fiscalité) peut durer plus longtemps que le compte." },
    ] },
    contact: { eyebrow: "Contact", title: "Parlons de votre activité.", sub: "Une question sur Fatorati, les tarifs ou votre déploiement ? Notre équipe vous répond.", email: CONTACT_EMAIL, phone: CONTACT_PHONE, city: `${CONTACT_CITY}, Maroc`, cta: "Écrire à l'équipe" },
    legal: {
      privacy: "Politique de confidentialité",
      privacyText: "Fatorati traite vos données personnelles avec un objectif simple : vous fournir un espace de gestion sécurisé — jamais les revendre, ni les utiliser à des fins publicitaires.\n\nDonnées collectées — Lorsque vous créez un compte, nous recueillons votre nom, votre adresse e-mail et les données professionnelles que vous saisissez (clients, projets, dépenses, contrats, etc.). Ces données sont stockées de façon sécurisée et protégées par des règles d'accès strictes (Row Level Security) : elles ne sont accessibles qu'à vous et aux membres de votre équipe que vous autorisez.\n\nAucune publicité — Fatorati ne diffuse aucune publicité et ne partage, ne loue ni ne vend vos données à des annonceurs ou des courtiers en données, sous quelque forme que ce soit.\n\nGoogle Analytics — Le seul outil tiers que nous utilisons est Google Analytics, uniquement pour comprendre comment notre site est utilisé (pages consultées, durée de visite, provenance du trafic) et faire grandir Fatorati. Ces statistiques sont exploitées de façon agrégée pour améliorer le site — jamais pour vous cibler publicitairement. Cet outil ne s'active que si vous acceptez les cookies de mesure d'audience via notre bandeau de consentement ; vous pouvez le refuser à tout moment (voir notre politique de cookies). Fatorati enregistre aussi des vues de page de première partie après cette même acceptation : chemin de page, langue et domaine référent uniquement, sans adresse IP, compte, identifiant de cookie/session ni URL référente complète. Ce suivi interne peut être désactivé par le contrôle de la plateforme.\n\nDurée de conservation — Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, elles sont supprimées ou anonymisées dans un délai raisonnable, sauf obligation légale de conservation plus longue (comptabilité, fiscalité).\n\nSécurité — L'accès à vos données est protégé par une authentification sécurisée, un chiffrement en transit (HTTPS) et des contrôles d'accès au niveau de la base de données. Voir notre politique de sécurité pour plus de détails.\n\nMise à jour — Cette politique peut évoluer ; la date de dernière mise à jour est indiquée en bas de cette page.",
      terms: "Conditions d'utilisation",
      termsText: "Fatorati est un espace de gestion pour les artisans, freelances et petites entreprises au Maroc. En créant un compte, vous acceptez ces conditions.\n\nÀ quoi sert le service — Fatorati aide à suivre échéances, contrats, dépenses, abonnements et documents. Il ne remplace ni un expert-comptable, ni un avocat, ni une déclaration déposée auprès de la Direction Générale des Impôts. Les montants affichés dans les aperçus du site (1 720 MAD, +12 %) sont des exemples, pas vos chiffres.\n\nCompte — Vous fournissez des informations exactes et gardez vos identifiants confidentiels. Vous êtes responsable des données professionnelles que vous saisissez.\n\nPrix — Les formules en vigueur sont celles publiées sur la page Tarifs, en dirhams : 0 MAD pour commencer, 199 MAD par mois en Pro, 499 MAD par mois en Équipe. L'offre de départ ne demande pas de carte bancaire. Vous pouvez changer de formule ou cesser d'utiliser le service. Les obligations légales de conservation comptable ou fiscale restent les vôtres.\n\nDonnées — Le traitement des données personnelles est décrit dans la politique de confidentialité et s'inscrit dans la loi 09-08. Fatorati ne vend pas vos données.\n\nUsage licite — Vous n'utilisez pas le service pour enfreindre la loi, usurper une identité ou accéder au compte d'une autre personne.\n\nÉvolution et droit applicable — Les fonctionnalités peuvent évoluer. Ces conditions sont régies par le droit marocain. Question : bonjour@fatorati.tech, Tanger.",
      cookies: "Politique des cookies",
      cookiesText: "Un cookie est un petit fichier déposé sur votre appareil lors de votre visite. Voici les cookies utilisés sur fatorati.tech, et à quoi ils servent.\n\nCookies strictement nécessaires — Utilisés pour faire fonctionner le site (mémoriser votre choix de langue, votre thème et votre consentement aux cookies). Ils ne peuvent pas être désactivés et ne nécessitent pas votre consentement.\n\nCookies de mesure d'audience (Google Analytics) — Le seul outil tiers que nous utilisons est Google Analytics, uniquement pour comprendre la fréquentation du site (pages visitées, durée de visite, appareil, provenance approximative) et l'aider à grandir. Ces cookies ne sont déposés que si vous cliquez sur « Accepter » dans notre bandeau ; vous pouvez refuser à tout moment sans perdre l'accès au site. Fatorati enregistre séparément des vues de page internes après la même acceptation, sans cookie ni identifiant de visiteur : chemin, langue et domaine référent uniquement. Le suivi interne peut être désactivé par la plateforme.\n\nAucun cookie publicitaire — Fatorati ne dépose aucun cookie publicitaire, ne fait aucun reciblage (retargeting) et ne partage aucune donnée de navigation avec des régies publicitaires ou des réseaux sociaux.\n\nGérer vos préférences — Vous pouvez accepter ou refuser les cookies de mesure d'audience via le bandeau affiché lors de votre première visite. Votre choix est conservé sur votre appareil ; vous pouvez le modifier en effaçant les données de ce site dans votre navigateur.\n\nPour toute question sur cette politique, contactez-nous à bonjour@fatorati.tech.",
    },
  },
  en: {
    nav: { benefits: "Benefits", pricing: "Pricing", faq: "FAQ" },
    about: { eyebrow: "About", title: "Management designed for Moroccan businesses.", desc: "Fatorati brings the essential tools for artisans, freelancers and small businesses into one clear, mobile and compliant workspace.", points: ["A simple experience in French and Arabic.", "Deadlines, contracts and spending visible in one place.", "Built around the realities of Moroccan small businesses."] },
    benefits: { eyebrow: "Why Fatorati", title: "Less chasing. More control.", sub: "A clear view that helps you decide quickly and work with confidence.", items: [{ title: "Save time", desc: "Find clients, spending, contracts and deadlines without jumping between tools." }, { title: "Stay compliant", desc: "Anticipate obligations and keep a useful trail of every important action." }, { title: "Work from anywhere", desc: "A mobile-first interface that stays clear in the office or on site." }, { title: "Work as a team", desc: "Assign the right roles and keep control of sensitive access." }] },
    pricing: { eyebrow: "Pricing", title: "A plan for every stage.", sub: "Start simply, then adapt your workspace as your business grows.", plans: [{ name: "Essential", price: "MAD 0", period: "/ to start", desc: "For exploring the essentials.", cta: "Get started", items: ["Dashboard", "Deadline calendar", "Contact management"] }, { name: "Pro", price: "MAD 199", period: "/ month", desc: "For running a growing business.", cta: "Choose Pro", featured: true, items: ["Everything in Essential", "Contracts and legal vault", "Reports and exports", "Roles and permissions"] }, { name: "Team", price: "MAD 499", period: "/ month", desc: "For a team ready to go further.", cta: "Talk to the team", items: ["Everything in Pro", "Multi-user workspace", "Advanced audit trail", "Priority support"] }] },
    blog: { eyebrow: "Resources", title: "The Fatorati journal.", posts: [{ tag: "Management", title: "5 deadlines worth never missing", desc: "A simple method for organizing monthly and quarterly obligations.", date: "Sep 12, 2026", iso: "2026-09-12" }, { tag: "Compliance", title: "Prepare contracts with more confidence", desc: "What to review before signing a service agreement in Morocco.", date: "Sep 04, 2026", iso: "2026-09-04" }, { tag: "Cash flow", title: "Where is your tools budget really going?", desc: "How to spot unused subscriptions and regain control of costs.", date: "Aug 28, 2026", iso: "2026-08-28" }] },
    faq: { eyebrow: "FAQ", title: "Frequently asked questions.", items: [
      { q: "What is Fatorati?", a: "Fatorati is a mobile-first management app for artisans, freelancers and small businesses in Morocco. It brings deadlines, contracts, subscriptions and compliance alerts into one place. It is not certified accounting software: tax filings stay with you and the DGI." },
      { q: "Is Fatorati free or paid?", a: "Essential is MAD 0 to start, with no card. Pro is MAD 199 per month and Team is MAD 499 per month. Prices are in dirhams on the pricing page, and the plan can be changed or stopped at any time." },
      { q: "Is Fatorati aligned with the CNDP?", a: "The product is built for Law 09-08: account access is limited, data is not sold, and audience measurement runs only after consent. Filing a processing declaration with the CNDP, when required, stays with the controller. See the privacy policy." },
      { q: "How is it different from accounting software?", a: "Accounting software produces the journal, the balance sheet and the returns. Fatorati runs the day-to-day: dates, contracts, tool costs and risks. They complement each other. Fatorati does not file with the tax authority." },
      { q: "Is Fatorati made for Moroccan small businesses?", a: "Yes. It is designed for artisans, freelancers and small teams who want practical management without unnecessary complexity, in French and Arabic." },
      { q: "Can I use Fatorati on mobile?", a: "Yes. The interface is mobile-first and comfortable on phones, tablets and desktops." },
      { q: "Is my data protected?", a: "Fatorati applies access controls, secure sessions and an audit trail for important actions. See the privacy policy and the CNDP page on Law 09-08 for the legal frame." },
      { q: "Can I change plans?", a: "Yes. You can change plan as the business grows. Exports are included in Pro and Team. Legal retention of records can outlast the account." },
    ] },
    contact: { eyebrow: "Contact", title: "Let us talk about your business.", sub: "Questions about Fatorati, pricing or rollout? Our team will get back to you.", email: CONTACT_EMAIL, phone: CONTACT_PHONE, city: `${CONTACT_CITY}, Morocco`, cta: "Email the team" },
    legal: {
      privacy: "Privacy policy",
      privacyText: "Fatorati handles your personal data with one goal: to give you a secure workspace — never to resell it or use it for advertising.\n\nData we collect — When you create an account, we collect your name, email address, and the business data you enter (clients, projects, expenses, contracts, and so on). This data is stored securely and protected by strict access rules (Row Level Security): only you and the team members you authorize can access it.\n\nNo advertising — Fatorati shows no ads and never shares, rents, or sells your data to advertisers or data brokers, in any form.\n\nGoogle Analytics — The only third-party tool we use is Google Analytics, solely to understand how our site is used (pages viewed, time on page, traffic sources) and help Fatorati grow. This data is used in aggregate to guide the product — never to target you with ads. This tool only runs if you accept audience-measurement cookies through our consent banner; you can decline it at any time (see our cookie policy). Fatorati also records limited first-party page views after the same acceptance: page path, locale and referring hostname only, with no IP address, account, cookie/session ID or full referrer URL. Platform controls can disable this internal tracking.\n\nRetention — Your data is kept for as long as your account is active. If you delete your account, your data is deleted or anonymized within a reasonable timeframe, except where longer retention is legally required (accounting, tax).\n\nSecurity — Access to your data is protected by secure authentication, encryption in transit (HTTPS), and database-level access controls. See our security policy for details.\n\nUpdates — This policy may change over time; the last-updated date is shown at the bottom of this page.",
      terms: "Terms of use",
      termsText: "Fatorati is a management workspace for artisans, freelancers and small businesses in Morocco. Creating an account means you accept these terms.\n\nWhat the service is for — Fatorati helps you track deadlines, contracts, spending, subscriptions and documents. It does not replace an accountant, a lawyer, or a filing made with the tax authority. Figures in the site previews (MAD 1,720, +12%) are examples, not your numbers.\n\nAccount — You provide accurate information and keep your credentials confidential. You are responsible for the business data you enter.\n\nPrice — Current plans are those published on the pricing page, in dirhams: MAD 0 to start, MAD 199 per month for Pro, MAD 499 per month for Team. The starting plan does not ask for a card. You can change plan or stop. Legal retention duties for accounting or tax remain yours.\n\nData — Personal-data processing is described in the privacy policy and sits under Law 09-08. Fatorati does not sell your data.\n\nLawful use — You do not use the service to break the law, impersonate someone, or access another person's account.\n\nChanges and governing law — Features may change. Moroccan law applies. Questions: bonjour@fatorati.tech, Tangier.",
      cookies: "Cookie policy",
      cookiesText: "A cookie is a small file placed on your device when you visit a site. Here's what we use on fatorati.tech, and why.\n\nStrictly necessary cookies — Used to run the site itself (remembering your language, theme, and cookie choice). These can't be turned off and don't require consent.\n\nAudience-measurement cookies (Google Analytics) — The only third-party tool we use is Google Analytics, solely to understand site traffic (pages visited, time on page, device, approximate origin) and help the site grow. These cookies are only set if you click \"Accept\" in our banner; you can decline at any time without losing access to the site. Separately, Fatorati records first-party page views only after that same acceptance, without a cookie or visitor ID: path, locale and referring hostname only. Platform operators can disable this internal tracking.\n\nNo advertising cookies — Fatorati sets no advertising cookies, does no retargeting, and shares no browsing data with ad networks or social platforms.\n\nManaging your preferences — You can accept or decline audience-measurement cookies via the banner shown on your first visit. Your choice is stored on your device; you can change it by clearing this site's data in your browser.\n\nQuestions about this policy? Email us at bonjour@fatorati.tech.",
    },
  },
  ar: {
    nav: { benefits: "المزايا", pricing: "الأسعار", faq: "الأسئلة" },
    about: { eyebrow: "عن فاتورتي", title: "إدارة مصممة للشركات المغربية.", desc: "تجمع فاتورتي الأدوات الأساسية للحرفيين والمستقلين والشركات الصغيرة في مساحة واضحة وآمنة ومتوافقة.", points: ["تجربة بسيطة بالفرنسية والعربية.", "المواعيد والعقود والمصاريف في مكان واحد.", "مصممة لواقع المقاولات الصغيرة المغربية."] },
    benefits: { eyebrow: "لماذا فاتورتي", title: "نسيان أقل. تحكم أكبر.", sub: "رؤية واضحة تساعدك على اتخاذ القرار والعمل بثقة.", items: [{ title: "وفّر وقتك", desc: "اعثر على العملاء والمصاريف والعقود والمواعيد دون التنقل بين الأدوات." }, { title: "ابقَ ممتثلاً", desc: "استبق التزاماتك واحتفظ بسجل مفيد لكل إجراء مهم." }, { title: "اعمل من أي مكان", desc: "واجهة مصممة للهاتف وتبقى واضحة في المكتب أو الميدان." }, { title: "اعمل كفريق", desc: "عيّن الأدوار المناسبة وتحكم في صلاحيات الوصول الحساسة." }] },
    pricing: { eyebrow: "الأسعار", title: "خطة لكل مرحلة.", sub: "ابدأ ببساطة وطوّر مساحتك مع نمو نشاطك.", plans: [{ name: "أساسي", price: "0 MAD", period: "/ للبدء", desc: "لاكتشاف الأساسيات.", cta: "ابدأ الآن", items: ["لوحة التحكم", "تقويم المواعيد", "إدارة جهات الاتصال"] }, { name: "برو", price: "199 MAD", period: "/ شهر", desc: "لتسيير نشاط في نمو.", cta: "اختر برو", featured: true, items: ["كل ما في الأساسي", "العقود والخزنة القانونية", "التقارير والتصدير", "الأدوار والصلاحيات"] }, { name: "فريق", price: "499 MAD", period: "/ شهر", desc: "لفريق يريد التقدم أكثر.", cta: "تواصل معنا", items: ["كل ما في برو", "مساحة متعددة المستخدمين", "سجل تدقيق متقدم", "دعم ذو أولوية"] }] },
    blog: { eyebrow: "الموارد", title: "مجلة فاتورتي.", posts: [{ tag: "الإدارة", title: "5 مواعيد لا يجب تفويتها", desc: "طريقة بسيطة لتنظيم التزاماتك الشهرية والفصلية.", date: "12 شتنبر 2026", iso: "2026-09-12" }, { tag: "الامتثال", title: "جهّز عقودك بثقة أكبر", desc: "ما يجب مراجعته قبل توقيع عقد خدمة في المغرب.", date: "04 شتنبر 2026", iso: "2026-09-04" }, { tag: "الخزينة", title: "أين تذهب ميزانية أدواتك؟", desc: "كيف تكتشف الاشتراكات غير المستخدمة وتتحكم في التكاليف.", date: "28 غشت 2026", iso: "2026-08-28" }] },
    faq: { eyebrow: "الأسئلة الشائعة", title: "أسئلة متكررة.", items: [
      { q: "ما هي فاتورتي؟", a: "فاتورتي تطبيق إدارة مصمم للهاتف للحرفيين والمستقلين والمقاولات الصغيرة في المغرب. يجمع المواعيد والعقود والاشتراكات وتنبيهات الامتثال. ليس برنامج محاسبة معتمداً: الإقرارات الجبائية تبقى لدى المديرية العامة للضرائب." },
      { q: "هل فاتورتي مجانية أم مدفوعة؟", a: "خطة الأساسي بـ 0 درهم للبدء، دون بطاقة بنكية. برو بـ 199 درهماً في الشهر والفريق بـ 499 درهماً في الشهر. الأسعار بالدرهم في صفحة الأسعار، ويمكن تغيير الخطة أو إيقافها في أي وقت." },
      { q: "هل فاتورتي متوافقة مع اللجنة الوطنية؟", a: "صُمم المنتج للقانون 09-08: وصول محدود إلى الحساب، دون بيع للبيانات، وقياس الجمهور فقط بعد الموافقة. يبقى التصريح بالمعالجة لدى اللجنة، عندما يكون مطلوباً، على عاتق المسؤول عن المعالجة." },
      { q: "ما الفرق مع برنامج محاسبة؟", a: "برنامج المحاسبة يُنتج اليومية والميزانية والإقرارات. فاتورتي تدير اليومي: المواعيد والعقود وتكلفة الأدوات والمخاطر. الاثنان يتكاملان. فاتورتي لا تُودع الإقرار لدى الضرائب." },
      { q: "هل فاتورتي مناسبة للشركات المغربية الصغيرة؟", a: "نعم. صُممت للحرفيين والمستقلين والفرق التي تريد إدارة عملية دون تعقيد، بالفرنسية والعربية." },
      { q: "هل يمكنني استخدام فاتورتي على الهاتف؟", a: "نعم. الواجهة مصممة للهاتف وتعمل بشكل مريح على الهاتف واللوحة والحاسوب." },
      { q: "هل بياناتي محمية؟", a: "تطبق فاتورتي صلاحيات وصول وجلسات آمنة وسجل تدقيق للإجراءات المهمة. راجع سياسة الخصوصية وصفحة اللجنة حول القانون 09-08." },
      { q: "هل يمكنني تغيير الخطة؟", a: "نعم. يمكنك تعديل خطتك مع نمو النشاط. التصدير متاح في برو والفريق. قد تتجاوز مدة الحفظ القانونية مدة الحساب." },
    ] },
    contact: { eyebrow: "تواصل معنا", title: "لنتحدث عن نشاطك.", sub: "لديك سؤال حول فاتورتي أو الأسعار أو طريقة الانطلاق؟ فريقنا يجيبك.", email: CONTACT_EMAIL, phone: CONTACT_PHONE, city: `${CONTACT_CITY}، المغرب`, cta: "راسل الفريق" },
    legal: {
      privacy: "سياسة الخصوصية",
      privacyText: "تتعامل فاتورتي مع بياناتك الشخصية بهدف واحد: منحك مساحة عمل آمنة، دون بيعها أو استخدامها لأغراض إعلانية أبداً.\n\nالبيانات التي نجمعها — عند إنشاء حساب، نجمع اسمك وبريدك الإلكتروني والبيانات المهنية التي تُدخلها (العملاء، المشاريع، المصاريف، العقود، إلخ). تُخزَّن هذه البيانات بشكل آمن وتحميها قواعد وصول صارمة (Row Level Security)، بحيث لا يصل إليها سواك وأعضاء فريقك الذين تُصرّح لهم بذلك.\n\nبدون إعلانات — لا تعرض فاتورتي أي إعلانات، ولا تشارك أو تؤجر أو تبيع بياناتك لأي معلنين أو وسطاء بيانات، تحت أي شكل.\n\nGoogle Analytics — نستخدم فقط أداة Google Analytics، وذلك حصراً لفهم كيفية استخدام موقعنا (الصفحات المُزارة، مدة الزيارة، مصدر الزيارات) من أجل تحسين فاتورتي. تُستخدم هذه الإحصاءات بشكل مُجمّع لتطوير الموقع، وليس لاستهدافك إعلانياً أبداً. لا تُفعَّل هذه الأداة إلا إذا وافقت على ملفات قياس الجمهور عبر شريط الموافقة، ويمكنك رفضها في أي وقت (راجع سياسة ملفات الارتباط). وتسجل فاتورتي أيضاً مشاهدات صفحات داخلية بعد الموافقة نفسها، مقتصرة على مسار الصفحة واللغة ونطاق الإحالة، دون عنوان IP أو حساب أو معرّف ملف ارتباط/جلسة أو رابط إحالة كامل. ويمكن لمشغل المنصة تعطيل هذا القياس الداخلي.\n\nمدة الاحتفاظ — تُحفظ بياناتك طالما حسابك نشط. عند حذف حسابك، تُحذف بياناتك أو يُعمَّم إخفاء هويتها خلال مدة معقولة، إلا إذا فرض القانون مدة احتفاظ أطول (المحاسبة، الضرائب).\n\nالأمان — الوصول إلى بياناتك محمي بمصادقة آمنة وتشفير أثناء النقل (HTTPS) وضوابط وصول على مستوى قاعدة البيانات. راجع سياسة الأمان لدينا لمزيد من التفاصيل.\n\nالتحديثات — قد تتطور هذه السياسة مع الوقت؛ يظهر تاريخ آخر تحديث أسفل هذه الصفحة.",
      terms: "شروط الاستخدام",
      termsText: "فاتورتي مساحة إدارة للحرفيين والمستقلين والشركات الصغيرة في المغرب. إنشاء حساب يعني قبول هذه الشروط.\n\nغاية الخدمة — تساعد فاتورتي على متابعة المواعيد والعقود والمصاريف والاشتراكات والوثائق. لا تحل محل محاسب ولا محامٍ ولا إقرار يُودع لدى المديرية العامة للضرائب. الأرقام في عروض الموقع (1 720 درهماً، +12٪) أمثلة وليست أرقامك.\n\nالحساب — تقدّم معلومات صحيحة وتحافظ على سرية بيانات الدخول. أنت مسؤول عن البيانات المهنية التي تُدخلها.\n\nالسعر — الخطط السارية هي المنشورة في صفحة الأسعار بالدرهم: 0 درهم للبدء، و199 درهماً شهرياً لبرو، و499 درهماً شهرياً للفريق. خطة البدء لا تطلب بطاقة بنكية. يمكنك تغيير الخطة أو التوقف. تبقى التزامات الحفظ المحاسبية أو الجبائية على عاتقك.\n\nالبيانات — معالجة البيانات الشخصية موصوفة في سياسة الخصوصية وتندرج في القانون 09-08. فاتورتي لا تبيع بياناتك.\n\nالاستخدام المشروع — لا تستخدم الخدمة لخرق القانون أو انتحال هوية أو الدخول إلى حساب شخص آخر.\n\nالتطور والقانون الواجب التطبيق — قد تتطور الوظائف. يسري القانون المغربي. للأسئلة: bonjour@fatorati.tech، طنجة.",
      cookies: "سياسة ملفات الارتباط",
      cookiesText: "ملف تعريف الارتباط (cookie) هو ملف صغير يُوضع على جهازك عند زيارتك للموقع. إليك الملفات التي نستخدمها على fatorati.tech، والغرض منها.\n\nملفات ضرورية بشكل صارم — تُستخدم لتشغيل الموقع نفسه (حفظ اختيارك للغة والمظهر وموافقتك على ملفات الارتباط). لا يمكن تعطيلها ولا تتطلب موافقتك.\n\nملفات قياس الجمهور (Google Analytics) — الأداة الخارجية الوحيدة التي نستخدمها هي Google Analytics، وذلك حصراً لفهم حركة الزوار على الموقع (الصفحات المُزارة، مدة الزيارة، نوع الجهاز، المصدر التقريبي) والمساعدة على نمو الموقع. لا تُوضع هذه الملفات إلا إذا ضغطت على «موافقة» في الشريط، ويمكنك الرفض في أي وقت دون أن يؤثر ذلك على وصولك للموقع. وبشكل منفصل، تسجل فاتورتي مشاهدات الصفحة داخلياً بعد الموافقة نفسها، دون ملف ارتباط أو معرّف زائر: المسار واللغة ونطاق الإحالة فقط. ويمكن لمشغل المنصة تعطيل هذا القياس الداخلي.\n\nبدون ملفات إعلانية — لا تضع فاتورتي أي ملفات إعلانية، ولا تقوم بإعادة الاستهداف، ولا تشارك أي بيانات تصفح مع شبكات إعلانية أو منصات التواصل الاجتماعي.\n\nإدارة تفضيلاتك — يمكنك قبول أو رفض ملفات قياس الجمهور عبر الشريط الذي يظهر عند أول زيارة لك. يُحفظ اختيارك على جهازك، ويمكنك تغييره بمسح بيانات هذا الموقع من متصفحك.\n\nلأي سؤال حول هذه السياسة، راسلنا على bonjour@fatorati.tech.",
    },
  },
}

export default function Landing({ onEnter = () => {}, initialPage, initialBlogPosts, initialSiteCmsData }: { onEnter?: () => void; initialPage?: LandingPage; initialBlogPosts?: PublicBlogPost[]; initialSiteCmsData?: PublicSiteCmsData } = {}) {
  const [theme, setTheme] = useState<Theme>("light")
  const [siteCmsData, setSiteCmsData] = useState<PublicSiteCmsData | undefined>(initialSiteCmsData)
  const path = useRoutePath()
  const previousPath = useRef(path)
  // SPA navigation keeps the document mounted, so restore the usual page-load
  // behavior and start each newly selected route at the top of the page.
  useEffect(() => {
    if (previousPath.current === path) return
    previousPath.current = path
    window.scrollTo({ top: 0 })
  }, [path])

  // The URL decides *both* the language and the page: `/ar/pricing` is the
  // Arabic pricing page, `/pricing` the French one. Language used to be
  // component state, which meant one URL served three languages and no
  // `hreflang` was possible; now every language has its own document, its own
  // canonical and a switcher that navigates (so the back button undoes it and
  // the choice survives a reload or a share).
  const route = localeRoute(path)
  const lang: Lang = route.locale
  // `initialPage` only matters while prerendering (the server has no URL of
  // its own); in the browser the page always comes from the real URL, so
  // every screen keeps its own link, reload and share behaviour.
  const page: LandingPage = initialPage ?? landingPageFromPath(route.path) ?? "home"
  const landingRef = useLandingMotion(page)
  const t = T[lang]
  const extra = EXTRA[lang]
  const rtl = isRTL(lang)
  const currentSiteCmsData = siteCmsData && normalizePath(siteCmsData.path) === normalizePath(path) && siteCmsData.locale === lang ? siteCmsData : undefined

  useEffect(() => {
    let active = true
    const matches = initialSiteCmsData && normalizePath(initialSiteCmsData.path) === normalizePath(path) && initialSiteCmsData.locale === lang
    setSiteCmsData(matches ? initialSiteCmsData : undefined)
    void getPublishedSiteCmsData(path, lang).then((data) => {
      if (active) setSiteCmsData(data)
    }).catch(() => {
      if (active && !matches) setSiteCmsData(undefined)
    })
    return () => { active = false }
  }, [path, lang, initialSiteCmsData])

  /** The language switcher is a navigation, not a re-render. */
  function changeLocale(next: LocaleId) {
    if (next === lang) return
    navigate(localizedLandingPath(page, next))
  }

  usePageHead(page, lang, t, extra)
  useEffect(() => {
    const head = buildManagedSiteHead(currentSiteCmsData, page, lang)
    if (head) applyCustomDocumentHead(head)
  }, [currentSiteCmsData, page, lang])
  useMarketingAnalytics()
  useSiteVisitTracking(path, lang)

  useEffect(() => {
    // The document language must follow the URL: `<html lang="fr">` on the
    // Arabic tree makes screen readers read it with the wrong voice and tells
    // crawlers the wrong thing. Restored on unmount (the signed-in app is
    // French-only). `applyDocumentHead` sets the same two attributes — this
    // effect exists to put them back if the visitor leaves the public site.
    const root = document.documentElement
    const previousLang = root.lang
    const previousDir = root.dir
    root.lang = lang
    root.dir = rtl ? "rtl" : "ltr"
    return () => {
      root.lang = previousLang
      root.dir = previousDir
    }
  }, [lang, rtl])

  // Anchors are gone from every URL, but three kinds of fragment can still
  // reach this component: an old `/#pricing` bookmark (rewritten to the real
  // `/pricing` path a visitor can share), a legacy in-page deep link, and
  // Supabase's recovery callback (`#access_token=…`), which must be left
  // untouched for supabase-js to consume.
  useEffect(() => {
    const rawHash = typeof window === "undefined" ? "" : window.location.hash.slice(1)
    if (rawHash && !rawHash.includes("=")) {
      let id = ""
      try { id = decodeURIComponent(rawHash) } catch { id = "" }
      const legacyPage = LANDING_PAGES.find((candidate) => candidate === id)
      if (legacyPage && legacyPage !== "home") {
        // Strip the fragment first: navigating keeps the query and fragment
        // (Supabase's callback relies on that), and this URL must end up clean.
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`)
        navigate(localizedLandingPath(legacyPage, lang), { replace: true })
        return
      }
      const target = id ? document.getElementById(id) : null
      if (target) {
        target.scrollIntoView?.({ block: "start" })
        // Drop the fragment once it has been honoured: the address bar keeps a
        // clean, shareable URL.
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`)
      }
    }

    // A section requested from another page travels in history state
    // (`navigate("/features", { state: { focus: "risk-preview" } })`), not in a
    // fragment, so the URL stays clean.
    const focus = currentHistoryState()?.focus
    if (typeof focus === "string" && document.getElementById(focus)) {
      document.getElementById(focus)?.scrollIntoView?.({ block: "start" })
    }
  }, [page])

  const home = page === "home"
  return (
    <LocaleProvider locale={lang}>
    <div ref={landingRef} className="landing-root landing-atlas min-h-screen antialiased" data-theme={theme} dir={rtl ? "rtl" : "ltr"}>
      <Header t={t} lang={lang} onLocaleChange={changeLocale} theme={theme} setTheme={setTheme} onEnter={onEnter} />
      <main id="main-content">
        <AnnouncementStrip announcements={currentSiteCmsData?.announcements ?? []} locale={lang} />
        {home && <div className="landing-hero-backdrop relative">
          <div className="grid-veil pointer-events-none absolute inset-0 h-[720px]" />
          <Hero t={t} lang={lang} onEnter={onEnter} cmsHomepage={currentSiteCmsData?.homepage ?? null} />
        </div>}
        {currentSiteCmsData?.page?.slug === page ? <ManagedPage page={currentSiteCmsData.page} locale={lang} /> : <>
          {!home && <PageIntro lang={lang} page={page} />}
          {(home || page === "features") && <Features t={t} managedFeatures={currentSiteCmsData?.features ?? []} />}
          {(home || page === "assistant") && <Assistant t={t} onEnter={onEnter} />}
          {(home || page === "about") && <AboutSection copy={extra.about} />}
          {(home || page === "benefits") && <BenefitsSection copy={extra.benefits} />}
          {(home || page === "pricing") && <PricingSection copy={extra.pricing} onEnter={onEnter} locale={lang} path={path} />}
          {(home || page === "pricing") && <OneTimeProductsSection products={currentSiteCmsData?.products ?? []} locale={lang} path={path} />}
          {(home || page === "pricing") && <DownloadReleaseSection releases={currentSiteCmsData?.releases ?? []} downloads={currentSiteCmsData?.downloads ?? []} locale={lang} path={path} />}
          {(home || page === "blog") && <BlogSection copy={extra.blog} locale={lang} showAll={page === "blog"} initialPosts={initialBlogPosts} />}
          {(home || page === "faq") && <FaqSection copy={extra.faq} />}
          {(home || page === "contact") && <ContactSection copy={extra.contact} />}
          {page === "contact" && <SupportRequestForm locale={lang} />}
          {(page === "home" || page === "privacy" || page === "terms" || page === "cookies") && <LegalSection copy={extra.legal} active={page === "home" ? undefined : page} />}
        </>}
        <ReferenceSection lang={lang} />
      </main>
      <Footer t={t} extra={extra} onEnter={onEnter} />
      <CookieBanner lang={lang} />
    </div>
    </LocaleProvider>
  )
}

export function BlogArticlePage({ locale, slug, initialPost, onEnter = () => {} }: { locale: LocaleId; slug: string; initialPost?: PublicBlogPost | null; onEnter?: () => void }) {
  return <LocaleProvider locale={locale}><BlogArticleView locale={locale} slug={slug} initialPost={initialPost} onEnter={onEnter} /></LocaleProvider>
}

export function buildBlogArticleHead(post: PublicBlogPost, locale: LocaleId, siteUrl = SITE_URL): CustomDocumentHeadInput {
  const origin = siteUrl.replace(/\/+$/, "")
  const title = post.seo_title.trim() || post.title
  const description = post.seo_description.trim() || post.excerpt
  const canonical = `${origin}${localizedBlogArticlePath(locale, post.slug)}`
  const publishedDate = validDate(post.published_at) ? new Date(post.published_at).toISOString() : undefined
  const modifiedDate = validDate(post.updated_at) ? new Date(post.updated_at).toISOString() : undefined
  const alternates: HreflangAlternate[] = LOCALES.flatMap((entry) => {
    const translation = post.translations[entry.id]
    return translation ? [{ hreflang: entry.tag, href: `${origin}${localizedBlogArticlePath(entry.id, translation.slug)}` }] : []
  })
  const french = post.translations.fr
  if (french) alternates.push({ hreflang: "x-default", href: `${origin}${localizedBlogArticlePath("fr", french.slug)}` })
  return {
    title,
    description,
    canonical,
    locale,
    alternates,
    siteUrl: origin,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description,
      articleBody: post.content,
      ...(publishedDate ? { datePublished: publishedDate } : {}),
      ...(modifiedDate ? { dateModified: modifiedDate } : {}),
      inLanguage: localeInfo(locale).tag,
      keywords: post.keywords,
      author: { "@type": "Person", name: post.author_name },
      publisher: { "@id": `${origin}/#organization` },
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    },
  }
}

type BlogArticleState = { status: "loading" | "missing" | "error" } | { status: "ready"; post: PublicBlogPost }

function BlogArticleView({ locale, slug, initialPost, onEnter }: { locale: LocaleId; slug: string; initialPost?: PublicBlogPost | null; onEnter: () => void }) {
  const [theme, setTheme] = useState<Theme>("light")
  const [state, setState] = useState<BlogArticleState>(() => initialPost ? { status: "ready", post: initialPost } : { status: "loading" })
  const path = useRoutePath()
  const t = T[locale]
  const extra = EXTRA[locale]
  const ui = {
    fr: { back: "Tous les articles", loading: "Chargement de l’article…", missing: "Cet article n’existe pas ou n’est plus publié.", error: "Impossible de charger cet article pour le moment.", by: "Par", reading: "Article" },
    en: { back: "All articles", loading: "Loading article…", missing: "This article does not exist or is no longer published.", error: "This article could not be loaded right now.", by: "By", reading: "Article" },
    ar: { back: "كل المقالات", loading: "جارٍ تحميل المقال…", missing: "هذا المقال غير موجود أو لم يعد منشوراً.", error: "تعذّر تحميل المقال حالياً.", by: "بقلم", reading: "مقال" },
  }[locale]

  useEffect(() => { window.scrollTo({ top: 0 }) }, [path])
  useEffect(() => {
    let active = true
    if (initialPost && initialPost.slug === slug && initialPost.locale === locale) {
      setState({ status: "ready", post: initialPost })
      return () => { active = false }
    }
    setState({ status: "loading" })
    void getPublishedPostBySlug(locale, slug).then((post) => {
      if (active) setState(post ? { status: "ready", post } : { status: "missing" })
    }).catch(() => {
      if (active) setState({ status: "error" })
    })
    return () => { active = false }
  }, [initialPost, locale, slug])

  const post = state.status === "ready" ? state.post : null
  useEffect(() => {
    if (!post) {
      applyNoIndexHead(state.status === "loading" ? `${ui.loading} | Fatorati` : `${ui.missing} | Fatorati`)
      return
    }
    applyCustomDocumentHead(buildBlogArticleHead(post, locale))
  }, [post, locale, state.status, ui.loading, ui.missing])
  useSiteVisitTracking(path, locale)

  function changeLocale(next: LocaleId) {
    const translatedSlug = post?.translations[next]?.slug
    navigate(translatedSlug ? localizedBlogArticlePath(next, translatedSlug) : localizedLandingPath("blog", next))
  }

  return (
    <div className="landing-root landing-atlas min-h-screen antialiased" data-theme={theme} dir={isRTL(locale) ? "rtl" : "ltr"}>
      <Header t={t} lang={locale} onLocaleChange={changeLocale} theme={theme} setTheme={setTheme} onEnter={onEnter} />
      <main id="main-content" className="mx-auto min-h-[55vh] max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <a href={localizedLandingPath("blog", locale)} onClick={onInternalLinkClick} className="mb-8 inline-flex items-center gap-2 text-[13px] font-semibold text-blue-400">
          <ArrowRight className="h-4 w-4 rtl:rotate-180" /> {ui.back}
        </a>
        {post ? <article itemScope itemType="https://schema.org/BlogPosting" className="mx-auto max-w-3xl">
          <header className="border-b border-[var(--l-border)] pb-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-blue-400">{ui.reading}</p>
            <h1 itemProp="headline" className="font-display mt-3 text-[32px] font-extrabold leading-tight text-[var(--l-heading)] sm:text-[44px]">{post.title}</h1>
            {post.excerpt && <p itemProp="description" className="mt-5 text-[16px] leading-relaxed text-[var(--l-muted)]">{post.excerpt}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[var(--l-faint)]">
              <span>{ui.by} <span itemProp="author">{post.author_name}</span></span>
              {validDate(post.published_at) && <time itemProp="datePublished" dateTime={new Date(post.published_at).toISOString()}>{new Intl.DateTimeFormat(localeInfo(locale).tag, { dateStyle: "long" }).format(new Date(post.published_at))}</time>}
            </div>
          </header>
          <div itemProp="articleBody" className="prose prose-slate mt-9 max-w-none text-[15px] leading-8 text-[var(--l-text)] dark:prose-invert">
            {renderBlogBody(post.content)}
          </div>
        </article> : <div role={state.status === "error" || state.status === "missing" ? "alert" : "status"} className="mx-auto max-w-3xl rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] px-6 py-10 text-center text-[14px] text-[var(--l-muted)]">
          {state.status === "loading" ? ui.loading : state.status === "error" ? ui.error : ui.missing}
        </div>}
      </main>
      <Footer t={t} extra={extra} onEnter={onEnter} />
      <CookieBanner lang={locale} />
    </div>
  )
}

function renderBlogBody(content: string): React.ReactNode[] {
  const blocks = content.replace(/\r/g, "").trim().split(/\n\s*\n/).filter(Boolean)
  return blocks.map((block, index) => {
    const heading = /^(#{1,3})\s+(.+)$/.exec(block.trim())
    if (heading) {
      const level = Math.min(heading[1].length + 1, 4)
      if (level === 2) return <h2 key={index} className="font-display mt-8 text-[24px] font-bold text-[var(--l-heading)]">{heading[2]}</h2>
      if (level === 3) return <h3 key={index} className="font-display mt-7 text-[20px] font-bold text-[var(--l-heading)]">{heading[2]}</h3>
      return <h4 key={index} className="font-display mt-6 text-[18px] font-bold text-[var(--l-heading)]">{heading[2]}</h4>
    }
    const lines = block.split("\n")
    if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
      return <ul key={index} className="my-5 list-disc space-y-2 ps-6">{lines.map((line, itemIndex) => <li key={itemIndex}>{line.replace(/^\s*[-*]\s+/, "")}</li>)}</ul>
    }
    if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
      return <ol key={index} className="my-5 list-decimal space-y-2 ps-6">{lines.map((line, itemIndex) => <li key={itemIndex}>{line.replace(/^\s*\d+\.\s+/, "")}</li>)}</ol>
    }
    return <p key={index} className="my-5 whitespace-pre-line">{block}</p>
  })
}

export type Dict = (typeof T)["fr"]

/* ------------------------------- Buttons -------------------------- */

function GlowButton({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return <button type="button" onClick={onClick} className={`landing-primary ${className}`}>{children}</button>
}

function GhostLink({ children, href, className = "" }: { children: React.ReactNode; href: string; className?: string }) {
  return <a href={href} onClick={onInternalLinkClick} className={`landing-secondary inline-flex items-center justify-center gap-2 ${className}`}>{children}</a>
}

function LandingBrand({ size = 34, alt = "" }: { size?: number; alt?: string }) {
  /**
   * The landing header and footer sit on a light surface that may become dark
   * navy when the visitor switches theme, so this is the `auto` treatment: both
   * files in the DOM, CSS picks one per theme (see `.landing-brand` in
   * landing.css). No script reads the theme, so the mark is already right on the
   * first painted frame.
   *
   * `alt` is the caller's business: the header passes nothing because the link
   * around it is labelled "Fatorati accueil", the footer passes the brand name
   * because that mark is the only place the name appears in that column, and
   * the dashboard mock-up keeps it decorative.
   */
  return <span className="landing-brand"><Brand height={size} tone="auto" alt={alt} /></span>
}

/**
 * The three feature previews are scroll targets *inside* `/features`, not
 * pages of their own — so they must not invent a `#fragment` URL. If the
 * target is already on screen (homepage or the features page) we scroll to
 * it; otherwise we navigate to `/features` and carry the target in history
 * state, which the `page` effect above honours after the render.
 */
function goToFeaturePreview(event: React.MouseEvent<HTMLAnchorElement>, id: string, featuresHref: string): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = event.currentTarget
  if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return
  event.preventDefault()
  const target = document.getElementById(id)
  if (target) {
    target.scrollIntoView?.({ block: "start" })
    return
  }
  navigate(featuresHref, { state: { focus: id } })
}

/* ------------------------------- Controls ------------------------- */

function LangSwitcher({ lang, onLocaleChange }: { lang: LocaleId; onLocaleChange: (next: LocaleId) => void }) {
  const [open, setOpen] = useState(false)
  const current = LANGS.find((l) => l.code === lang)!
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="landing-control inline-flex items-center gap-1.5 rounded-lg border border-[var(--l-border-strong)] bg-[var(--l-chip)] px-2.5 py-2 text-[12.5px] font-semibold text-[var(--l-text)] transition-colors hover:border-blue-400/50"
        aria-haspopup="listbox" aria-expanded={open}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline" lang={current.code}>{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <ul className="absolute end-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-[var(--l-border-strong)] bg-[var(--l-panel)] py-1 shadow-2xl" style={{ animation: "mz-pop .15s ease-out" }} role="listbox">
            {LANGS.map((l) => (
              <li key={l.code}>
                <button
                  onClick={() => { onLocaleChange(l.code); setOpen(false) }}
                  className={`flex w-full items-center justify-between px-3.5 py-2 text-[13px] transition-colors hover:bg-blue-500/10 ${l.code === lang ? "font-bold text-[var(--l-heading)]" : "text-[var(--l-muted)]"}`}
                  role="option" aria-selected={l.code === lang} lang={l.code}
                >
                  {l.label} {l.code === lang && <Check className="h-3.5 w-3.5 text-blue-400" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const dark = theme === "dark"
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="landing-control grid h-9 w-9 place-items-center rounded-lg border border-[var(--l-border-strong)] bg-[var(--l-chip)] text-[var(--l-text)] transition-all hover:border-blue-400/50 hover:text-[var(--l-heading)]"
      title={dark ? "Mode clair" : "Mode sombre"} aria-label="Basculer le thème"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

/* -------------------------------- Header -------------------------- */

const MOBILE_NAV_LINKS: { section: Exclude<LandingPage, "home">; key: keyof Dict["nav"] }[] = [
  { section: "features", key: "features" },
  { section: "assistant", key: "assistant" },
  { section: "benefits", key: "benefits" },
  { section: "pricing", key: "pricing" },
  { section: "blog", key: "blog" },
  { section: "faq", key: "faq" },
  { section: "about", key: "about" },
  { section: "contact", key: "contact" },
]

const NAV_UI = {
  fr: { signIn: "Se connecter", expand: "Explorer les fonctionnalités", overview: "Toutes les fonctionnalités" },
  en: { signIn: "Sign in", expand: "Explore features", overview: "All features" },
  ar: { signIn: "تسجيل الدخول", expand: "استكشاف الميزات", overview: "جميع الميزات" },
}

function Header({ t, lang, onLocaleChange, theme, setTheme, onEnter }: { t: Dict; lang: Lang; onLocaleChange: (next: LocaleId) => void; theme: Theme; setTheme: (t: Theme) => void; onEnter: () => void }) {
  // Every internal link is built for the locale we are rendering, so a visitor
  // reading the Arabic site never gets dropped back into the French one.
  const to = useLocaleHref()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopOpen, setDesktopOpen] = useState(false)
  const menuId = useId()
  const desktopId = useId()
  const headerRef = useRef<HTMLElement>(null)
  const mobileButton = useRef<HTMLButtonElement>(null)
  const desktopButton = useRef<HTMLButtonElement>(null)
  const desktopPanel = useRef<HTMLDivElement>(null)
  const focusDesktop = useRef(false)
  const ui = NAV_UI[lang]
  const cards = [
    { id: "calendar-preview", icon: CalendarDays, title: t.f1.title, description: t.f1.desc },
    { id: "risk-preview", icon: ShieldAlert, title: t.f2.title, description: t.f2.desc },
    { id: "tools-preview", icon: Wrench, title: t.f3.title, description: t.f3.desc },
  ]

  useEffect(() => {
    const wide = window.matchMedia?.("(min-width: 1160px)")
    if (!wide) return
    const closeHiddenMenu = () => { if (wide.matches) setMobileOpen(false); else setDesktopOpen(false) }
    wide.addEventListener?.("change", closeHiddenMenu)
    return () => wide.removeEventListener?.("change", closeHiddenMenu)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = previous }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen && !desktopOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (mobileOpen) { setMobileOpen(false); mobileButton.current?.focus() }
      if (desktopOpen) { setDesktopOpen(false); desktopButton.current?.focus() }
    }
    function onOutside(event: PointerEvent) {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setDesktopOpen(false)
    }
    window.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onOutside)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onOutside)
    }
  }, [mobileOpen, desktopOpen])

  useEffect(() => {
    if (desktopOpen && focusDesktop.current) {
      desktopPanel.current?.querySelector<HTMLAnchorElement>("a")?.focus()
      focusDesktop.current = false
    }
  }, [desktopOpen])

  function enter() { setMobileOpen(false); setDesktopOpen(false); onEnter() }

  const featuresHref = to("features")

  return (
    <header ref={headerRef} className="landing-header" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDesktopOpen(false)
    }}>
      <div className="landing-nav-shell">
        <a href={to("/")} aria-label="Fatorati accueil" onClick={(event) => { onInternalLinkClick(event); setMobileOpen(false); setDesktopOpen(false) }}><LandingBrand /></a>
        <nav className="landing-nav-desktop" aria-label="Navigation du site">
          <div className="landing-nav-feature">
            <a href={featuresHref} onClick={(event) => { onInternalLinkClick(event); setDesktopOpen(false) }}>{t.nav.features}</a>
            <button ref={desktopButton} type="button" className="landing-nav-expand" aria-label={ui.expand}
              aria-expanded={desktopOpen} aria-controls={desktopId} onClick={() => setDesktopOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown") return
                event.preventDefault()
                if (desktopOpen) desktopPanel.current?.querySelector<HTMLAnchorElement>("a")?.focus()
                else { focusDesktop.current = true; setDesktopOpen(true) }
              }}><ChevronDown className="h-4 w-4" /></button>
          </div>
          {MOBILE_NAV_LINKS.filter((link) => link.key !== "features").map((link) => (
            <a key={link.section} href={to(link.section)} onClick={(event) => { onInternalLinkClick(event); setDesktopOpen(false) }}>{t.nav[link.key]}</a>
          ))}
        </nav>
        <div className="landing-nav-actions">
          <div className="landing-nav-preferences"><LangSwitcher lang={lang} onLocaleChange={onLocaleChange} /><ThemeToggle theme={theme} setTheme={setTheme} /></div>
          <button type="button" className="landing-login-link" onClick={enter}>{ui.signIn}</button>
          <GlowButton onClick={enter}>{t.signup}</GlowButton>
          <button ref={mobileButton} type="button" className="landing-menu-toggle"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={mobileOpen} aria-controls={menuId}
            onClick={() => { setDesktopOpen(false); setMobileOpen((open) => !open) }}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {desktopOpen && <div ref={desktopPanel} id={desktopId} className="landing-mega-menu" role="region" aria-label={t.nav.features}>
        <div className="landing-mega-inner">
          <div className="landing-mega-intro"><p>{t.feat.title}</p><a href={featuresHref} onClick={(event) => { onInternalLinkClick(event); setDesktopOpen(false) }}>{ui.overview} <ArrowRight className="h-4 w-4" /></a></div>
          <div className="landing-mega-grid">{cards.map(({ id, icon: Icon, title, description }) => (
            <a key={id} href={featuresHref} className="landing-mega-card" onClick={(event) => { setDesktopOpen(false); goToFeaturePreview(event, id, featuresHref) }}>
              <span className="landing-mega-icon"><Icon className="h-5 w-5" /></span><span><strong>{title}</strong><small>{description}</small></span>
            </a>
          ))}</div>
        </div>
      </div>}
      {mobileOpen && <>
        <button type="button" className="landing-mobile-overlay" aria-label="Fermer la navigation" tabIndex={-1} onClick={() => setMobileOpen(false)} />
        <div id={menuId} className="landing-mobile-panel">
          <nav aria-label="Navigation principale">{MOBILE_NAV_LINKS.map((link) => (
            <a key={link.section} href={to(link.section)} onClick={(event) => { onInternalLinkClick(event); setMobileOpen(false) }}>{t.nav[link.key]}</a>
          ))}</nav>
          <div className="mt-5 flex items-center gap-3"><LangSwitcher lang={lang} onLocaleChange={onLocaleChange} /><ThemeToggle theme={theme} setTheme={setTheme} /></div>
          <GlowButton onClick={enter} className="mt-5 w-full">{t.signup}</GlowButton>
        </div>
      </>}
    </header>
  )
}

/* --------------------------------- Hero --------------------------- */

function Hero({ t, lang, onEnter, cmsHomepage }: { t: Dict; lang: Lang; onEnter: () => void; cmsHomepage: PublicSiteCmsData["homepage"] }) {
  const to = useLocaleHref()
  return (
    <section id="hero" className="landing-hero relative mx-auto max-w-6xl px-5 pb-8 pt-16 sm:px-8 sm:pt-24">
      <div className="landing-hero-copy mx-auto max-w-3xl text-center">
        <h1 className="mz-rise font-display text-[34px] font-extrabold leading-[1.12] tracking-tight text-[var(--l-heading)] sm:text-[52px]" style={{ animationDelay: "0.05s" }}>
          {cmsHomepage?.headline.trim() || t.hero.headline.map((s, i) => s.hi
            ? <span key={i} className="landing-hero-highlight">{s.t}</span>
            : <span key={i}>{s.t}</span>)}
        </h1>
        <p className="mz-rise mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-[var(--l-muted)] sm:text-[17px]" style={{ animationDelay: "0.1s" }}>{cmsHomepage?.subheadline.trim() || t.hero.sub}</p>
        <div className="mz-rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "0.15s" }}>
          <GlowButton onClick={onEnter} className="w-full sm:w-auto">
            {cmsHomepage?.primary_cta.trim() || t.signup} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
          </GlowButton>
          <GhostLink href={to("features")} className="w-full sm:w-auto">{t.explore}</GhostLink>
        </div>
        <p className="landing-hero-note mz-rise mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--l-faint)]" style={{ animationDelay: "0.2s" }}>
          <Check className="h-3.5 w-3.5 text-blue-400" /> {t.hero.note}
        </p>
      </div>

      {cmsHomepage?.feature_cards?.length ? <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
        {cmsHomepage.feature_cards.slice(0, 3).map((value, index) => {
          const item = value && typeof value === "object" ? value as Record<string, unknown> : {}
          const title = typeof item.title === "string" ? item.title : ""
          const description = typeof item.description === "string" ? item.description : ""
          return title ? <article key={`${title}:${index}`} className="rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-4 text-start"><h2 className="text-[13px] font-bold text-[var(--l-heading)]">{title}</h2>{description && <p className="mt-1 text-[11px] leading-relaxed text-[var(--l-muted)]">{description}</p>}</article> : null
        })}
      </div> : null}
      {cmsHomepage?.hero_image_url ? <img src={cmsHomepage.hero_image_url} alt={cmsHomepage.headline || t.hero.sub} className="mx-auto mt-14 max-h-[540px] w-full max-w-5xl rounded-2xl border border-[var(--l-border-strong)] object-cover shadow-2xl" /> : <DashboardPreview t={t} />}
    </section>
  )
}

/* ------------------- Dashboard preview mockup --------------------- */

const previewIcons = [LayoutDashboard, FileText, CalendarDays, ShieldAlert, Wrench]

function DashboardPreview({ t }: { t: Dict }) {
  return (
    <div className="landing-demo mz-rise relative mt-14 sm:mt-20" style={{ animationDelay: "0.25s" }}>
      <div className="landing-demo-glow mz-glow pointer-events-none absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[40px] blur-3xl" style={{ background: "radial-gradient(50% 50% at 50% 30%, rgba(37,99,235,0.3), transparent 70%)" }} />
      <div className="landing-demo-window overflow-hidden rounded-2xl border border-[var(--l-border-strong)] bg-[var(--l-panel)] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="flex items-center gap-1.5 border-b border-[var(--l-border)] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--l-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--l-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--l-border-strong)]" />
          <span className="mx-3 rounded-md bg-[var(--l-chip)] px-2 py-0.5 font-mono text-[10.5px] text-[var(--l-faint)]">fatorati.tech/dashboard</span>
        </div>

        <div className="flex">
          <aside className="hidden w-[184px] shrink-0 flex-col gap-1 border-e border-[var(--l-border)] bg-[var(--l-surface)] p-3 sm:flex">
            <div className="px-2 pb-3"><LandingBrand size={28} /></div>
            {t.prev.nav.map((label, i) => {
              const Icon = previewIcons[i]
              const active = i === 4
              return (
                <div key={label} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium ${active ? "text-white" : "text-[var(--l-muted)]"}`} style={active ? { backgroundImage: DASHBOARD_GRAD } : undefined}>
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 2} /> {label}
                </div>
              )
            })}
            <div className="mt-auto rounded-lg border border-[var(--l-border)] bg-[var(--l-panel-2)] p-2.5">
              <p className="text-[10.5px] text-[var(--l-faint)]">{t.prev.plan}</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-[var(--l-border-strong)]"><div className="h-full w-2/3 rounded-full" style={{ backgroundImage: DASHBOARD_GRAD }} /></div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-[var(--l-faint)]">{t.prev.greet}</p>
                <p className="font-display text-[16px] font-bold text-[var(--l-heading)]">{t.prev.title}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-white" style={{ backgroundImage: DASHBOARD_GRAD }}>
                <Plus className="h-3.5 w-3.5" /> {t.prev.add}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[t.prev.stats[0] && ["1 720", "MAD", t.prev.stats[0]], ["14", "", t.prev.stats[1]], ["3", "", t.prev.stats[2]]].map((s) => (
                <div key={s[2]} className="rounded-xl border border-[var(--l-border)] bg-[var(--l-panel-2)] p-3">
                  <p className="text-[10px] text-[var(--l-faint)]">{s[2]}</p>
                  <p className="mt-1 font-mono text-[17px] font-bold text-[var(--l-heading)]">{s[0]}<span className="ms-0.5 text-[10px] font-medium text-[var(--l-faint)]">{s[1]}</span></p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-[var(--l-border)] bg-[var(--l-panel-2)] p-3.5">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[11.5px] font-semibold text-[var(--l-text)]">{t.prev.trend}</p>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-400"><TrendingUp className="h-3 w-3" /> +12%</span>
              </div>
              <TrendChart height={90} />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] text-[var(--l-faint)]">{t.prev.caption}</p>
    </div>
  )
}

/* --------------------------- Trend chart -------------------------- */

const SPEND = [1240, 1180, 1420, 1360, 1580, 1490, 1720]
const SPEND_LABELS = ["Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû"]

function TrendChart({ height = 120 }: { height?: number }) {
  const gid = useId().replace(/:/g, "")
  const [hover, setHover] = useState<number | null>(null)
  const W = 520
  const H = height
  const padX = 10
  const padTop = 12
  const padBot = 10
  const iw = W - padX * 2
  const ih = H - padTop - padBot
  const max = Math.max(...SPEND) * 1.12
  const min = Math.min(...SPEND) * 0.88
  const n = SPEND.length
  const x = (i: number) => padX + (i / (n - 1)) * iw
  const y = (v: number) => padTop + ih - ((v - min) / (max - min)) * ih
  const line = SPEND.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  const area = `${line} L ${x(n - 1)} ${padTop + ih} L ${x(0)} ${padTop + ih} Z`

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - padX) / iw) * (n - 1)))))
  }

  return (
    <div className="relative" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${gid}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <line x1={padX} x2={W - padX} y1={padTop + ih * 0.5} y2={padTop + ih * 0.5} stroke="rgba(148,163,184,0.18)" strokeWidth={1} />
        <path d={area} fill={`url(#${gid}-fill)`} />
        <path d={line} fill="none" stroke={`url(#${gid}-stroke)`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={padTop + ih} stroke="rgba(24,104,219,0.5)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(SPEND[hover])} r={4} fill="var(--l-panel)" stroke="#4a9df5" strokeWidth={2.5} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--l-border-strong)] bg-[var(--l-panel)] px-2.5 py-1.5 text-[11px] shadow-xl" style={{ left: `${(x(hover) / W) * 100}%`, top: y(SPEND[hover]) - 6 }}>
          <span className="font-mono font-semibold text-[var(--l-heading)]">{SPEND[hover].toLocaleString("fr-MA")} MAD</span>
          <span className="ml-1 text-[var(--l-faint)]">{SPEND_LABELS[hover]}</span>
        </div>
      )}
    </div>
  )
}

/* --------------------------- Features ----------------------------- */

function Features({ t, showHeading = true, managedFeatures = [] }: { t: Dict; showHeading?: boolean; managedFeatures?: PublicCmsFeature[] }) {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8">
      {showHeading && <div className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-400">{t.feat.eyebrow}</p>
        <h2 className="font-display mt-3 text-[30px] font-bold tracking-tight text-[var(--l-heading)] sm:text-[38px]">{t.feat.title}</h2>
        <p className="mt-3 text-[15px] text-[var(--l-muted)]">{t.feat.sub}</p>
      </div>}

      <div className={managedFeatures.length ? "mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "mt-14 flex w-full flex-col gap-5"}>
        {managedFeatures.length ? managedFeatures.map((feature) => <CmsFeatureCard key={feature.feature_key} feature={feature} />) : <>
          <FeatureCard id="calendar-preview" icon={CalendarDays} title={t.f1.title} tag={t.f1.tag}>
            <p className="text-[13.5px] leading-relaxed text-[var(--l-muted)]">{t.f1.desc}</p>
            <CalendarWidget t={t} />
          </FeatureCard>
          <FeatureCard id="risk-preview" icon={ShieldAlert} title={t.f2.title} tag={t.f2.tag}>
            <p className="text-[13.5px] leading-relaxed text-[var(--l-muted)]">{t.f2.desc}</p>
            <RiskWidget t={t} />
          </FeatureCard>
          <FeatureCard id="tools-preview" icon={Wrench} title={t.f3.title} tag={t.f3.tag}>
            <p className="text-[13.5px] leading-relaxed text-[var(--l-muted)]">{t.f3.desc}</p>
            <SubscriptionWidget t={t} />
          </FeatureCard>
        </>}
      </div>
    </section>
  )
}

function CmsFeatureCard({ feature }: { feature: PublicCmsFeature }) {
  const iconMap: Record<string, typeof Wrench> = { calendar: CalendarDays, shield: ShieldAlert, tools: Wrench, dashboard: LayoutDashboard, legal: FileText, speed: Zap }
  const Icon = iconMap[feature.icon] ?? Sparkles
  return <article className="flex flex-col overflow-hidden rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] p-5">
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400"><Icon className="h-5 w-5" /></span>
    {feature.image_url && <img src={feature.image_url} alt="" loading="lazy" className="mt-4 max-h-48 w-full rounded-lg object-cover" />}
    <h3 className="font-display mt-4 text-[16px] font-bold text-[var(--l-heading)]">{feature.title}</h3>
    {feature.description && <p className="mt-2 text-[13px] leading-relaxed text-[var(--l-muted)]">{feature.description}</p>}
    {feature.details && <p className="mt-3 whitespace-pre-line text-[12px] leading-relaxed text-[var(--l-faint)]">{feature.details}</p>}
  </article>
}

function FeatureCard({ id, icon: Icon, title, tag, children }: { id: string; icon: typeof Wrench; title: string; tag: string; children: React.ReactNode }) {
  return (
    <div id={id} className="landing-feature-card group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6 transition-all duration-300 hover:border-blue-400/30">
      <div className="pointer-events-none absolute -end-16 -top-16 h-40 w-40 rounded-full bg-blue-600/10 blur-3xl transition-opacity duration-300 group-hover:bg-blue-500/20" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl text-white shadow-[0_8px_24px_-6px_rgba(124,58,237,0.6)]" style={{ backgroundImage: GRAD }}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="rounded-full border border-[var(--l-border-strong)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--l-muted)]">{tag}</span>
      </div>
      <h3 className="font-display relative mt-4 text-[18px] font-bold text-[var(--l-heading)]">{title}</h3>
      <div className="relative mt-2 flex flex-1 flex-col space-y-4">{children}</div>
    </div>
  )
}

const CAL_DOT: Record<"renew" | "pay" | "legal", string> = { renew: GRAD, pay: "linear-gradient(135deg,#f59e0b,#fbbf24)", legal: "linear-gradient(135deg,#e11d48,#fb7185)" }

function CalendarWidget({ t }: { t: Dict }) {
  const marked = new Map(t.cal.events.map((e) => [e.day, e.type]))
  // Sep 2026 starts on a Tuesday → 1 leading blank (Mon-first grid); 30 days.
  const cells: (number | null)[] = [null, ...Array.from({ length: 30 }, (_, i) => i + 1)]
  const [sel, setSel] = useState<number>(23)
  const selEvent = t.cal.events.find((e) => e.day === sel)

  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[12.5px] font-semibold text-[var(--l-heading)]">{t.cal.month}</p>
          <div className="flex flex-wrap justify-end gap-x-2 gap-y-1 text-[9.5px] text-[var(--l-faint)]">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundImage: CAL_DOT.renew }} /> {t.cal.renew}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundImage: CAL_DOT.pay }} /> {t.cal.pay}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundImage: CAL_DOT.legal }} /> {t.cal.legal}</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {t.cal.days.map((d, i) => <span key={i} className="pb-0.5 text-[9.5px] font-semibold text-[var(--l-faint)]">{d}</span>)}
          {cells.map((d, i) => {
            if (d === null) return <span key={i} />
            const mark = marked.get(d)
            const on = sel === d
            return (
              <button
                key={i}
                onClick={() => setSel(d)}
                className={`relative flex aspect-square items-center justify-center rounded-md text-[10.5px] transition-all ${on ? "font-bold text-white ring-2 ring-blue-400/60" : mark ? "font-semibold text-[var(--l-heading)]" : "text-[var(--l-muted)] hover:bg-[var(--l-chip)]"}`}
                style={on ? { backgroundImage: GRAD } : undefined}
              >
                {d}
                {mark && !on && <span className="absolute bottom-1 h-1 w-1 rounded-full" style={{ backgroundImage: CAL_DOT[mark] }} />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-3">
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--l-faint)]">{t.cal.upcoming}</p>
        <ul className="space-y-1.5">
          {t.cal.events.map((e) => (
            <li key={e.day}>
              <button onClick={() => setSel(e.day)} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors ${sel === e.day ? "bg-[var(--l-chip)]" : "hover:bg-[var(--l-chip)]"}`}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[12px] font-bold text-white" style={{ backgroundImage: CAL_DOT[e.type] }}>{e.day}</span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--l-text)]">{e.label}</span>
              </button>
            </li>
          ))}
        </ul>
        {selEvent && <p className="mt-2 border-t border-[var(--l-border)] pt-2 text-[11px] text-[var(--l-accent-text)]">{selEvent.label}</p>}
      </div>
    </div>
  )
}

function RiskWidget({ t }: { t: Dict }) {
  const tone = [
    { tag: "border-rose-500/30 bg-rose-500/10 text-rose-400", bar: "bg-rose-500", icon: "text-rose-400" },
    { tag: "border-amber-500/30 bg-amber-500/10 text-amber-500", bar: "bg-amber-400", icon: "text-amber-500" },
    { tag: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500", bar: "bg-emerald-500", icon: "text-emerald-500" },
  ]
  return (
    <div className="space-y-2">
      {t.f2.items.map((r, i) => {
        const done = i === 2
        return (
          <div key={r.label} className="relative overflow-hidden rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-3 ps-3.5">
            <span className={`absolute inset-y-0 start-0 w-1 ${tone[i].bar}`} />
            <div className="flex items-start gap-2.5">
              {done ? <ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${tone[i].icon}`} /> : <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${tone[i].icon}`} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[12.5px] font-semibold text-[var(--l-heading)]">{r.label}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone[i].tag}`}>{r.level}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--l-muted)]">{r.desc}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SubscriptionWidget({ t }: { t: Dict }) {
  return (
    <div className="space-y-2.5">
      {/* Metric overview blocks */}
      <div className="grid grid-cols-3 gap-2">
        {t.f3.blocks.map(([k, v], i) => (
          <div key={k} className={`rounded-xl border p-2.5 text-center ${i === 0 ? "border-blue-400/30" : "border-[var(--l-border)] bg-[var(--l-panel-2)]"}`} style={i === 0 ? { background: "linear-gradient(160deg, rgba(124,58,237,0.16), rgba(124,58,237,0.03))" } : undefined}>
            <p className="font-mono text-[16px] font-bold text-[var(--l-heading)]">{v}{i === 0 && <span className="ms-0.5 text-[9px] font-medium text-[var(--l-faint)]">MAD</span>}</p>
            <p className="mt-0.5 text-[9px] leading-tight text-[var(--l-faint)]">{k}</p>
          </div>
        ))}
      </div>

      {/* Tool tracking list */}
      <div className="overflow-hidden rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)]">
        <div className="grid grid-cols-[1.6fr_1fr_0.9fr_0.9fr] gap-1 border-b border-[var(--l-border)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--l-faint)]">
          {t.f3.cols.map((c) => <span key={c} className="truncate">{c}</span>)}
        </div>
        {t.f3.tools.map(([name, cost, start, exp], i) => (
          <div key={name} className={`grid grid-cols-[1.6fr_1fr_0.9fr_0.9fr] items-center gap-1 px-3 py-2 text-[11px] ${i > 0 ? "border-t border-[var(--l-border)]" : ""}`}>
            <span className="flex items-center gap-1.5 truncate font-medium text-[var(--l-heading)]"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundImage: GRAD }} />{name}</span>
            <span className="font-mono text-[var(--l-text)]">{cost}</span>
            <span className="font-mono text-[var(--l-faint)]">{start}</span>
            <span className="font-mono text-[var(--l-faint)]">{exp}</span>
          </div>
        ))}
        <button className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-[var(--l-border-strong)] py-2 text-[11px] font-semibold text-blue-400 transition-colors hover:bg-blue-500/5">
          <Plus className="h-3.5 w-3.5" /> {t.f3.add}
        </button>
      </div>

      {/* Spending trend */}
      <div className="rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-[var(--l-text)]">{t.f3.trend}</p>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400"><TrendingUp className="h-3 w-3" /> +12%</span>
        </div>
        <TrendChart height={72} />
      </div>
    </div>
  )
}

/* --------------------------- Assistant ---------------------------- */

function Assistant({ t, onEnter, showHeading = true }: { t: Dict; onEnter: () => void; showHeading?: boolean }) {
  return (
    <section id="assistant" className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-b from-blue-500/10 to-transparent p-8 sm:p-12">
        <div className="mz-glow pointer-events-none absolute end-0 top-0 h-64 w-64 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1.5 text-[12px] font-medium text-[var(--l-accent-text)]">
              <Sparkles className="h-3.5 w-3.5" /> {t.asst.badge}
            </span>
            {showHeading && <h2 className="font-display mt-4 text-[28px] font-bold leading-tight tracking-tight text-[var(--l-heading)] sm:text-[34px]">{t.asst.title}</h2>}
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--l-muted)]">{t.asst.desc}</p>
            <div className="mt-6"><GlowButton onClick={onEnter}>{t.asst.cta} <Zap className="h-4 w-4" /></GlowButton></div>
          </div>

          <div className="rounded-2xl border border-[var(--l-border-strong)] bg-[var(--l-panel)] p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2.5 border-b border-[var(--l-border)] pb-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ backgroundImage: GRAD }}><ScrollText className="h-4 w-4" /></span>
              <div><p className="text-[12.5px] font-semibold text-[var(--l-heading)]">{t.asst.panel}</p><p className="text-[10.5px] text-[var(--l-faint)]">{t.asst.panelSub}</p></div>
            </div>
            <div className="mt-3 space-y-2">
              {t.asst.rules.map((r) => (
                <button key={r} onClick={onEnter} className="flex w-full items-center gap-2.5 rounded-lg border border-[var(--l-border)] bg-[var(--l-panel-2)] px-3 py-2.5 text-start transition-colors hover:border-blue-400/30">
                  <FileText className="h-4 w-4 shrink-0 text-blue-400" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--l-text)]">{r}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--l-faint)] rtl:rotate-180" />
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-[11.5px] text-[var(--l-accent-text)]">
              <ShieldCheck className="h-4 w-4" /> {t.asst.verified}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function AboutSection({ copy, showHeading = true }: { copy: ExtraCopy["about"]; showHeading?: boolean }) {
  return (
    <section id="about" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="grid gap-10 rounded-3xl border border-[var(--l-border)] bg-[var(--l-surface)] p-8 sm:p-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        {showHeading && <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-emerald-400">{copy.eyebrow}</p>
          <h2 className="font-display mt-3 text-[30px] font-bold leading-tight text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2>
        </div>}
        <div>
          <p className="text-[15px] leading-relaxed text-[var(--l-muted)]">{copy.desc}</p>
          <ul className="mt-6 space-y-3">
            {copy.points.map((point) => <li key={point} className="flex items-start gap-2.5 text-[13.5px] text-[var(--l-text)]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{point}</li>)}
          </ul>
        </div>
      </div>
    </section>
  )
}

function BenefitsSection({ copy, showHeading = true }: { copy: ExtraCopy["benefits"]; showHeading?: boolean }) {
  const icons = [Zap, ShieldCheck, Wrench, LayoutDashboard]
  return (
    <section id="benefits" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      {showHeading && <div className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-emerald-400">{copy.eyebrow}</p>
        <h2 className="font-display mt-3 text-[30px] font-bold text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2>
        <p className="mt-3 text-[15px] text-[var(--l-muted)]">{copy.sub}</p>
      </div>}
      <div className="mx-auto mt-12 max-w-3xl space-y-4">
        {copy.items.map((item, i) => {
          const Icon = icons[i]
          return <article key={item.title} className="flex gap-4 rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] p-5 sm:p-6">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-400"><Icon className="h-5 w-5" /></span>
            <div><h3 className="font-display text-[16px] font-bold text-[var(--l-heading)]">{item.title}</h3><p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--l-muted)]">{item.desc}</p></div>
          </article>
        })}
      </div>
    </section>
  )
}

function PricingSection({ copy, onEnter, locale, path, showHeading = true }: { copy: ExtraCopy["pricing"]; onEnter: () => void; locale: LocaleId; path: string; showHeading?: boolean }) {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      {showHeading && <div className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-400">{copy.eyebrow}</p>
        <h2 className="font-display mt-3 text-[30px] font-bold text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2>
        <p className="mt-3 text-[15px] text-[var(--l-muted)]">{copy.sub}</p>
      </div>}
      <div className="mx-auto mt-12 max-w-3xl space-y-4">
        {copy.plans.map((plan) => <article key={plan.name} className={`landing-pricing-card ${plan.featured ? "landing-pricing-featured" : ""} relative rounded-2xl border p-6 sm:p-8 ${plan.featured ? "border-blue-400/50 bg-blue-500/10" : "border-[var(--l-border)] bg-[var(--l-surface)]"}`}>
          {plan.featured && <span className="absolute end-6 top-6 rounded-full bg-blue-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Pro</span>}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div><h3 className="font-display text-[20px] font-bold text-[var(--l-heading)]">{plan.name}</h3><p className="mt-1 text-[13px] text-[var(--l-muted)]">{plan.desc}</p></div>
            <div className="sm:text-end"><span className="font-display text-[28px] font-bold text-[var(--l-heading)]">{plan.price}</span><span className="ms-1 text-[12px] text-[var(--l-faint)]">{plan.period}</span></div>
          </div>
          <div className="mt-6 flex flex-col gap-4 border-t border-[var(--l-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <ul className="space-y-2">{plan.items.map((item) => <li key={item} className="flex items-center gap-2 text-[13px] text-[var(--l-text)]"><Check className="h-3.5 w-3.5 text-emerald-400" />{item}</li>)}</ul>
            <GlowButton onClick={() => { recordSiteEvent("purchase_click", path, `subscription:${plan.name}`, locale); onEnter() }} className="shrink-0 px-4 py-2.5 text-[12.5px]">{plan.cta} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" /></GlowButton>
          </div>
        </article>)}
      </div>
    </section>
  )
}

function BlogSection({ copy, locale, initialPosts, showAll = false, showHeading = true }: { copy: ExtraCopy["blog"]; locale: LocaleId; initialPosts?: PublicBlogPost[]; showAll?: boolean; showHeading?: boolean }) {
  const [posts, setPosts] = useState<PublicBlogPost[]>(() => initialPosts ?? [])
  const [loading, setLoading] = useState(initialPosts === undefined)
  const [loadError, setLoadError] = useState(false)
  const to = useLocaleHref()
  const copyByLocale = {
    fr: { read: "Lire l’article", empty: "Aucun article publié pour le moment.", error: "Les articles ne sont pas disponibles pour le moment." },
    en: { read: "Read article", empty: "No articles have been published yet.", error: "Articles are temporarily unavailable." },
    ar: { read: "اقرأ المقال", empty: "لا توجد مقالات منشورة حالياً.", error: "المقالات غير متاحة مؤقتاً." },
  }[locale]

  useEffect(() => {
    let active = true
    if (initialPosts !== undefined) {
      setPosts(initialPosts)
      setLoading(false)
      setLoadError(false)
      return () => { active = false }
    }
    setLoading(true)
    setLoadError(false)
    void listPublishedPosts(locale).then((items) => {
      if (active) setPosts(items)
    }).catch(() => {
      if (active) { setPosts([]); setLoadError(true) }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [locale, initialPosts])

  const visiblePosts = showAll ? posts : posts.slice(0, 3)
  return (
    <section id="blog" aria-busy={loading} className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      {showHeading && <div className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-400">{copy.eyebrow}</p>
        <h2 className="font-display mt-3 text-[30px] font-bold text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2>
      </div>}
      <div className="mx-auto mt-12 max-w-3xl space-y-4">
        {visiblePosts.map((post) => {
          const date = validDate(post.published_at) ? new Intl.DateTimeFormat(localeInfo(locale).tag, { year: "numeric", month: "short", day: "numeric" }).format(new Date(post.published_at)) : ""
          return <article key={post.id} className="landing-resource-card rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400">{post.keywords[0] ?? copy.eyebrow}</span>{date && <time dateTime={new Date(post.published_at).toISOString()} className="text-[11px] text-[var(--l-faint)]">{date}</time>}</div>
            <h3 className="font-display mt-4 text-[19px] font-bold text-[var(--l-heading)]">{post.title}</h3><p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--l-muted)]">{post.excerpt}</p>
            <a href={localizedBlogArticlePath(locale, post.slug)} onClick={onInternalLinkClick} className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-blue-400">{copyByLocale.read} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" /></a>
          </article>
        })}
        {!loading && !visiblePosts.length && <p role="status" className="rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] px-6 py-8 text-center text-[13px] text-[var(--l-muted)]">{loadError ? copyByLocale.error : copyByLocale.empty}</p>}
        {loading && <p role="status" className="py-8 text-center text-[13px] text-[var(--l-faint)]">{locale === "ar" ? "جارٍ تحميل المقالات…" : locale === "en" ? "Loading articles…" : "Chargement des articles…"}</p>}
      </div>
      {!showAll && posts.length > 3 && <div className="mt-7 text-center"><a href={to("blog")} onClick={onInternalLinkClick} className="inline-flex items-center gap-2 rounded-lg border border-[var(--l-border-strong)] px-4 py-2.5 text-[13px] font-semibold text-[var(--l-heading)] hover:border-blue-400/50">{locale === "ar" ? "كل المقالات" : locale === "en" ? "All articles" : "Tous les articles"} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></a></div>}
    </section>
  )
}

function FaqSection({ copy, showHeading = true }: { copy: ExtraCopy["faq"]; showHeading?: boolean }) {
  /**
   * Native `<details>` rather than a JS accordion: the answer text is part of
   * the HTML document (so it is indexable and citable by search and AI
   * crawlers even without executing JavaScript, and `FAQPage` structured data
   * always matches the rendered text), and keyboard/mobile behaviour comes
   * from the browser instead of our handlers.
   */
  return (
    <section id="faq" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      {showHeading && <div className="mx-auto max-w-2xl text-center"><p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-emerald-400">{copy.eyebrow}</p><h2 className="font-display mt-3 text-[30px] font-bold text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2></div>}
      <div className="mx-auto mt-12 max-w-3xl divide-y divide-[var(--l-border)] rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] px-5 sm:px-7">
        {copy.items.map((item, i) => (
          <details key={item.q} className="landing-faq" open={i === 0}>
            <summary className="flex w-full items-center justify-between gap-4 py-5 text-start">
              <h3 className="text-[14px] font-semibold text-[var(--l-heading)]">{item.q}</h3>
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--l-faint)]" aria-hidden="true" />
            </summary>
            <p className="pb-5 pe-8 text-[13.5px] leading-relaxed text-[var(--l-muted)]">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function AnnouncementStrip({ announcements, locale }: { announcements: PublicCmsAnnouncement[]; locale: LocaleId }) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  const item = announcements.find((announcement) => announcement.id !== dismissed && (!announcement.ends_at || new Date(announcement.ends_at).getTime() > Date.now()))
  if (!item) return null
  const title = item.title_by_locale[locale] || item.title_by_locale.fr || item.title_by_locale.en || item.title_by_locale.ar || ""
  const body = item.body_by_locale[locale] || item.body_by_locale.fr || item.body_by_locale.en || item.body_by_locale.ar || ""
  return <aside aria-live="polite" className={`mx-auto mt-5 flex max-w-6xl items-start gap-3 rounded-xl border px-4 py-3 ${item.severity === "critical" ? "border-rose-400/30 bg-rose-500/10" : item.severity === "warning" ? "border-amber-400/30 bg-amber-500/10" : "border-blue-400/25 bg-blue-500/10"}`}>
    <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" /><div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-[var(--l-heading)]">{title}</p>{body && <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-[var(--l-muted)]">{body}</p>}</div>
    <button type="button" onClick={() => setDismissed(item.id)} aria-label={locale === "ar" ? "إغلاق الإعلان" : locale === "en" ? "Dismiss announcement" : "Fermer l’annonce"} className="rounded p-1 text-[var(--l-faint)] hover:bg-black/5"><X className="h-4 w-4" /></button>
  </aside>
}

function ManagedPage({ page, locale }: { page: NonNullable<PublicSiteCmsData["page"]>; locale: LocaleId }) {
  return <article className="mx-auto min-h-[55vh] max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
    <header className="border-b border-[var(--l-border)] pb-7"><p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-blue-400">{page.slug === "faq" ? "FAQ" : page.slug}</p><h1 className="font-display mt-3 text-[32px] font-extrabold leading-tight text-[var(--l-heading)] sm:text-[42px]">{page.title}</h1>{page.excerpt && <p className="mt-4 text-[16px] leading-relaxed text-[var(--l-muted)]">{page.excerpt}</p>}</header>
    <div className="prose prose-slate mt-8 max-w-none text-[15px] leading-8 text-[var(--l-text)] dark:prose-invert">{renderBlogBody(page.body)}</div>
    {page.slug === "contact" && <div className="mt-12"><SupportRequestForm locale={locale} /></div>}
  </article>
}

function OneTimeProductsSection({ products, locale, path }: { products: PublicCmsProduct[]; locale: LocaleId; path: string }) {
  if (!products.length) return null
  const copy = locale === "ar" ? { title: "منتجات وأسعار لمرة واحدة", note: "تتم عملية الشراء عبر رابط خارجي. لا تتحقق فاتورتي من الدفع أو الطلبات." } : locale === "en" ? { title: "One-time products", note: "Purchases continue on an external provider. Fatorati does not verify payments or orders." } : { title: "Produits à l’achat unique", note: "L’achat se poursuit chez un prestataire externe. Fatorati ne confirme pas les paiements ni les commandes." }
  return <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8"><div className="mx-auto max-w-2xl text-center"><p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-400">{copy.title}</p><p className="mt-2 text-[11px] leading-relaxed text-[var(--l-faint)]">{copy.note}</p></div><div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
    {products.map((product) => <article key={product.product_key} className="rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6"><h3 className="font-display text-[18px] font-bold text-[var(--l-heading)]">{product.name}</h3><p className="mt-2 min-h-10 text-[13px] leading-relaxed text-[var(--l-muted)]">{product.description}</p><p className="mt-5 font-display text-[25px] font-bold text-[var(--l-heading)]">{formatMoney(product.price_amount, product.currency, locale)}</p>{product.purchase_url ? <a href={product.purchase_url} target="_blank" rel="noopener noreferrer" onClick={() => recordSiteEvent("purchase_click", path, product.product_key, locale)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-blue-700"><ShoppingBag className="h-4 w-4" />{locale === "ar" ? "شراء خارجي" : locale === "en" ? "Continue to purchase" : "Acheter"}<ArrowRight className="h-3.5 w-3.5" /></a> : <span className="mt-5 inline-flex rounded-lg border border-[var(--l-border)] px-4 py-2.5 text-[12px] text-[var(--l-faint)]">{locale === "ar" ? "رابط الشراء غير متاح" : locale === "en" ? "Purchase link not available" : "Lien d’achat indisponible"}</span>}</article>)}
  </div></section>
}

function DownloadReleaseSection({ releases, downloads, locale, path }: { releases: PublicCmsRelease[]; downloads: PublicCmsDownload[]; locale: LocaleId; path: string }) {
  if (!releases.length && !downloads.length) return null
  const title = locale === "ar" ? "التنزيلات والإصدارات" : locale === "en" ? "Downloads and releases" : "Téléchargements et versions"
  const labels: Record<LocaleId, { download: string; notes: string; compatible: string }> = {
    fr: { download: "Télécharger", notes: "Nouveautés et correctifs", compatible: "Compatibilité" },
    en: { download: "Download", notes: "Release notes and fixes", compatible: "Compatibility" },
    ar: { download: "تنزيل", notes: "المستجدات والإصلاحات", compatible: "التوافق" },
  }
  return <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8"><div className="mx-auto max-w-2xl text-center"><p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-400">{title}</p></div>
    {downloads.length > 0 && <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">{downloads.map((download, index) => <article key={`${download.platform}:${download.version}:${index}`} className="flex items-start gap-3 rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-400"><Download className="h-4 w-4" /></span><div className="min-w-0 flex-1"><h3 className="text-[13px] font-bold text-[var(--l-heading)]">{download.label_by_locale[locale] || download.platform} <span className="text-[var(--l-faint)]">{download.version}</span></h3>{download.instructions_by_locale[locale] && <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-[var(--l-muted)]">{download.instructions_by_locale[locale]}</p>}</div><a href={download.url} target="_blank" rel="noopener noreferrer" onClick={() => recordSiteEvent("download_click", path, `${download.platform}:${download.version}`, locale)} className="shrink-0 rounded-lg border border-[var(--l-border-strong)] px-3 py-2 text-[11px] font-semibold text-blue-400 hover:border-blue-400/50">{labels[locale].download}</a></article>)}</div>}
    {releases.length > 0 && <div className="mx-auto mt-8 max-w-4xl space-y-3">{releases.slice(0, 5).map((release) => {
      const date = validDate(release.release_date) ? new Intl.DateTimeFormat(localeInfo(locale).tag, { dateStyle: "medium" }).format(new Date(release.release_date)) : ""
      const notes = release.notes_by_locale[locale] || release.notes_by_locale.fr || release.notes_by_locale.en || release.notes_by_locale.ar || ""
      const titleText = release.title_by_locale[locale] || `v${release.version}`
      return <article key={`${release.version}:${release.channel}`} className="rounded-xl border border-[var(--l-border)] bg-[var(--l-surface)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[13px] font-bold text-[var(--l-heading)]">{titleText} <span className="font-mono text-[11px] text-[var(--l-faint)]">v{release.version}</span></h3><time className="text-[11px] text-[var(--l-faint)]">{date}</time></div>{notes && <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-[var(--l-muted)]">{notes}</p>}{release.fixes?.length > 0 && <p className="mt-2 text-[11px] text-[var(--l-faint)]">{labels[locale].notes}: {release.fixes.join(" · ")}</p>}{release.compatibility && <p className="mt-2 text-[11px] text-[var(--l-faint)]">{labels[locale].compatible}: {release.compatibility}</p>}</article>
    })}</div>}
  </section>
}

function SupportRequestForm({ locale }: { locale: LocaleId }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const copy = {
    fr: { title: "Écrire à l’équipe", name: "Nom", email: "E-mail", category: "Type de demande", subject: "Sujet", message: "Votre message (10 caractères minimum)", send: "Envoyer la demande", sent: "Merci, votre demande a bien été transmise.", failed: "Impossible d’envoyer la demande pour le moment.", categories: [["contact", "Question générale"], ["bug", "Signaler un bug"], ["feedback", "Retour d’expérience"], ["feature_request", "Suggestion de fonctionnalité"]] },
    en: { title: "Contact the team", name: "Name", email: "Email", category: "Request type", subject: "Subject", message: "Your message (at least 10 characters)", send: "Send request", sent: "Thank you. Your request has been sent.", failed: "The request could not be sent right now.", categories: [["contact", "General question"], ["bug", "Report a bug"], ["feedback", "Feedback"], ["feature_request", "Feature suggestion"]] },
    ar: { title: "راسل فريق الدعم", name: "الاسم", email: "البريد الإلكتروني", category: "نوع الطلب", subject: "الموضوع", message: "رسالتك (10 أحرف على الأقل)", send: "إرسال الطلب", sent: "شكراً، تم إرسال طلبك.", failed: "تعذر إرسال الطلب حالياً.", categories: [["contact", "استفسار عام"], ["bug", "الإبلاغ عن خلل"], ["feedback", "ملاحظات"], ["feature_request", "اقتراح ميزة"]] },
  }[locale]
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true); setError(""); setNotice("")
    try {
      const category = String(values.get("category")) as "contact" | "bug" | "feedback" | "feature_request"
      await submitCmsSupportRequest({ category, name: String(values.get("name")), email: String(values.get("email")), subject: String(values.get("subject")), message: String(values.get("message")) })
      form.reset(); setNotice(copy.sent)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed)
    } finally { setBusy(false) }
  }
  return <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><div className="rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] p-5 sm:p-7"><h2 className="font-display text-[20px] font-bold text-[var(--l-heading)]">{copy.title}</h2>
    {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-500">{notice}</p>}{error && <p role="alert" className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-400">{error}</p>}
    <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-[12px] text-[var(--l-muted)]"><span className="mb-1 block">{copy.name}</span><input name="name" required maxLength={120} autoComplete="name" className="w-full rounded-lg border border-[var(--l-border-strong)] bg-[var(--l-panel)] px-3 py-2 text-[13px] text-[var(--l-text)]" /></label>
      <label className="text-[12px] text-[var(--l-muted)]"><span className="mb-1 block">{copy.email}</span><input name="email" type="email" required maxLength={254} autoComplete="email" className="w-full rounded-lg border border-[var(--l-border-strong)] bg-[var(--l-panel)] px-3 py-2 text-[13px] text-[var(--l-text)]" /></label>
      <label className="text-[12px] text-[var(--l-muted)]"><span className="mb-1 block">{copy.category}</span><select name="category" className="w-full rounded-lg border border-[var(--l-border-strong)] bg-[var(--l-panel)] px-3 py-2 text-[13px] text-[var(--l-text)]">{copy.categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-[12px] text-[var(--l-muted)]"><span className="mb-1 block">{copy.subject}</span><input name="subject" required maxLength={180} className="w-full rounded-lg border border-[var(--l-border-strong)] bg-[var(--l-panel)] px-3 py-2 text-[13px] text-[var(--l-text)]" /></label>
      <label className="text-[12px] text-[var(--l-muted)] sm:col-span-2"><span className="mb-1 block">{copy.message}</span><textarea name="message" required minLength={10} maxLength={10000} rows={5} className="w-full resize-y rounded-lg border border-[var(--l-border-strong)] bg-[var(--l-panel)] px-3 py-2 text-[13px] leading-relaxed text-[var(--l-text)]" /></label>
      <div className="sm:col-span-2"><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[12px] font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />{busy ? "…" : copy.send}</button></div>
    </form>
  </div></section>
}

function formatMoney(amount: number, currency: string, locale: LocaleId): string {
  try { return new Intl.NumberFormat(localeInfo(locale).tag, { style: "currency", currency }).format(Number(amount)) }
  catch { return `${amount} ${currency}` }
}
function validDate(value: string): boolean { return Number.isFinite(new Date(value).getTime()) }

function ContactSection({ copy, showHeading = true }: { copy: ExtraCopy["contact"]; showHeading?: boolean }) {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-blue-400/20 bg-blue-500/10 p-8 sm:p-10">
        {showHeading && <><p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-400">{copy.eyebrow}</p><h2 className="font-display mt-3 text-[30px] font-bold text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2></>}<p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--l-muted)]">{copy.sub}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <a href={`mailto:${copy.email}`} className="flex items-center gap-2.5 rounded-xl border border-[var(--l-border)] bg-[var(--l-panel)] p-3 text-[12px] text-[var(--l-text)] hover:border-blue-400/40"><Mail className="h-4 w-4 text-blue-400" />{copy.email}</a>
          {copy.phone && (
            <a href={telHref(copy.phone)} className="flex items-center gap-2.5 rounded-xl border border-[var(--l-border)] bg-[var(--l-panel)] p-3 text-[12px] text-[var(--l-text)] hover:border-blue-400/40"><Phone className="h-4 w-4 text-blue-400" />{copy.phone}</a>
          )}
          <span className="flex items-center gap-2.5 rounded-xl border border-[var(--l-border)] bg-[var(--l-panel)] p-3 text-[12px] text-[var(--l-text)]"><MapPin className="h-4 w-4 shrink-0 text-blue-400" />{copy.city}</span>
        </div>
        <a href={`mailto:${copy.email}`} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-[13px] font-semibold text-white hover:bg-blue-400">{copy.cta} <Mail className="h-4 w-4" /></a>
      </div>
    </section>
  )
}

function LegalSection({ copy, active, showHeading = true }: { copy: ExtraCopy["legal"]; active?: "privacy" | "terms" | "cookies"; showHeading?: boolean }) {
  const items = [{ id: "privacy", title: copy.privacy, text: copy.privacyText }, { id: "terms", title: copy.terms, text: copy.termsText }, { id: "cookies", title: copy.cookies, text: copy.cookiesText }]
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-3xl border-t border-[var(--l-border)] pt-10">
        {items.filter((item) => !active || item.id === active).map((item) => (
          <article id={item.id} key={item.id}>
            {showHeading && <h2 className="font-display text-[24px] font-bold text-[var(--l-heading)]">{item.title}</h2>}
            {item.text.split("\n\n").map((para, i) => (
              <p key={i} className="mt-4 text-[14px] leading-relaxed text-[var(--l-muted)]">{para}</p>
            ))}
          </article>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------- Footer ----------------------------- */

function Footer({ t, extra, onEnter }: { t: Dict; extra: ExtraCopy; onEnter: () => void }) {
  const to = useLocaleHref()
  return (
    <footer className="landing-footer border-t border-[var(--l-border)] bg-[var(--l-bg-solid)]">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-10 border-b border-[var(--l-border)] pb-12 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <LandingBrand size={34} alt="Fatorati" />
            <h2 className="font-display mt-6 max-w-xl text-[26px] font-bold leading-tight tracking-tight text-[var(--l-heading)] sm:text-[32px]">{t.footer.title}</h2>
            <GlowButton onClick={onEnter} className="mt-6">{t.signup} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></GlowButton>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--l-faint)]">{extra.about.eyebrow}</p>
            <div className="mt-4 flex flex-col items-start gap-3 text-[12.5px] text-[var(--l-muted)]">
              <a href={to("about")} onClick={onInternalLinkClick} className="hover:text-[var(--l-heading)]">{t.nav.about}</a>
              <a href={to("features")} onClick={onInternalLinkClick} className="hover:text-[var(--l-heading)]">{t.nav.features}</a>
              <a href={to("benefits")} onClick={onInternalLinkClick} className="hover:text-[var(--l-heading)]">{t.nav.benefits}</a>
              <a href={to("pricing")} onClick={onInternalLinkClick} className="hover:text-[var(--l-heading)]">{t.nav.pricing}</a>
              <a href={to("blog")} onClick={onInternalLinkClick} className="hover:text-[var(--l-heading)]">{t.nav.blog}</a>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--l-faint)]">{extra.contact.eyebrow}</p>
            <div className="mt-4 flex flex-col items-start gap-3 text-[12.5px] text-[var(--l-muted)]">
              <a href={to("contact")} onClick={onInternalLinkClick} className="hover:text-[var(--l-heading)]">{t.nav.contact}</a>
              <a href={`mailto:${extra.contact.email}`} className="hover:text-[var(--l-heading)]">{extra.contact.email}</a>
              <a href={to("faq")} onClick={onInternalLinkClick} className="hover:text-[var(--l-heading)]">{t.nav.faq}</a>
              <a href={to("privacy")} onClick={onInternalLinkClick} className="hover:text-[var(--l-heading)]">{extra.legal.privacy}</a>
              <a href={to("terms")} onClick={onInternalLinkClick} className="hover:text-[var(--l-heading)]">{extra.legal.terms}</a>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-4 text-[12px] text-[var(--l-faint)] sm:flex-row sm:items-center">
          <p>{t.footer.copy}</p>
          <div className="flex flex-wrap items-center gap-4">
            <a href={to("cookies")} onClick={onInternalLinkClick} className="hover:text-[var(--l-heading)]">{extra.legal.cookies}</a>
            <p className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> {t.footer.compliance}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

function CookieBanner({ lang }: { lang: Lang }) {
  const [visible, setVisible] = useState(false)
  const to = useLocaleHref()
  const copy = {
    fr: { text: "Cookies nécessaires, Google Analytics et mesure interne limitée des pages après votre accord. Pas de publicité ni de revente de données.", accept: "Accepter", reject: "Refuser", link: "En savoir plus" },
    en: { text: "Necessary cookies, Google Analytics and limited first-party page measurement run only after your consent. No ads or data resale.", accept: "Accept", reject: "Decline", link: "Learn more" },
    ar: { text: "ملفات ضرورية وGoogle Analytics وقياس داخلي محدود للصفحات، بعد موافقتك فقط. بدون إعلانات أو بيع للبيانات.", accept: "موافقة", reject: "رفض", link: "معرفة المزيد" },
  }[lang]

  useEffect(() => {
    setVisible(readCookieConsent() === null)
  }, [])

  function choose(value: "accepted" | "declined") {
    writeCookieConsent(value)
    setVisible(false)
  }

  if (!visible) return null
  return (
    <aside className="landing-cookie-banner fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-2xl border border-[var(--l-border-strong)] bg-[var(--l-panel)] p-4 shadow-2xl backdrop-blur-xl sm:flex sm:items-center sm:gap-5 sm:p-5" role="dialog" aria-label={copy.link}>
      <p className="flex-1 text-[12.5px] leading-relaxed text-[var(--l-text)]">{copy.text} <a href={to("cookies")} onClick={onInternalLinkClick} className="font-semibold text-blue-400 hover:underline">{copy.link}</a></p>
      <div className="mt-4 flex shrink-0 gap-2 sm:mt-0">
        <button type="button" onClick={() => choose("declined")} className="rounded-lg border border-[var(--l-border-strong)] px-3 py-2 text-[12px] font-semibold text-[var(--l-muted)] hover:text-[var(--l-heading)]">{copy.reject}</button>
        <button type="button" onClick={() => choose("accepted")} className="rounded-lg bg-blue-500 px-3 py-2 text-[12px] font-semibold text-white hover:bg-blue-400">{copy.accept}</button>
      </div>
    </aside>
  )
}
