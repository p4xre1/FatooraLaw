import { useEffect, useId, useState } from "react"
import {
  ArrowRight, Sparkles, ShieldCheck, CalendarDays, ShieldAlert, Wrench, FileText,
  Check, TrendingUp, Zap, Plus, Bell, ScrollText, LayoutDashboard, ChevronRight,
  Globe, ChevronDown, Sun, Moon, Mail, Phone, MapPin, BookOpen, CheckCircle2,
  Menu, X,
} from "lucide-react"
import { Logo } from "../components/nav"

const GRAD = "linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)"
const DASHBOARD_GRAD = "linear-gradient(135deg, #2563eb 0%, #10b981 100%)"

/* --------------------------- Structured data ------------------------
 * Per-page JSON-LD ("Content Schema") that complements the site-wide
 * Organization/WebSite JSON-LD emitted at build time (see vite.config.ts).
 * Kept next to the copy it describes so it can never drift from what's
 * actually rendered on the page.
 * ---------------------------------------------------------------- */
const SITE_URL = "https://fatoriti.tech"
const ORG_REF = { "@id": `${SITE_URL}/#organization` }
/** Assumption — same as `organization.foundingDate` in .figma/make/site.json. Correct both if wrong. */
const CONTENT_PUBLISHED = "2026-01-01"
/** Bump this whenever the copy in this file changes materially. */
const CONTENT_UPDATED = "2026-09-08"

function pagePath(page: LandingPage): string {
  return page === "home" ? "/" : `/${page}/`
}

/** MAD price strings appear as either "199 MAD" (fr/ar) or "MAD 199" (en); pull the digits either way. */
function priceDigits(price: string): string {
  return price.replace(/\D/g, "") || "0"
}

function offersFromPlans(plans: ExtraCopy["pricing"]["plans"]) {
  return plans.map((plan, i) => ({
    "@type": "Offer",
    position: i + 1,
    name: plan.name,
    description: plan.desc,
    price: priceDigits(plan.price),
    priceCurrency: "MAD",
    url: `${SITE_URL}/pricing/`,
  }))
}

function buildJsonLd(page: LandingPage, lang: Lang, t: Dict, extra: ExtraCopy): Record<string, unknown> {
  const url = `${SITE_URL}${pagePath(page)}`
  const base = {
    "@context": "https://schema.org",
    "@id": `${url}#content`,
    url,
    inLanguage: lang,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    author: ORG_REF,
    publisher: ORG_REF,
    datePublished: CONTENT_PUBLISHED,
    dateModified: CONTENT_UPDATED,
  }

  switch (page) {
    case "faq":
      return {
        ...base,
        "@type": "FAQPage",
        name: extra.faq.title,
        mainEntity: extra.faq.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }
    case "pricing":
      return {
        ...base,
        "@type": "WebPage",
        name: extra.pricing.title,
        description: extra.pricing.sub,
        mainEntity: { "@type": "ItemList", itemListElement: offersFromPlans(extra.pricing.plans) },
      }
    case "home":
      return {
        ...base,
        "@type": "SoftwareApplication",
        name: "Fatorati",
        description: t.hero.sub,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: offersFromPlans(extra.pricing.plans),
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
      return { ...base, "@type": "ContactPage", name: extra.contact.title, description: extra.contact.sub }
    case "blog":
      return { ...base, "@type": "CollectionPage", name: extra.blog.title, description: `${extra.blog.eyebrow} — Fatorati` }
    case "privacy":
      return { ...base, "@type": "WebPage", name: extra.legal.privacy, description: extra.legal.privacyText }
    case "terms":
      return { ...base, "@type": "WebPage", name: extra.legal.terms, description: extra.legal.termsText }
    case "cookies":
      return { ...base, "@type": "WebPage", name: extra.legal.cookies, description: extra.legal.cookiesText }
  }
}

/** Upserts a single <script type="application/ld+json"> in <head> and keeps document.title in sync per page. */
function usePageStructuredData(page: LandingPage, lang: Lang, t: Dict, extra: ExtraCopy) {
  useEffect(() => {
    const schema = buildJsonLd(page, lang, t, extra)
    let script = document.getElementById("ld-content") as HTMLScriptElement | null
    if (!script) {
      script = document.createElement("script")
      script.id = "ld-content"
      script.type = "application/ld+json"
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(schema)

    if (page !== "home") {
      document.title = `${schema.name as string} | Fatorati`
    }
  }, [page, lang, t, extra])
}

type Lang = "fr" | "en" | "ar"
type Theme = "dark" | "light"
type Seg = { t: string; hi?: boolean }
type LandingPage = "home" | "features" | "assistant" | "about" | "benefits" | "pricing" | "blog" | "faq" | "contact" | "privacy" | "terms" | "cookies"

function getLandingPage(): LandingPage {
  if (typeof window === "undefined") return "home"
  const path = window.location.pathname.split("/").filter(Boolean)[0]
  return (["features", "assistant", "about", "benefits", "pricing", "blog", "faq", "contact", "privacy", "terms", "cookies"] as string[]).includes(path)
    ? path as LandingPage
    : "home"
}

type ExtraCopy = {
  nav: { benefits: string; pricing: string; faq: string }
  about: { eyebrow: string; title: string; desc: string; points: string[] }
  benefits: { eyebrow: string; title: string; sub: string; items: { title: string; desc: string }[] }
  pricing: { eyebrow: string; title: string; sub: string; plans: { name: string; price: string; period: string; desc: string; cta: string; items: string[]; featured?: boolean }[] }
  blog: { eyebrow: string; title: string; posts: { tag: string; title: string; desc: string; date: string; iso: string }[] }
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] }
  contact: { eyebrow: string; title: string; sub: string; email: string; phone: string; city: string; cta: string }
  legal: { privacy: string; privacyText: string; terms: string; termsText: string; cookies: string; cookiesText: string }
}

const LANGS: { code: Lang; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
]

