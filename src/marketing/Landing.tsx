import { useId, useState } from "react"
import {
  ArrowRight, Sparkles, ShieldCheck, CalendarDays, ShieldAlert, Wrench, FileText,
  Check, TrendingUp, Zap, Plus, Bell, ScrollText, LayoutDashboard, ChevronRight,
  Globe, ChevronDown, Sun, Moon,
} from "lucide-react"
import { Logo } from "../components/nav"

const GRAD = "linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)"

type Lang = "fr" | "en" | "ar"
type Theme = "dark" | "light"
type Seg = { t: string; hi?: boolean }

const LANGS: { code: Lang; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
]

const T: Record<Lang, {
  nav: { features: string; assistant: string }
  signup: string; explore: string
  hero: { badge: string; headline: Seg[]; sub: string; note: string }
  feat: { eyebrow: string; title: string; sub: string }
  f1: { tag: string; title: string; desc: string }
  f2: { tag: string; title: string; desc: string; items: { label: string; desc: string; level: string }[] }
  f3: { tag: string; title: string; desc: string; add: string; cols: [string, string, string, string]; tools: [string, string, string, string][]; blocks: [string, string][]; trend: string }
  cal: { month: string; renew: string; pay: string; legal: string; days: string[]; upcoming: string; events: { day: number; type: "renew" | "pay" | "legal"; label: string }[] }
  prev: { greet: string; title: string; add: string; stats: string[]; trend: string; plan: string; nav: string[] }
  asst: { badge: string; title: string; desc: string; cta: string; panel: string; panelSub: string; rules: string[]; verified: string }
  trust: string
  footer: { title: string; compliance: string; copy: string }
}> = {
  fr: {
    nav: { features: "Fonctionnalités", assistant: "Assistant" },
    signup: "S'inscrire", explore: "Explorer",
    hero: {
      badge: "Pensé pour les artisans, freelances & TPE marocaines",
      headline: [{ t: "Le logiciel simple qui pilote vos " }, { t: "finances", hi: true }, { t: ", vos " }, { t: "abonnements", hi: true }, { t: " et vos " }, { t: "risques", hi: true }, { t: "." }],
      sub: "Conçu mobile-first pour les artisans, freelances et petites entreprises marocaines : suivez vos échéances, maîtrisez vos coûts d'outils et restez conforme, depuis votre poche.",
      note: "Sans carte bancaire · Conforme Loi 09-08",
    },
    feat: { eyebrow: "Tout-en-un", title: "Trois outils, une seule application", sub: "Chaque fonctionnalité pensée pour la réalité du terrain marocain." },
    f1: { tag: "Planification", title: "Outil de Calendrier", desc: "Un calendrier de time-blocking épuré pour ne jamais manquer une date clé : échéances légales, renouvellements de contrats et paiements." },
    f2: { tag: "Conformité", title: "Gestion des Risques", desc: "Des alertes proactives et des contrôles de conformité locaux, adaptés aux réglementations des entreprises marocaines.", items: [{ label: "Déclaration TVA — T3 2026", desc: "À déposer avant le 30/09 auprès de la DGI. Pénalité de 15% en cas de retard.", level: "Élevé" }, { label: "Contrat client Atlas BTP", desc: "Clause de pénalité de retard à réviser avant renouvellement.", level: "Moyen" }, { label: "Registre du commerce (RC)", desc: "Modèle J mis à jour au tribunal de commerce de Casablanca.", level: "OK" }] },
    f3: { tag: "Finances", title: "Suivi des Abonnements & Outils", desc: "Saisissez chaque outil, visualisez vos totaux et suivez la tendance de vos dépenses mensuelles.", add: "Ajouter un outil", cols: ["Outil", "Coût / mois", "Début", "Expiration"], tools: [["Adobe Creative Cloud", "299 MAD", "01/03/26", "01/03/27"], ["Microsoft 365", "129 MAD", "12/01/26", "12/01/27"], ["Sage Compta", "450 MAD", "05/06/26", "05/06/27"], ["Hébergement OVH", "89 MAD", "20/02/26", "20/02/27"]], blocks: [["Total / mois", "1 720"], ["Outils actifs", "14"], ["Expire < 30j", "3"]], trend: "Tendance mensuelle" },
    cal: { month: "Septembre 2026", renew: "Renouv.", pay: "Paiement", legal: "Échéance légale", days: ["L", "M", "M", "J", "V", "S", "D"], upcoming: "Dates cruciales à venir", events: [{ day: 8, type: "pay", label: "Paiement Adobe CC — 299 MAD" }, { day: 15, type: "renew", label: "Renouvellement Microsoft 365" }, { day: 23, type: "legal", label: "Déclaration TVA (DGI)" }, { day: 27, type: "renew", label: "Fin abonnement Sage Compta" }] },
    prev: { greet: "Bonjour, Karim 👋", title: "Suivi des outils", add: "Ajouter", stats: ["Dépense / mois", "Outils actifs", "Échéances 7j"], trend: "Tendance des dépenses", plan: "Plan Pro", nav: ["Tableau", "Contrats", "Calendrier", "Risques", "Outils"] },
    asst: { badge: "Mizan Assistant", title: "Intégration juridique intelligente", desc: "Un panneau léger et intelligent qui vous sert dynamiquement les règles juridiques locales exactes et des modèles de contrats prêts à l'emploi — adaptés au droit marocain.", cta: "Découvrir l'assistant", panel: "Modèles suggérés", panelSub: "Basés sur votre activité", rules: ["Contrat de prestation — art. 723 DOC", "Clause de confidentialité (Loi 09-08)", "Facture conforme ICE + TVA 20%"], verified: "Vérifié selon le DOC & la Loi 09-08" },
    trust: "Ils pilotent leur activité avec Mizan",
    footer: { title: "Prêt à équilibrer votre gestion ?", compliance: "Conforme Loi 09-08 (CNDP)", copy: "© 2026 Mizan ERP · Casablanca, Maroc" },
  },
  en: {
    nav: { features: "Features", assistant: "Assistant" },
    signup: "Sign up", explore: "Explore",
    hero: {
      badge: "Built for Moroccan artisans, freelancers & small businesses",
      headline: [{ t: "The simple software that runs your " }, { t: "finances", hi: true }, { t: ", your " }, { t: "subscriptions", hi: true }, { t: " and your " }, { t: "risks", hi: true }, { t: "." }],
      sub: "Built mobile-first for Moroccan artisans, freelancers and small businesses: track your deadlines, control your tool costs and stay compliant — right from your pocket.",
      note: "No credit card · Law 09-08 compliant",
    },
    feat: { eyebrow: "All-in-one", title: "Three tools, one single app", sub: "Every feature designed for the Moroccan field reality." },
    f1: { tag: "Planning", title: "Calendar Tool", desc: "A clean time-blocking calendar so you never miss a key date: legal deadlines, contract renewals and payments." },
    f2: { tag: "Compliance", title: "Risk Management", desc: "Proactive alerts and local compliance checks, tailored to Moroccan business regulations.", items: [{ label: "VAT return — Q3 2026", desc: "Due before 30/09 to the DGI. 15% penalty on late filing.", level: "High" }, { label: "Client contract Atlas BTP", desc: "Late-payment penalty clause to review before renewal.", level: "Medium" }, { label: "Trade register (RC)", desc: "Model J updated at the Casablanca commercial court.", level: "OK" }] },
    f3: { tag: "Finance", title: "Subscriptions & Tools Tracking", desc: "Log each tool, view your totals and track your monthly spending trend.", add: "Add a tool", cols: ["Tool", "Cost / month", "Start", "Expiry"], tools: [["Adobe Creative Cloud", "299 MAD", "01/03/26", "01/03/27"], ["Microsoft 365", "129 MAD", "12/01/26", "12/01/27"], ["Sage Compta", "450 MAD", "05/06/26", "05/06/27"], ["OVH Hosting", "89 MAD", "20/02/26", "20/02/27"]], blocks: [["Total / month", "1 720"], ["Active tools", "14"], ["Expiring < 30d", "3"]], trend: "Monthly trend" },
    cal: { month: "September 2026", renew: "Renewal", pay: "Payment", legal: "Legal deadline", days: ["M", "T", "W", "T", "F", "S", "S"], upcoming: "Upcoming crucial dates", events: [{ day: 8, type: "pay", label: "Adobe CC payment — 299 MAD" }, { day: 15, type: "renew", label: "Microsoft 365 renewal" }, { day: 23, type: "legal", label: "VAT return (DGI)" }, { day: 27, type: "renew", label: "Sage Compta subscription ends" }] },
    prev: { greet: "Hello, Karim 👋", title: "Tools tracking", add: "Add", stats: ["Spend / month", "Active tools", "Due in 7d"], trend: "Spending trend", plan: "Pro plan", nav: ["Dashboard", "Contracts", "Calendar", "Risks", "Tools"] },
    asst: { badge: "Mizan Assistant", title: "Smart legal integration", desc: "A lightweight, intelligent panel that dynamically serves the exact local legal rules and ready-to-use contract templates — tailored to Moroccan law.", cta: "Discover the assistant", panel: "Suggested templates", panelSub: "Based on your activity", rules: ["Service contract — art. 723 DOC", "Confidentiality clause (Law 09-08)", "Invoice compliant ICE + VAT 20%"], verified: "Verified against the DOC & Law 09-08" },
    trust: "They run their business with Mizan",
    footer: { title: "Ready to balance your management?", compliance: "Law 09-08 compliant (CNDP)", copy: "© 2026 Mizan ERP · Casablanca, Morocco" },
  },
  ar: {
    nav: { features: "الميزات", assistant: "المساعد" },
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
    asst: { badge: "مساعد ميزان", title: "تكامل قانوني ذكي", desc: "لوحة خفيفة وذكية تقدّم لك القواعد القانونية المحلية الدقيقة ونماذج عقود جاهزة — مصممة للقانون المغربي.", cta: "اكتشف المساعد", panel: "نماذج مقترحة", panelSub: "بناءً على نشاطك", rules: ["عقد خدمة — المادة 723 ق.ل.ع", "بند السرية (القانون 09-08)", "فاتورة مطابقة ICE + ض.ق.م 20%"], verified: "تم التحقق وفق ق.ل.ع والقانون 09-08" },
    trust: "يديرون نشاطهم مع ميزان",
    footer: { title: "مستعد لموازنة إدارتك؟", compliance: "متوافق مع القانون 09-08 (CNDP)", copy: "© 2026 ميزان · الدار البيضاء، المغرب" },
  },
}