const T: Record<Lang, {
  nav: { features: string; assistant: string; benefits: string; pricing: string; faq: string }
  signup: string; explore: string
  hero: { badge: string; headline: Seg[]; sub: string; note: string }
  feat: { eyebrow: string; title: string; sub: string }
  f1: { tag: string; title: string; desc: string }
  f2: { tag: string; title: string; desc: string; items: { label: string; desc: string; level: string }[] }
  f3: { tag: string; title: string; desc: string; add: string; cols: [string, string, string, string]; tools: [string, string, string, string][]; blocks: [string, string][]; trend: string }
  cal: { month: string; renew: string; pay: string; legal: string; days: string[]; upcoming: string; events: { day: number; type: "renew" | "pay" | "legal"; label: string }[] }
  prev: { greet: string; title: string; add: string; stats: string[]; trend: string; plan: string; nav: string[] }
  asst: { badge: string; title: string; desc: string; cta: string; panel: string; panelSub: string; rules: string[]; verified: string }
  footer: { title: string; compliance: string; copy: string }
}> = {
  fr: {
    nav: { features: "Fonctionnalités", assistant: "Assistant", benefits: "Avantages", pricing: "Tarifs", faq: "FAQ" },
    signup: "S'inscrire", explore: "Explorer",
    hero: {
      badge: "Pensé pour les artisans, freelances & TPE marocaines",
      headline: [{ t: "Le logiciel simple qui pilote vos " }, { t: "finances", hi: true }, { t: ", vos " }, { t: "abonnements", hi: true }, { t: " et vos " }, { t: "risques", hi: true }, { t: "." }],
      sub: "Conçu mobile-first pour les artisans, freelances et petites entreprises marocaines : suivez vos échéances, maîtrisez vos coûts d'outils et restez conforme, depuis votre poche.",
      note: "Sans carte bancaire · Conforme Loi 09-08",
    },
    feat: { eyebrow: "Tout-en-un", title: "Trois outils, une seule application", sub: "Chaque fonctionnalité pensée pour la réalité du terrain marocain." },
    f1: { tag: "Planification", title: "Outil de Calendrier", desc: "Un calendrier de time-blocking épuré pour ne jamais manquer une date clé : échéances légales, renouvellements de contrats et paiements." },
    f2: { tag: "Conformité", title: "Gestion des Risques", desc: "Des alertes proactives et des contrôles de conformité locaux, adaptés aux réglementations des entreprises marocaines.", items: [{ label: "Déclaration TVA — T3 2026", desc: "À déposer avant le 30/09 auprès de la DGI. Pénalité de 15% en cas de retard.", level: "Élevé" }, { label: "Contrat client — PME locale", desc: "Clause de pénalité de retard à réviser avant renouvellement.", level: "Moyen" }, { label: "Registre du commerce (RC)", desc: "Modèle J mis à jour au tribunal de commerce de Casablanca.", level: "OK" }] },
    f3: { tag: "Finances", title: "Suivi des Abonnements & Outils", desc: "Saisissez chaque outil, visualisez vos totaux et suivez la tendance de vos dépenses mensuelles.", add: "Ajouter un outil", cols: ["Outil", "Coût / mois", "Début", "Expiration"], tools: [["Adobe Creative Cloud", "299 MAD", "01/03/26", "01/03/27"], ["Microsoft 365", "129 MAD", "12/01/26", "12/01/27"], ["Sage Compta", "450 MAD", "05/06/26", "05/06/27"], ["Hébergement OVH", "89 MAD", "20/02/26", "20/02/27"]], blocks: [["Total / mois", "1 720"], ["Outils actifs", "14"], ["Expire < 30j", "3"]], trend: "Tendance mensuelle" },
    cal: { month: "Septembre 2026", renew: "Renouv.", pay: "Paiement", legal: "Échéance légale", days: ["L", "M", "M", "J", "V", "S", "D"], upcoming: "Dates cruciales à venir", events: [{ day: 8, type: "pay", label: "Paiement Adobe CC — 299 MAD" }, { day: 15, type: "renew", label: "Renouvellement Microsoft 365" }, { day: 23, type: "legal", label: "Déclaration TVA (DGI)" }, { day: 27, type: "renew", label: "Fin abonnement Sage Compta" }] },
    prev: { greet: "Bonjour, Karim 👋", title: "Suivi des outils", add: "Ajouter", stats: ["Dépense / mois", "Outils actifs", "Échéances 7j"], trend: "Tendance des dépenses", plan: "Plan Pro", nav: ["Tableau", "Contrats", "Calendrier", "Risques", "Outils"] },
    asst: { badge: "Fatorati Assistant", title: "Intégration juridique intelligente", desc: "Un panneau léger et intelligent qui vous sert dynamiquement les règles juridiques locales exactes et des modèles de contrats prêts à l'emploi — adaptés au droit marocain.", cta: "Découvrir l'assistant", panel: "Modèles suggérés", panelSub: "Basés sur votre activité", rules: ["Contrat de prestation — art. 723 DOC", "Clause de confidentialité (Loi 09-08)", "Facture conforme ICE + TVA 20%"], verified: "Vérifié selon le DOC & la Loi 09-08" },
    footer: { title: "Prêt à équilibrer votre gestion ?", compliance: "Conforme Loi 09-08 (CNDP)", copy: "© 2026 Fatorati · Casablanca, Maroc" },
  },
  en: {
    nav: { features: "Features", assistant: "Assistant", benefits: "Benefits", pricing: "Pricing", faq: "FAQ" },
    signup: "Sign up", explore: "Explore",
    hero: {
      badge: "Built for Moroccan artisans, freelancers & small businesses",
      headline: [{ t: "The simple software that runs your " }, { t: "finances", hi: true }, { t: ", your " }, { t: "subscriptions", hi: true }, { t: " and your " }, { t: "risks", hi: true }, { t: "." }],
      sub: "Built mobile-first for Moroccan artisans, freelancers and small businesses: track your deadlines, control your tool costs and stay compliant — right from your pocket.",
      note: "No credit card · Law 09-08 compliant",
    },
    feat: { eyebrow: "All-in-one", title: "Three tools, one single app", sub: "Every feature designed for the Moroccan field reality." },
    f1: { tag: "Planning", title: "Calendar Tool", desc: "A clean time-blocking calendar so you never miss a key date: legal deadlines, contract renewals and payments." },
    f2: { tag: "Compliance", title: "Risk Management", desc: "Proactive alerts and local compliance checks, tailored to Moroccan business regulations.", items: [{ label: "VAT return — Q3 2026", desc: "Due before 30/09 to the DGI. 15% penalty on late filing.", level: "High" }, { label: "Client contract — local SME", desc: "Late-payment penalty clause to review before renewal.", level: "Medium" }, { label: "Trade register (RC)", desc: "Model J updated at the Casablanca commercial court.", level: "OK" }] },
    f3: { tag: "Finance", title: "Subscriptions & Tools Tracking", desc: "Log each tool, view your totals and track your monthly spending trend.", add: "Add a tool", cols: ["Tool", "Cost / month", "Start", "Expiry"], tools: [["Adobe Creative Cloud", "299 MAD", "01/03/26", "01/03/27"], ["Microsoft 365", "129 MAD", "12/01/26", "12/01/27"], ["Sage Compta", "450 MAD", "05/06/26", "05/06/27"], ["OVH Hosting", "89 MAD", "20/02/26", "20/02/27"]], blocks: [["Total / month", "1 720"], ["Active tools", "14"], ["Expiring < 30d", "3"]], trend: "Monthly trend" },
    cal: { month: "September 2026", renew: "Renewal", pay: "Payment", legal: "Legal deadline", days: ["M", "T", "W", "T", "F", "S", "S"], upcoming: "Upcoming crucial dates", events: [{ day: 8, type: "pay", label: "Adobe CC payment — 299 MAD" }, { day: 15, type: "renew", label: "Microsoft 365 renewal" }, { day: 23, type: "legal", label: "VAT return (DGI)" }, { day: 27, type: "renew", label: "Sage Compta subscription ends" }] },
    prev: { greet: "Hello, Karim 👋", title: "Tools tracking", add: "Add", stats: ["Spend / month", "Active tools", "Due in 7d"], trend: "Spending trend", plan: "Pro plan", nav: ["Dashboard", "Contracts", "Calendar", "Risks", "Tools"] },
    asst: { badge: "Fatorati Assistant", title: "Smart legal integration", desc: "A lightweight, intelligent panel that dynamically serves the exact local legal rules and ready-to-use contract templates — tailored to Moroccan law.", cta: "Discover the assistant", panel: "Suggested templates", panelSub: "Based on your activity", rules: ["Service contract — art. 723 DOC", "Confidentiality clause (Law 09-08)", "Invoice compliant ICE + VAT 20%"], verified: "Verified against the DOC & Law 09-08" },
    footer: { title: "Ready to balance your management?", compliance: "Law 09-08 compliant (CNDP)", copy: "© 2026 Fatorati · Casablanca, Morocco" },
  },
  ar: {
    nav: { features: "الميزات", assistant: "المساعد", benefits: "المزايا", pricing: "الأسعار", faq: "الأسئلة" },
    signup: "إنشاء حساب", explore: "استكشاف",
    hero: {
      badge: "مصمم للحرفيين والمستقلين والشركات الصغيرة في المغرب",
      headline: [{ t: "البرنامج البسيط الذي يدير " }, { t: "أموالك", hi: true }, { t: " و" }, { t: "اشتراكاتك", hi: true }, { t: " و" }, { t: "مخاطرك", hi: true }, { t: "." }],
      sub: "مصمم للهاتف أولاً للحرفيين والمستقلين والشركات الصغيرة في المغرب: تابع مواعيدك، وتحكّم في تكاليف أدواتك، وابقَ ممتثلاً — من جيبك.",
      note: "بدون بطاقة بنكية · متوافق مع القانون 09-08",
    },
    feat: { eyebrow: "الكل في واحد", title: "ثلاث أدوات، تطبيق واحد", sub: "كل ميزة مصممة لواقع الميدان المغربي." },
    f1: { tag: "تخطيط", title: "أداة التقويم", desc: "تقويم بسيط لحجز الوقت حتى لا تفوّت أي موعد مهم: المواعيد القانونية وتجديد العقود والمدفوعات." },
    f2: { tag: "امتثال", title: "إدارة المخاطر", desc: "تنبيهات استباقية وفحوصات امتثال محلية، مصممة للوائح الشركات المغربية.", items: [{ label: "إقرار الضريبة على القيمة المضافة — الربع 3 2026", desc: "يُودَع قبل 30/09 لدى المديرية العامة للضرائب. غرامة 15% عند التأخير.", level: "مرتفع" }, { label: "عقد العميل أطلس BTP", desc: "بند غرامة التأخير يجب مراجعته قبل التجديد.", level: "متوسط" }, { label: "السجل التجاري", desc: "النموذج J محدّث لدى المحكمة التجارية بالدار البيضاء.", level: "سليم" }] },
    f3: { tag: "المالية", title: "متابعة الاشتراكات والأدوات", desc: "سجّل كل أداة، اطّلع على إجمالياتك وتابع اتجاه نفقاتك الشهرية.", add: "إضافة أداة", cols: ["الأداة", "التكلفة / شهر", "البدء", "الانتهاء"], tools: [["Adobe Creative Cloud", "299 MAD", "01/03/26", "01/03/27"], ["Microsoft 365", "129 MAD", "12/01/26", "12/01/27"], ["Sage Compta", "450 MAD", "05/06/26", "05/06/27"], ["استضافة OVH", "89 MAD", "20/02/26", "20/02/27"]], blocks: [["الإجمالي / شهر", "1 720"], ["أدوات نشطة", "14"], ["تنتهي < 30 يوم", "3"]], trend: "الاتجاه الشهري" },
    cal: { month: "شتنبر 2026", renew: "تجديد", pay: "دفع", legal: "موعد قانوني", days: ["ن", "ث", "ر", "خ", "ج", "س", "ح"], upcoming: "مواعيد حاسمة قادمة", events: [{ day: 8, type: "pay", label: "دفع Adobe CC — 299 MAD" }, { day: 15, type: "renew", label: "تجديد Microsoft 365" }, { day: 23, type: "legal", label: "إقرار الضريبة (DGI)" }, { day: 27, type: "renew", label: "انتهاء اشتراك Sage Compta" }] },
    prev: { greet: "مرحباً كريم 👋", title: "متابعة الأدوات", add: "إضافة", stats: ["الإنفاق / شهر", "أدوات نشطة", "استحقاق 7 أيام"], trend: "اتجاه الإنفاق", plan: "خطة برو", nav: ["لوحة", "عقود", "تقويم", "مخاطر", "أدوات"] },
    asst: { badge: "مساعد فاتورتي", title: "تكامل قانوني ذكي", desc: "لوحة خفيفة وذكية تقدّم لك القواعد القانونية المحلية الدقيقة ونماذج عقود جاهزة — مصممة للقانون المغربي.", cta: "اكتشف المساعد", panel: "نماذج مقترحة", panelSub: "بناءً على نشاطك", rules: ["عقد خدمة — المادة 723 ق.ل.ع", "بند السرية (القانون 09-08)", "فاتورة مطابقة ICE + ض.ق.م 20%"], verified: "تم التحقق وفق ق.ل.ع والقانون 09-08" },
    footer: { title: "مستعد لموازنة إدارتك؟", compliance: "متوافق مع القانون 09-08 (CNDP)", copy: "© 2026 فاتورتي · الدار البيضاء، المغرب" },
  },
}

const EXTRA: Record<Lang, ExtraCopy> = {
  fr: {
    nav: { benefits: "Avantages", pricing: "Tarifs", faq: "FAQ" },
    about: { eyebrow: "À propos", title: "La gestion pensée pour le terrain marocain.", desc: "Fatorati réunit les outils essentiels des artisans, freelances et petites entreprises dans un espace clair, mobile et conforme.", points: ["Une expérience simple, en français et en arabe.", "Des échéances, contrats et dépenses visibles au même endroit.", "Une approche conçue avec les réalités des TPE marocaines."] },
    benefits: { eyebrow: "Pourquoi Fatorati", title: "Moins d'oubli. Plus de maîtrise.", sub: "Une vue claire pour décider vite et travailler sereinement.", items: [{ title: "Gagnez du temps", desc: "Retrouvez vos clients, dépenses, contrats et échéances sans passer d'un outil à l'autre." }, { title: "Restez conforme", desc: "Anticipez vos obligations et conservez une trace utile de chaque action importante." }, { title: "Pilotez depuis votre poche", desc: "Une interface mobile-first qui reste lisible au bureau comme sur le terrain." }, { title: "Travaillez en équipe", desc: "Attribuez les bons rôles et gardez le contrôle sur les accès sensibles." }] },
    pricing: { eyebrow: "Tarifs", title: "Un plan pour chaque étape.", sub: "Commencez simplement, puis adaptez votre espace à votre activité.", plans: [{ name: "Essentiel", price: "0 MAD", period: "/ pour commencer", desc: "Pour découvrir les fondamentaux.", cta: "Commencer", items: ["Tableau de bord", "Calendrier des échéances", "Gestion des contacts"] }, { name: "Pro", price: "199 MAD", period: "/ mois", desc: "Pour piloter une activité en croissance.", cta: "Choisir Pro", featured: true, items: ["Tout dans Essentiel", "Contrats et coffre juridique", "Rapports et exports", "Rôles et permissions"] }, { name: "Équipe", price: "499 MAD", period: "/ mois", desc: "Pour une équipe qui veut aller plus loin.", cta: "Parler à l'équipe", items: ["Tout dans Pro", "Équipe multi-utilisateurs", "Suivi avancé et audit", "Accompagnement prioritaire"] }] },
    blog: { eyebrow: "Ressources", title: "Le journal Fatorati.", posts: [{ tag: "Gestion", title: "Les 5 échéances à ne plus laisser passer", desc: "Une méthode simple pour organiser vos obligations mensuelles et trimestrielles.", date: "12 sept. 2026", iso: "2026-09-12" }, { tag: "Conformité", title: "Préparer ses contrats avec plus de sérénité", desc: "Les points à vérifier avant de signer une prestation au Maroc.", date: "04 sept. 2026", iso: "2026-09-04" }, { tag: "Trésorerie", title: "Où part vraiment votre budget outils ?", desc: "Comment repérer les abonnements inutilisés et reprendre la main sur vos coûts.", date: "28 août 2026", iso: "2026-08-28" }] },
    faq: { eyebrow: "FAQ", title: "Questions fréquentes.", items: [{ q: "Fatorati est-il adapté aux petites entreprises marocaines ?", a: "Oui. L'application est conçue pour les artisans, freelances, TPE et PME qui veulent centraliser leur gestion sans complexité inutile." }, { q: "Puis-je utiliser Fatorati sur mobile ?", a: "Oui. L'interface est mobile-first et reste confortable sur téléphone, tablette et ordinateur." }, { q: "Mes données sont-elles protégées ?", a: "Fatorati applique des contrôles d'accès, une session sécurisée et une traçabilité des actions importantes. Consultez notre politique de confidentialité pour les détails." }, { q: "Puis-je changer de formule ?", a: "Oui. Vous pouvez faire évoluer votre formule selon la taille de votre activité et vos besoins." }] },
    contact: { eyebrow: "Contact", title: "Parlons de votre activité.", sub: "Une question sur Fatorati, les tarifs ou votre déploiement ? Notre équipe vous répond.", email: "contact@fatorati.tech", phone: "+212 0 20 00 00 00", city: "Tanger, Maroc", cta: "Écrire à l'équipe" },
    legal: {
      privacy: "Politique de confidentialité",
      privacyText: "Fatorati traite vos données personnelles avec un objectif simple : vous fournir un espace de gestion sécurisé — jamais les revendre, ni les utiliser à des fins publicitaires.\n\nDonnées collectées — Lorsque vous créez un compte, nous recueillons votre nom, votre adresse e-mail et les données professionnelles que vous saisissez (clients, projets, dépenses, contrats, etc.). Ces données sont stockées de façon sécurisée et protégées par des règles d'accès strictes (Row Level Security) : elles ne sont accessibles qu'à vous et aux membres de votre équipe que vous autorisez.\n\nAucune publicité — Fatorati ne diffuse aucune publicité et ne partage, ne loue ni ne vend vos données à des annonceurs ou des courtiers en données, sous quelque forme que ce soit.\n\nGoogle Analytics — Le seul outil tiers que nous utilisons est Google Analytics, uniquement pour comprendre comment notre site est utilisé (pages consultées, durée de visite, provenance du trafic) et faire grandir Fatorati. Ces statistiques sont exploitées de façon agrégée pour améliorer le site — jamais pour vous cibler publicitairement. Cet outil ne s'active que si vous acceptez les cookies de mesure d'audience via notre bandeau de consentement ; vous pouvez le refuser à tout moment (voir notre politique de cookies).\n\nDurée de conservation — Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, elles sont supprimées ou anonymisées dans un délai raisonnable, sauf obligation légale de conservation plus longue (comptabilité, fiscalité).\n\nSécurité — L'accès à vos données est protégé par une authentification sécurisée, un chiffrement en transit (HTTPS) et des contrôles d'accès au niveau de la base de données. Voir notre politique de sécurité pour plus de détails.\n\nMise à jour — Cette politique peut évoluer ; la date de dernière mise à jour est indiquée en bas de cette page.",
      terms: "Conditions d'utilisation",
      termsText: "En utilisant Fatorati, vous acceptez d'utiliser le service de manière légale et de conserver vos identifiants confidentiels. Les fonctionnalités peuvent évoluer pour améliorer le service.",
      cookies: "Politique des cookies",
      cookiesText: "Un cookie est un petit fichier déposé sur votre appareil lors de votre visite. Voici les cookies utilisés sur fatorati.tech, et à quoi ils servent.\n\nCookies strictement nécessaires — Utilisés pour faire fonctionner le site (mémoriser votre choix de langue, votre thème et votre consentement aux cookies). Ils ne peuvent pas être désactivés et ne nécessitent pas votre consentement.\n\nCookies de mesure d'audience (Google Analytics) — Le seul outil tiers que nous utilisons est Google Analytics, uniquement pour comprendre la fréquentation du site (pages visitées, durée de visite, appareil, provenance approximative) et l'aider à grandir. Ces cookies ne sont déposés que si vous cliquez sur « Accepter » dans notre bandeau ; vous pouvez refuser à tout moment sans perdre l'accès au site.\n\nAucun cookie publicitaire — Fatorati ne dépose aucun cookie publicitaire, ne fait aucun reciblage (retargeting) et ne partage aucune donnée de navigation avec des régies publicitaires ou des réseaux sociaux.\n\nGérer vos préférences — Vous pouvez accepter ou refuser les cookies de mesure d'audience via le bandeau affiché lors de votre première visite. Votre choix est conservé sur votre appareil ; vous pouvez le modifier en effaçant les données de ce site dans votre navigateur.\n\nPour toute question sur cette politique, contactez-nous à contact@fatorati.tech.",
    },
  },
  en: {
    nav: { benefits: "Benefits", pricing: "Pricing", faq: "FAQ" },
    about: { eyebrow: "About", title: "Management designed for Moroccan businesses.", desc: "Fatorati brings the essential tools for artisans, freelancers and small businesses into one clear, mobile and compliant workspace.", points: ["A simple experience in French and Arabic.", "Deadlines, contracts and spending visible in one place.", "Built around the realities of Moroccan small businesses."] },
    benefits: { eyebrow: "Why Fatorati", title: "Less chasing. More control.", sub: "A clear view that helps you decide quickly and work with confidence.", items: [{ title: "Save time", desc: "Find clients, spending, contracts and deadlines without jumping between tools." }, { title: "Stay compliant", desc: "Anticipate obligations and keep a useful trail of every important action." }, { title: "Work from anywhere", desc: "A mobile-first interface that stays clear in the office or on site." }, { title: "Work as a team", desc: "Assign the right roles and keep control of sensitive access." }] },
    pricing: { eyebrow: "Pricing", title: "A plan for every stage.", sub: "Start simply, then adapt your workspace as your business grows.", plans: [{ name: "Essential", price: "MAD 0", period: "/ to start", desc: "For exploring the essentials.", cta: "Get started", items: ["Dashboard", "Deadline calendar", "Contact management"] }, { name: "Pro", price: "MAD 199", period: "/ month", desc: "For running a growing business.", cta: "Choose Pro", featured: true, items: ["Everything in Essential", "Contracts and legal vault", "Reports and exports", "Roles and permissions"] }, { name: "Team", price: "MAD 499", period: "/ month", desc: "For a team ready to go further.", cta: "Talk to the team", items: ["Everything in Pro", "Multi-user workspace", "Advanced audit trail", "Priority support"] }] },
    blog: { eyebrow: "Resources", title: "The Fatorati journal.", posts: [{ tag: "Management", title: "5 deadlines worth never missing", desc: "A simple method for organizing monthly and quarterly obligations.", date: "Sep 12, 2026", iso: "2026-09-12" }, { tag: "Compliance", title: "Prepare contracts with more confidence", desc: "What to review before signing a service agreement in Morocco.", date: "Sep 04, 2026", iso: "2026-09-04" }, { tag: "Cash flow", title: "Where is your tools budget really going?", desc: "How to spot unused subscriptions and regain control of costs.", date: "Aug 28, 2026", iso: "2026-08-28" }] },
    faq: { eyebrow: "FAQ", title: "Frequently asked questions.", items: [{ q: "Is Fatorati made for Moroccan small businesses?", a: "Yes. It is designed for artisans, freelancers, small businesses and teams that want practical management without unnecessary complexity." }, { q: "Can I use Fatorati on mobile?", a: "Yes. The interface is mobile-first and comfortable on phones, tablets and desktops." }, { q: "Is my data protected?", a: "Fatorati applies access controls, secure sessions and audit trails for important actions. See our privacy policy for details." }, { q: "Can I change plans?", a: "Yes. You can adjust your plan as your business and needs evolve." }] },
    contact: { eyebrow: "Contact", title: "Let us talk about your business.", sub: "Questions about Fatorati, pricing or rollout? Our team will get back to you.", email: "contact@fatorati.tech", phone: "+212 0 20 00 00 00", city: "Tanger, Morocco", cta: "Email the team" },
    legal: {
      privacy: "Privacy policy",
      privacyText: "Fatorati handles your personal data with one goal: to give you a secure workspace — never to resell it or use it for advertising.\n\nData we collect — When you create an account, we collect your name, email address, and the business data you enter (clients, projects, expenses, contracts, and so on). This data is stored securely and protected by strict access rules (Row Level Security): only you and the team members you authorize can access it.\n\nNo advertising — Fatorati shows no ads and never shares, rents, or sells your data to advertisers or data brokers, in any form.\n\nGoogle Analytics — The only third-party tool we use is Google Analytics, solely to understand how our site is used (pages viewed, time on page, traffic sources) and help Fatorati grow. This data is used in aggregate to guide the product — never to target you with ads. This tool only runs if you accept audience-measurement cookies through our consent banner; you can decline it at any time (see our cookie policy).\n\nRetention — Your data is kept for as long as your account is active. If you delete your account, your data is deleted or anonymized within a reasonable timeframe, except where longer retention is legally required (accounting, tax).\n\nSecurity — Access to your data is protected by secure authentication, encryption in transit (HTTPS), and database-level access controls. See our security policy for details.\n\nUpdates — This policy may change over time; the last-updated date is shown at the bottom of this page.",
      terms: "Terms of use",
      termsText: "By using Fatorati, you agree to use the service lawfully and keep your credentials confidential. Features may evolve as the service improves.",
      cookies: "Cookie policy",
      cookiesText: "A cookie is a small file placed on your device when you visit a site. Here's what we use on fatorati.tech, and why.\n\nStrictly necessary cookies — Used to run the site itself (remembering your language, theme, and cookie choice). These can't be turned off and don't require consent.\n\nAudience-measurement cookies (Google Analytics) — The only third-party tool we use is Google Analytics, solely to understand site traffic (pages visited, time on page, device, approximate origin) and help the site grow. These cookies are only set if you click \"Accept\" in our banner; you can decline at any time without losing access to the site.\n\nNo advertising cookies — Fatorati sets no advertising cookies, does no retargeting, and shares no browsing data with ad networks or social platforms.\n\nManaging your preferences — You can accept or decline audience-measurement cookies via the banner shown on your first visit. Your choice is stored on your device; you can change it by clearing this site's data in your browser.\n\nQuestions about this policy? Email us at contact@fatorati.tech.",
    },
  },
  ar: {
    nav: { benefits: "المزايا", pricing: "الأسعار", faq: "الأسئلة" },
    about: { eyebrow: "عن فاتورتي", title: "إدارة مصممة للشركات المغربية.", desc: "تجمع فاتورتي الأدوات الأساسية للحرفيين والمستقلين والشركات الصغيرة في مساحة واضحة وآمنة ومتوافقة.", points: ["تجربة بسيطة بالفرنسية والعربية.", "المواعيد والعقود والمصاريف في مكان واحد.", "مصممة لواقع المقاولات الصغيرة المغربية."] },
    benefits: { eyebrow: "لماذا فاتورتي", title: "نسيان أقل. تحكم أكبر.", sub: "رؤية واضحة تساعدك على اتخاذ القرار والعمل بثقة.", items: [{ title: "وفّر وقتك", desc: "اعثر على العملاء والمصاريف والعقود والمواعيد دون التنقل بين الأدوات." }, { title: "ابقَ ممتثلاً", desc: "استبق التزاماتك واحتفظ بسجل مفيد لكل إجراء مهم." }, { title: "اعمل من أي مكان", desc: "واجهة مصممة للهاتف وتبقى واضحة في المكتب أو الميدان." }, { title: "اعمل كفريق", desc: "عيّن الأدوار المناسبة وتحكم في صلاحيات الوصول الحساسة." }] },
    pricing: { eyebrow: "الأسعار", title: "خطة لكل مرحلة.", sub: "ابدأ ببساطة وطوّر مساحتك مع نمو نشاطك.", plans: [{ name: "أساسي", price: "0 MAD", period: "/ للبدء", desc: "لاكتشاف الأساسيات.", cta: "ابدأ الآن", items: ["لوحة التحكم", "تقويم المواعيد", "إدارة جهات الاتصال"] }, { name: "برو", price: "199 MAD", period: "/ شهر", desc: "لتسيير نشاط في نمو.", cta: "اختر برو", featured: true, items: ["كل ما في الأساسي", "العقود والخزنة القانونية", "التقارير والتصدير", "الأدوار والصلاحيات"] }, { name: "فريق", price: "499 MAD", period: "/ شهر", desc: "لفريق يريد التقدم أكثر.", cta: "تواصل معنا", items: ["كل ما في برو", "مساحة متعددة المستخدمين", "سجل تدقيق متقدم", "دعم ذو أولوية"] }] },
    blog: { eyebrow: "الموارد", title: "مجلة فاتورتي.", posts: [{ tag: "الإدارة", title: "5 مواعيد لا يجب تفويتها", desc: "طريقة بسيطة لتنظيم التزاماتك الشهرية والفصلية.", date: "12 شتنبر 2026", iso: "2026-09-12" }, { tag: "الامتثال", title: "جهّز عقودك بثقة أكبر", desc: "ما يجب مراجعته قبل توقيع عقد خدمة في المغرب.", date: "04 شتنبر 2026", iso: "2026-09-04" }, { tag: "الخزينة", title: "أين تذهب ميزانية أدواتك؟", desc: "كيف تكتشف الاشتراكات غير المستخدمة وتتحكم في التكاليف.", date: "28 غشت 2026", iso: "2026-08-28" }] },
    faq: { eyebrow: "الأسئلة الشائعة", title: "أسئلة متكررة.", items: [{ q: "هل فاتورتي مناسبة للشركات المغربية الصغيرة؟", a: "نعم. صممت للحرفيين والمستقلين والشركات الصغيرة والفرق التي تريد إدارة عملية دون تعقيد." }, { q: "هل يمكنني استخدام فاتورتي على الهاتف؟", a: "نعم. الواجهة مصممة للهاتف وتعمل بشكل مريح على الهاتف واللوحة والحاسوب." }, { q: "هل بياناتي محمية؟", a: "تطبق فاتورتي صلاحيات وصول وجلسات آمنة وسجل تدقيق للإجراءات المهمة. راجع سياسة الخصوصية لمزيد من التفاصيل." }, { q: "هل يمكنني تغيير الخطة؟", a: "نعم. يمكنك تعديل خطتك مع تطور نشاطك واحتياجاتك." }] },
    contact: { eyebrow: "تواصل معنا", title: "لنتحدث عن نشاطك.", sub: "لديك سؤال حول فاتورتي أو الأسعار أو طريقة الانطلاق؟ فريقنا يجيبك.", email: "contact@fatorati.tech", phone: "+212 0 20 00 00 00", city: "طنجة، المغرب", cta: "راسل الفريق" },
    legal: {
      privacy: "سياسة الخصوصية",
      privacyText: "تتعامل فاتورتي مع بياناتك الشخصية بهدف واحد: منحك مساحة عمل آمنة، دون بيعها أو استخدامها لأغراض إعلانية أبداً.\n\nالبيانات التي نجمعها — عند إنشاء حساب، نجمع اسمك وبريدك الإلكتروني والبيانات المهنية التي تُدخلها (العملاء، المشاريع، المصاريف، العقود، إلخ). تُخزَّن هذه البيانات بشكل آمن وتحميها قواعد وصول صارمة (Row Level Security)، بحيث لا يصل إليها سواك وأعضاء فريقك الذين تُصرّح لهم بذلك.\n\nبدون إعلانات — لا تعرض فاتورتي أي إعلانات، ولا تشارك أو تؤجر أو تبيع بياناتك لأي معلنين أو وسطاء بيانات، تحت أي شكل.\n\nGoogle Analytics — نستخدم فقط أداة Google Analytics، وذلك حصراً لفهم كيفية استخدام موقعنا (الصفحات المُزارة، مدة الزيارة، مصدر الزيارات) من أجل تحسين فاتورتي. تُستخدم هذه الإحصاءات بشكل مُجمّع لتطوير الموقع، وليس لاستهدافك إعلانياً أبداً. لا تُفعَّل هذه الأداة إلا إذا وافقت على ملفات قياس الجمهور عبر شريط الموافقة، ويمكنك رفضها في أي وقت (راجع سياسة ملفات الارتباط).\n\nمدة الاحتفاظ — تُحفظ بياناتك طالما حسابك نشط. عند حذف حسابك، تُحذف بياناتك أو يُعمَّم إخفاء هويتها خلال مدة معقولة، إلا إذا فرض القانون مدة احتفاظ أطول (المحاسبة، الضرائب).\n\nالأمان — الوصول إلى بياناتك محمي بمصادقة آمنة وتشفير أثناء النقل (HTTPS) وضوابط وصول على مستوى قاعدة البيانات. راجع سياسة الأمان لدينا لمزيد من التفاصيل.\n\nالتحديثات — قد تتطور هذه السياسة مع الوقت؛ يظهر تاريخ آخر تحديث أسفل هذه الصفحة.",
      terms: "شروط الاستخدام",
      termsText: "باستخدام فاتورتي، توافق على استعمال الخدمة بشكل قانوني والحفاظ على سرية بيانات الدخول. قد تتطور الميزات لتحسين الخدمة.",
      cookies: "سياسة ملفات الارتباط",
      cookiesText: "ملف تعريف الارتباط (cookie) هو ملف صغير يُوضع على جهازك عند زيارتك للموقع. إليك الملفات التي نستخدمها على fatorati.tech، والغرض منها.\n\nملفات ضرورية بشكل صارم — تُستخدم لتشغيل الموقع نفسه (حفظ اختيارك للغة والمظهر وموافقتك على ملفات الارتباط). لا يمكن تعطيلها ولا تتطلب موافقتك.\n\nملفات قياس الجمهور (Google Analytics) — الأداة الخارجية الوحيدة التي نستخدمها هي Google Analytics، وذلك حصراً لفهم حركة الزوار على الموقع (الصفحات المُزارة، مدة الزيارة، نوع الجهاز، المصدر التقريبي) والمساعدة على نمو الموقع. لا تُوضع هذه الملفات إلا إذا ضغطت على «موافقة» في الشريط، ويمكنك الرفض في أي وقت دون أن يؤثر ذلك على وصولك للموقع.\n\nبدون ملفات إعلانية — لا تضع فاتورتي أي ملفات إعلانية، ولا تقوم بإعادة الاستهداف، ولا تشارك أي بيانات تصفح مع شبكات إعلانية أو منصات التواصل الاجتماعي.\n\nإدارة تفضيلاتك — يمكنك قبول أو رفض ملفات قياس الجمهور عبر الشريط الذي يظهر عند أول زيارة لك. يُحفظ اختيارك على جهازك، ويمكنك تغييره بمسح بيانات هذا الموقع من متصفحك.\n\nلأي سؤال حول هذه السياسة، راسلنا على contact@fatorati.tech.",
    },
  },
}