export default function Landing({ onEnter }: { onEnter: () => void }) {
  const [lang, setLang] = useState<Lang>("fr")
  const [theme, setTheme] = useState<Theme>("dark")
  const t = T[lang]
  const rtl = lang === "ar"

  return (
    <div className="landing-root aurora min-h-screen font-sans antialiased" data-theme={theme} dir={rtl ? "rtl" : "ltr"}>
      <div className="relative">
        <div className="grid-veil pointer-events-none absolute inset-0 h-[720px]" />
        <Header t={t} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} onEnter={onEnter} />
        <Hero t={t} onEnter={onEnter} />
      </div>
      <Features t={t} />
      <Assistant t={t} onEnter={onEnter} />
      <SocialProof t={t} />
      <Footer t={t} onEnter={onEnter} />
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

function Header({ t, lang, setLang, theme, setTheme, onEnter }: { t: Dict; lang: Lang; setLang: (l: Lang) => void; theme: Theme; setTheme: (t: Theme) => void; onEnter: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--l-border)] bg-[var(--l-header)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <Logo light={theme === "dark"} size={32} />
        <nav className="hidden items-center gap-8 text-[13.5px] font-medium text-[var(--l-muted)] md:flex">
          <a href="#features" className="transition-colors hover:text-[var(--l-heading)]">{t.nav.features}</a>
          <a href="#assistant" className="transition-colors hover:text-[var(--l-heading)]">{t.nav.assistant}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LangSwitcher lang={lang} setLang={setLang} />
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <GlowButton onClick={onEnter} className="px-4 py-2.5 text-[13px]">{t.signup}</GlowButton>
        </div>
      </div>
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
      <div className="mz-glow pointer-events-none absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[40px] blur-3xl" style={{ background: "radial-gradient(50% 50% at 50% 30%, rgba(124,58,237,0.35), transparent 70%)" }} />
      <div className="overflow-hidden rounded-2xl border border-[var(--l-border-strong)] bg-[var(--l-panel)] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="flex items-center gap-1.5 border-b border-[var(--l-border)] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--l-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--l-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--l-border-strong)]" />
          <span className="mx-3 rounded-md bg-[var(--l-chip)] px-2 py-0.5 font-mono text-[10.5px] text-[var(--l-faint)]">app.mizan.ma/tableau</span>
        </div>

        <div className="flex">
          <aside className="hidden w-[184px] shrink-0 flex-col gap-1 border-e border-[var(--l-border)] bg-[var(--l-surface)] p-3 sm:flex">
            <div className="px-2 pb-3"><Logo light={false} size={26} /></div>
            {t.prev.nav.map((label, i) => {
              const Icon = previewIcons[i]
              const active = i === 4
              return (
                <div key={label} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium ${active ? "text-white" : "text-[var(--l-muted)]"}`} style={active ? { backgroundImage: GRAD } : undefined}>
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 2} /> {label}
                </div>
              )
            })}
            <div className="mt-auto rounded-lg border border-[var(--l-border)] bg-[var(--l-panel-2)] p-2.5">
              <p className="text-[10.5px] text-[var(--l-faint)]">{t.prev.plan}</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-[var(--l-border-strong)]"><div className="h-full w-2/3 rounded-full" style={{ backgroundImage: GRAD }} /></div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-[var(--l-faint)]">{t.prev.greet}</p>
                <h3 className="font-display text-[16px] font-bold text-[var(--l-heading)]">{t.prev.title}</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-white" style={{ backgroundImage: GRAD }}>
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
            <stop offset="0%" stopColor="#9333ea" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${gid}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#d946ef" />
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

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
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
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] p-6 transition-all duration-300 hover:border-violet-400/30">
      <div className="pointer-events-none absolute -end-16 -top-16 h-40 w-40 rounded-full bg-violet-600/10 blur-3xl transition-opacity duration-300 group-hover:bg-violet-500/20" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl text-white shadow-[0_8px_24px_-6px_rgba(124,58,237,0.6)]" style={{ backgroundImage: GRAD }}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="rounded-full border border-[var(--l-border-strong)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--l-muted)]">{tag}</span>
      </div>
      <h3 className="font-display relative mt-4 text-[18px] font-bold text-[var(--l-heading)]">{title}</h3>
      <div className="relative mt-2 space-y-4">{children}</div>
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

/* -------------------------- Social proof -------------------------- */

function SocialProof({ t }: { t: Dict }) {
  const clients = ["Atlas BTP", "Riad Zitoun", "Chaoui Immo", "Al Amane", "Sonasid", "Tazi & Fils"]
  return (
    <section id="trust" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <div className="flex flex-col items-center gap-8 rounded-2xl border border-[var(--l-border)] bg-[var(--l-surface)] px-6 py-10">
        <p className="text-[12.5px] font-medium uppercase tracking-[0.15em] text-[var(--l-faint)]">{t.trust}</p>
        <div className="grid w-full grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 md:grid-cols-6">
          {clients.map((c) => (
            <div key={c} className="flex items-center justify-center opacity-70 transition-opacity hover:opacity-100">
              <span className="font-display text-[14px] font-bold tracking-tight text-[var(--l-text)]">{c}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------- Footer ----------------------------- */

function Footer({ t, onEnter }: { t: Dict; onEnter: () => void }) {
  return (
    <footer className="border-t border-[var(--l-border)] bg-[var(--l-bg-solid)]">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className="font-display max-w-xl text-[26px] font-bold leading-tight tracking-tight text-[var(--l-heading)] sm:text-[32px]">{t.footer.title}</h2>
          <GlowButton onClick={onEnter}>{t.signup} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></GlowButton>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[var(--l-border)] pt-6 text-[12px] text-[var(--l-faint)] sm:flex-row">
          <p>{t.footer.copy}</p>
          <p className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-violet-400" /> {t.footer.compliance}</p>
        </div>
      </div>
    </footer>
  )
}