export default function Landing({ onEnter }: { onEnter: () => void }) {
  const [lang, setLang] = useState<Lang>("fr")
  const [theme, setTheme] = useState<Theme>("dark")
  const [page, setPage] = useState<LandingPage>("home")
  const t = T[lang]
  const extra = EXTRA[lang]
  const rtl = lang === "ar"

  useEffect(() => {
    setPage(getLandingPage())
  }, [])

  usePageStructuredData(page, lang, t, extra)

  return (
    <div className="landing-root aurora min-h-screen font-sans antialiased" data-theme={theme} dir={rtl ? "rtl" : "ltr"}>
      <div className="relative">
        <div className="grid-veil pointer-events-none absolute inset-0 h-[720px]" />
        <Header t={t} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} onEnter={onEnter} />
        {page === "home" && <Hero t={t} onEnter={onEnter} />}
      </div>
      {page === "features" && <Features t={t} />}
      {page === "assistant" && <Assistant t={t} onEnter={onEnter} />}
      {page === "about" && <AboutSection copy={extra.about} />}
      {page === "benefits" && <BenefitsSection copy={extra.benefits} />}
      {page === "pricing" && <PricingSection copy={extra.pricing} onEnter={onEnter} />}
      {page === "blog" && <BlogSection copy={extra.blog} />}
      {page === "faq" && <FaqSection copy={extra.faq} />}
      {page === "contact" && <ContactSection copy={extra.contact} />}
      {(page === "privacy" || page === "terms" || page === "cookies") && <LegalSection copy={extra.legal} active={page} />}
      <Footer t={t} extra={extra} onEnter={onEnter} />
      <CookieBanner lang={lang} />
    </div>
  )
}

type Dict = (typeof T)["fr"]

/* ------------------------------- Buttons -------------------------- */

function GlowButton({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      style={{ backgroundImage: GRAD }}
      className={`group relative inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold text-white shadow-[0_10px_40px_-8px_rgba(124,58,237,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_50px_-6px_rgba(147,51,234,0.85)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--l-bg-solid)] active:translate-y-0 ${className}`}
    >
      <span className="pointer-events-none absolute inset-0 rounded-xl bg-white/0 transition-colors group-hover:bg-white/10" />
      {children}
    </button>
  )
}

function GhostButton({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--l-border-strong)] bg-[var(--l-chip)] px-5 py-3 text-[14px] font-semibold text-[var(--l-heading)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-violet-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${className}`}
    >
      {children}
    </button>
  )
}

/* ------------------------------- Controls ------------------------- */

function LangSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false)
  const current = LANGS.find((l) => l.code === lang)!
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--l-border-strong)] bg-[var(--l-chip)] px-2.5 py-2 text-[12.5px] font-semibold text-[var(--l-text)] transition-colors hover:border-violet-400/50"
        aria-haspopup="listbox" aria-expanded={open}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <ul className="absolute end-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-[var(--l-border-strong)] bg-[var(--l-panel)] py-1 shadow-2xl" style={{ animation: "mz-pop .15s ease-out" }} role="listbox">
            {LANGS.map((l) => (
              <li key={l.code}>
                <button
                  onClick={() => { setLang(l.code); setOpen(false) }}
                  className={`flex w-full items-center justify-between px-3.5 py-2 text-[13px] transition-colors hover:bg-violet-500/10 ${l.code === lang ? "font-bold text-[var(--l-heading)]" : "text-[var(--l-muted)]"}`}
                  role="option" aria-selected={l.code === lang}
                >
                  {l.label} {l.code === lang && <Check className="h-3.5 w-3.5 text-violet-400" />}
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
      className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--l-border-strong)] bg-[var(--l-chip)] text-[var(--l-text)] transition-all hover:border-violet-400/50 hover:text-[var(--l-heading)]"
      title={dark ? "Mode clair" : "Mode sombre"} aria-label="Basculer le thème"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

/* -------------------------------- Header -------------------------- */

const MOBILE_NAV_LINKS: { href: string; key: keyof Dict["nav"] }[] = [
  { href: "/features/", key: "features" },
  { href: "/assistant/", key: "assistant" },
  { href: "/benefits/", key: "benefits" },
  { href: "/pricing/", key: "pricing" },
  { href: "/faq/", key: "faq" },
]

function Header({ t, lang, setLang, theme, setTheme, onEnter }: { t: Dict; lang: Lang; setLang: (l: Lang) => void; theme: Theme; setTheme: (t: Theme) => void; onEnter: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuId = useId()

  // Lock body scroll while the mobile panel is open, and let Escape close it —
  // both standard expectations for an overlay nav on a public marketing page.
  useEffect(() => {
    if (!mobileOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [mobileOpen])

  // Any client-side route change (nav link tap, "enter app") should close the panel.
  useEffect(() => {
    setMobileOpen(false)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--l-border)] bg-[var(--l-header)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <a href="/" aria-label="Fatorati accueil" onClick={() => setMobileOpen(false)}>
          <Logo light={theme === "dark"} size={32} />
        </a>
        <nav className="hidden items-center gap-8 text-[13.5px] font-medium text-[var(--l-muted)] md:flex">
          <a href="/features/" className="transition-colors hover:text-[var(--l-heading)]">{t.nav.features}</a>
          <a href="/assistant/" className="transition-colors hover:text-[var(--l-heading)]">{t.nav.assistant}</a>
          <a href="/benefits/" className="transition-colors hover:text-[var(--l-heading)]">{t.nav.benefits}</a>
          <a href="/pricing/" className="transition-colors hover:text-[var(--l-heading)]">{t.nav.pricing}</a>
          <a href="/faq/" className="transition-colors hover:text-[var(--l-heading)]">{t.nav.faq}</a>
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <LangSwitcher lang={lang} setLang={setLang} />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
          <GlowButton onClick={onEnter} className="hidden px-4 py-2.5 text-[13px] md:inline-flex">{t.signup}</GlowButton>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--l-border-strong)] bg-[var(--l-chip)] text-[var(--l-heading)] transition-colors hover:border-violet-400/50 md:hidden"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-haspopup="true"
            aria-expanded={mobileOpen}
            aria-controls={menuId}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default bg-black/30 backdrop-blur-[1px] md:hidden"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          <div
            id={menuId}
            className="absolute inset-x-0 top-full z-50 border-b border-[var(--l-border)] bg-[var(--l-panel)] px-5 pb-6 pt-2 shadow-2xl md:hidden"
            style={{ animation: "mz-pop .15s ease-out" }}
          >
            <nav className="flex flex-col divide-y divide-[var(--l-border)]" aria-label="Navigation principale">
              {MOBILE_NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="py-3.5 text-[15px] font-medium text-[var(--l-text)] transition-colors hover:text-[var(--l-heading)]"
                >
                  {t.nav[link.key]}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex items-center gap-2">
              <LangSwitcher lang={lang} setLang={setLang} />
              <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
            <GlowButton
              onClick={() => { setMobileOpen(false); onEnter() }}
              className="mt-4 w-full"
            >
              {t.signup}
            </GlowButton>
          </div>
        </>
      )}
    </header>
  )
}

/* --------------------------------- Hero --------------------------- */

function Hero({ t, onEnter }: { t: Dict; onEnter: () => void }) {
  return (
    <section className="relative mx-auto max-w-6xl px-5 pb-8 pt-16 sm:px-8 sm:pt-24">
      <div className="mx-auto max-w-3xl text-center">
        <span className="mz-rise inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--l-accent-text)]">
          <Sparkles className="h-3.5 w-3.5" /> {t.hero.badge}
        </span>
        <h1 className="mz-rise font-display mt-6 text-[34px] font-extrabold leading-[1.12] tracking-tight text-[var(--l-heading)] sm:text-[52px]" style={{ animationDelay: "0.05s" }}>
          {t.hero.headline.map((s, i) => s.hi
            ? <span key={i} className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">{s.t}</span>
            : <span key={i}>{s.t}</span>)}
        </h1>
        <p className="mz-rise mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-[var(--l-muted)] sm:text-[17px]" style={{ animationDelay: "0.1s" }}>{t.hero.sub}</p>
        <div className="mz-rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "0.15s" }}>
          <GlowButton onClick={onEnter} className="w-full sm:w-auto">
            {t.signup} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
          </GlowButton>
          <GhostButton onClick={onEnter} className="w-full sm:w-auto">{t.explore}</GhostButton>
        </div>
        <p className="mz-rise mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--l-faint)]" style={{ animationDelay: "0.2s" }}>
          <Check className="h-3.5 w-3.5 text-violet-400" /> {t.hero.note}
        </p>
      </div>

      <DashboardPreview t={t} />
    </section>
  )
}

/* ------------------- Dashboard preview mockup --------------------- */

const previewIcons = [LayoutDashboard, FileText, CalendarDays, ShieldAlert, Wrench]

function DashboardPreview({ t }: { t: Dict }) {
  return (
    <div className="mz-rise relative mt-14 sm:mt-20" style={{ animationDelay: "0.25s" }}>
      <div className="mz-glow pointer-events-none absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[40px] blur-3xl" style={{ background: "radial-gradient(50% 50% at 50% 30%, rgba(37,99,235,0.3), transparent 70%)" }} />
      <div className="overflow-hidden rounded-2xl border border-[var(--l-border-strong)] bg-[var(--l-panel)] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="flex items-center gap-1.5 border-b border-[var(--l-border)] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--l-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--l-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--l-border-strong)]" />
          <span className="mx-3 rounded-md bg-[var(--l-chip)] px-2 py-0.5 font-mono text-[10.5px] text-[var(--l-faint)]">fatoriti.tech/tableau</span>
        </div>

        <div className="flex">
          <aside className="hidden w-[184px] shrink-0 flex-col gap-1 border-e border-[var(--l-border)] bg-[var(--l-surface)] p-3 sm:flex">
            <div className="px-2 pb-3"><Logo light={false} size={26} /></div>
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
                <h3 className="font-display text-[16px] font-bold text-[var(--l-heading)]">{t.prev.title}</h3>
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
            <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={padTop + ih} stroke="rgba(217,70,239,0.5)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(SPEND[hover])} r={4} fill="var(--l-panel)" stroke="#d946ef" strokeWidth={2.5} />
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

function Features({ t }: { t: Dict }) {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-violet-400">{t.feat.eyebrow}</p>
        <h2 className="font-display mt-3 text-[30px] font-bold tracking-tight text-[var(--l-heading)] sm:text-[38px]">{t.feat.title}</h2>
        <p className="mt-3 text-[15px] text-[var(--l-muted)]">{t.feat.sub}</p>
      </div>

      <div className="mt-14 flex w-full flex-col gap-5">
        <FeatureCard icon={CalendarDays} title={t.f1.title} tag={t.f1.tag}>
          <p className="text-[13.5px] leading-relaxed text-[var(--l-muted)]">{t.f1.desc}</p>
          <CalendarWidget t={t} />
        </FeatureCard>

        <FeatureCard icon={ShieldAlert} title={t.f2.title} tag={t.f2.tag}>
          <p className="text-[13.5px] leading-relaxed text-[var(--l-muted)]">{t.f2.desc}</p>
          <RiskWidget t={t} />
        </FeatureCard>

        <FeatureCard icon={Wrench} title={t.f3.title} tag={t.f3.tag}>
          <p className="text-[13.5px] leading-relaxed text-[var(--l-muted)]">{t.f3.desc}</p>
          <SubscriptionWidget t={t} />
        </FeatureCard>
      </div>
    </section>
  )
}

function FeatureCard({ icon: Icon, title, tag, children }: { icon: typeof Wrench; title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6 transition-all duration-300 hover:border-violet-400/30">
      <div className="pointer-events-none absolute -end-16 -top-16 h-40 w-40 rounded-full bg-violet-600/10 blur-3xl transition-opacity duration-300 group-hover:bg-violet-500/20" />
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
                className={`relative flex aspect-square items-center justify-center rounded-md text-[10.5px] transition-all ${on ? "font-bold text-white ring-2 ring-violet-400/60" : mark ? "font-semibold text-[var(--l-heading)]" : "text-[var(--l-muted)] hover:bg-[var(--l-chip)]"}`}
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
          <div key={k} className={`rounded-xl border p-2.5 text-center ${i === 0 ? "border-violet-400/30" : "border-[var(--l-border)] bg-[var(--l-panel-2)]"}`} style={i === 0 ? { background: "linear-gradient(160deg, rgba(124,58,237,0.16), rgba(124,58,237,0.03))" } : undefined}>
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
        <button className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-[var(--l-border-strong)] py-2 text-[11px] font-semibold text-violet-400 transition-colors hover:bg-violet-500/5">
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

function Assistant({ t, onEnter }: { t: Dict; onEnter: () => void }) {
  return (
    <section id="assistant" className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-b from-violet-500/10 to-transparent p-8 sm:p-12">
        <div className="mz-glow pointer-events-none absolute end-0 top-0 h-64 w-64 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-[12px] font-medium text-[var(--l-accent-text)]">
              <Sparkles className="h-3.5 w-3.5" /> {t.asst.badge}
            </span>
            <h2 className="font-display mt-4 text-[28px] font-bold leading-tight tracking-tight text-[var(--l-heading)] sm:text-[34px]">{t.asst.title}</h2>
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
                <button key={r} onClick={onEnter} className="flex w-full items-center gap-2.5 rounded-lg border border-[var(--l-border)] bg-[var(--l-panel-2)] px-3 py-2.5 text-start transition-colors hover:border-violet-400/30">
                  <FileText className="h-4 w-4 shrink-0 text-violet-400" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--l-text)]">{r}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--l-faint)] rtl:rotate-180" />
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-violet-500/10 px-3 py-2 text-[11.5px] text-[var(--l-accent-text)]">
              <ShieldCheck className="h-4 w-4" /> {t.asst.verified}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function AboutSection({ copy }: { copy: ExtraCopy["about"] }) {
  return (
    <section id="about" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="grid gap-10 rounded-3xl border border-[var(--l-border)] bg-[var(--l-surface)] p-8 sm:p-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-emerald-400">{copy.eyebrow}</p>
          <h2 className="font-display mt-3 text-[30px] font-bold leading-tight text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2>
        </div>
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

function BenefitsSection({ copy }: { copy: ExtraCopy["benefits"] }) {
  const icons = [Zap, ShieldCheck, Wrench, LayoutDashboard]
  return (
    <section id="benefits" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-emerald-400">{copy.eyebrow}</p>
        <h2 className="font-display mt-3 text-[30px] font-bold text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2>
        <p className="mt-3 text-[15px] text-[var(--l-muted)]">{copy.sub}</p>
      </div>
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

function PricingSection({ copy, onEnter }: { copy: ExtraCopy["pricing"]; onEnter: () => void }) {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-400">{copy.eyebrow}</p>
        <h2 className="font-display mt-3 text-[30px] font-bold text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2>
        <p className="mt-3 text-[15px] text-[var(--l-muted)]">{copy.sub}</p>
      </div>
      <div className="mx-auto mt-12 max-w-3xl space-y-4">
        {copy.plans.map((plan) => <article key={plan.name} className={`relative rounded-2xl border p-6 sm:p-8 ${plan.featured ? "border-blue-400/50 bg-blue-500/10" : "border-[var(--l-border)] bg-[var(--l-surface)]"}`}>
          {plan.featured && <span className="absolute end-6 top-6 rounded-full bg-blue-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Pro</span>}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div><h3 className="font-display text-[20px] font-bold text-[var(--l-heading)]">{plan.name}</h3><p className="mt-1 text-[13px] text-[var(--l-muted)]">{plan.desc}</p></div>
            <div className="sm:text-end"><span className="font-display text-[28px] font-bold text-[var(--l-heading)]">{plan.price}</span><span className="ms-1 text-[12px] text-[var(--l-faint)]">{plan.period}</span></div>
          </div>
          <div className="mt-6 flex flex-col gap-4 border-t border-[var(--l-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <ul className="space-y-2">{plan.items.map((item) => <li key={item} className="flex items-center gap-2 text-[13px] text-[var(--l-text)]"><Check className="h-3.5 w-3.5 text-emerald-400" />{item}</li>)}</ul>
            <GlowButton onClick={onEnter} className="shrink-0 px-4 py-2.5 text-[12.5px]">{plan.cta} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" /></GlowButton>
          </div>
        </article>)}
      </div>
    </section>
  )
}

function BlogSection({ copy }: { copy: ExtraCopy["blog"] }) {
  return (
    <section id="blog" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-400">{copy.eyebrow}</p>
        <h2 className="font-display mt-3 text-[30px] font-bold text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2>
      </div>
      <div className="mx-auto mt-12 max-w-3xl space-y-4">
        {copy.posts.map((post) => <article key={post.title} className="rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400">{post.tag}</span><time dateTime={post.iso} className="text-[11px] text-[var(--l-faint)]">{post.date}</time></div>
          <h3 className="font-display mt-4 text-[19px] font-bold text-[var(--l-heading)]">{post.title}</h3><p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--l-muted)]">{post.desc}</p>
          <a href="/contact/" className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-blue-400">Lire l'article <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" /></a>
        </article>)}
      </div>
    </section>
  )
}

function FaqSection({ copy }: { copy: ExtraCopy["faq"] }) {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-2xl text-center"><p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-emerald-400">{copy.eyebrow}</p><h2 className="font-display mt-3 text-[30px] font-bold text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2></div>
      <div className="mx-auto mt-12 max-w-3xl divide-y divide-[var(--l-border)] rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] px-5 sm:px-7">
        {copy.items.map((item, i) => <div key={item.q}>
          <button type="button" onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 py-5 text-start text-[14px] font-semibold text-[var(--l-heading)]"><span>{item.q}</span><ChevronDown className={`h-4 w-4 shrink-0 text-[var(--l-faint)] transition-transform ${open === i ? "rotate-180" : ""}`} /></button>
          {open === i && <p className="pb-5 pe-8 text-[13.5px] leading-relaxed text-[var(--l-muted)]">{item.a}</p>}
        </div>)}
      </div>
    </section>
  )
}

function ContactSection({ copy }: { copy: ExtraCopy["contact"] }) {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-blue-400/20 bg-blue-500/10 p-8 sm:p-10">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-400">{copy.eyebrow}</p><h2 className="font-display mt-3 text-[30px] font-bold text-[var(--l-heading)] sm:text-[38px]">{copy.title}</h2><p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--l-muted)]">{copy.sub}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <a href={`mailto:${copy.email}`} className="flex items-center gap-2.5 rounded-xl border border-[var(--l-border)] bg-[var(--l-panel)] p-3 text-[12px] text-[var(--l-text)] hover:border-blue-400/40"><Mail className="h-4 w-4 text-blue-400" />{copy.email}</a>
          <a href={`tel:${copy.phone.replace(/\s/g, "")}`} className="flex items-center gap-2.5 rounded-xl border border-[var(--l-border)] bg-[var(--l-panel)] p-3 text-[12px] text-[var(--l-text)] hover:border-blue-400/40"><Phone className="h-4 w-4 text-blue-400" />{copy.phone}</a>
          <span className="flex items-center gap-2.5 rounded-xl border border-[var(--l-border)] bg-[var(--l-panel)] p-3 text-[12px] text-[var(--l-text)]"><MapPin className="h-4 w-4 shrink-0 text-blue-400" />{copy.city}</span>
        </div>
        <a href={`mailto:${copy.email}`} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-[13px] font-semibold text-white hover:bg-blue-400">{copy.cta} <Mail className="h-4 w-4" /></a>
      </div>
    </section>
  )
}

function LegalSection({ copy, active }: { copy: ExtraCopy["legal"]; active?: "privacy" | "terms" | "cookies" }) {
  const items = [{ id: "privacy", title: copy.privacy, text: copy.privacyText }, { id: "terms", title: copy.terms, text: copy.termsText }, { id: "cookies", title: copy.cookies, text: copy.cookiesText }]
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-3xl border-t border-[var(--l-border)] pt-10">
        {items.filter((item) => !active || item.id === active).map((item) => (
          <article id={item.id} key={item.id}>
            <h2 className="font-display text-[24px] font-bold text-[var(--l-heading)]">{item.title}</h2>
            {item.text.split("\n\n").map((para, i) => (
              <p key={i} className="mt-4 text-[14px] leading-relaxed text-[var(--l-muted)]">{para}</p>
            ))}
          </article>
        ))}
      </div>
    </section>
  )
}

/* ----------------------------- Footer ----------------------------- */

function Footer({ t, extra, onEnter }: { t: Dict; extra: ExtraCopy; onEnter: () => void }) {
  return (
    <footer className="border-t border-[var(--l-border)] bg-[var(--l-bg-solid)]">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-10 border-b border-[var(--l-border)] pb-12 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <Logo light size={32} />
            <h2 className="font-display mt-6 max-w-xl text-[26px] font-bold leading-tight tracking-tight text-[var(--l-heading)] sm:text-[32px]">{t.footer.title}</h2>
            <GlowButton onClick={onEnter} className="mt-6">{t.signup} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></GlowButton>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--l-faint)]">{extra.about.eyebrow}</p>
            <div className="mt-4 flex flex-col items-start gap-3 text-[12.5px] text-[var(--l-muted)]">
              <a href="/features/" className="hover:text-[var(--l-heading)]">{t.nav.features}</a>
              <a href="/benefits/" className="hover:text-[var(--l-heading)]">{t.nav.benefits}</a>
              <a href="/pricing/" className="hover:text-[var(--l-heading)]">{t.nav.pricing}</a>
              <a href="/blog/" className="hover:text-[var(--l-heading)]">{extra.blog.eyebrow}</a>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--l-faint)]">{extra.contact.eyebrow}</p>
            <div className="mt-4 flex flex-col items-start gap-3 text-[12.5px] text-[var(--l-muted)]">
              <a href={`mailto:${extra.contact.email}`} className="hover:text-[var(--l-heading)]">{extra.contact.email}</a>
              <a href="/faq/" className="hover:text-[var(--l-heading)]">{t.nav.faq}</a>
              <a href="/privacy/" className="hover:text-[var(--l-heading)]">{extra.legal.privacy}</a>
              <a href="/terms/" className="hover:text-[var(--l-heading)]">{extra.legal.terms}</a>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-4 text-[12px] text-[var(--l-faint)] sm:flex-row sm:items-center">
          <p>{t.footer.copy}</p>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/cookies/" className="hover:text-[var(--l-heading)]">{extra.legal.cookies}</a>
            <p className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> {t.footer.compliance}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

function CookieBanner({ lang }: { lang: Lang }) {
  const [visible, setVisible] = useState(false)
  const copy = {
    fr: { text: "Nous utilisons des cookies nécessaires au fonctionnement du site et Google Analytics pour mesurer l'audience et améliorer Fatorati. Aucune publicité, aucune revente de données.", accept: "Accepter", reject: "Refuser", link: "En savoir plus" },
    en: { text: "We use necessary cookies and Google Analytics to measure traffic and improve Fatorati. No ads, no data resale.", accept: "Accept", reject: "Decline", link: "Learn more" },
    ar: { text: "نستخدم ملفات ضرورية لتشغيل الموقع وGoogle Analytics لقياس الزوار وتحسين فاتورتي. بدون إعلانات وبدون بيع البيانات.", accept: "موافقة", reject: "رفض", link: "معرفة المزيد" },
  }[lang]

  useEffect(() => {
    setVisible(localStorage.getItem("fatorati-cookie-consent") === null)
  }, [])

  function choose(value: "accepted" | "declined") {
    localStorage.setItem("fatorati-cookie-consent", value)
    setVisible(false)
  }

  if (!visible) return null
  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-2xl border border-[var(--l-border-strong)] bg-[var(--l-panel)] p-4 shadow-2xl backdrop-blur-xl sm:flex sm:items-center sm:gap-5 sm:p-5" role="dialog" aria-label={copy.link}>
      <p className="flex-1 text-[12.5px] leading-relaxed text-[var(--l-text)]">{copy.text} <a href="/cookies/" className="font-semibold text-blue-400 hover:underline">{copy.link}</a></p>
      <div className="mt-4 flex shrink-0 gap-2 sm:mt-0">
        <button type="button" onClick={() => choose("declined")} className="rounded-lg border border-[var(--l-border-strong)] px-3 py-2 text-[12px] font-semibold text-[var(--l-muted)] hover:text-[var(--l-heading)]">{copy.reject}</button>
        <button type="button" onClick={() => choose("accepted")} className="rounded-lg bg-blue-500 px-3 py-2 text-[12px] font-semibold text-white hover:bg-blue-400">{copy.accept}</button>
      </div>
    </aside>
  )
}
