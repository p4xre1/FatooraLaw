import { CONTENT_UPDATED, GITHUB_URL, SOURCES } from "./contentMeta"
import { useLocaleHref } from "../lib/localeContext"
import { onInternalLinkClick } from "../lib/router"

export type RefLang = "fr" | "en" | "ar"

const UPDATED_LABEL: Record<RefLang, string> = {
  fr: "13 octobre 2026",
  en: "13 October 2026",
  ar: "13 أكتوبر 2026",
}

export type RefQa = { q: string; a: string }
export type RefStep = { name: string; text: string }
export type RefRow = { label: string; value: string; source: string; url: string }

type RefCopy = {
  breadcrumb: string
  home: string
  updated: string
  by: string
  eyebrow: string
  title: string
  intro: string
  inlineBefore: string
  inlineAfter: string
  vatLabel: string
  penaltyLabel: string
  dgiLabel: string
  cgiLabel: string
  sections: { q: string; a: string; quote?: string; quoteCite?: string; quoteSource?: string; quoteUrl?: string }[]
  howtoTitle: string
  howtoIntro: string
  steps: RefStep[]
  priceTitle: string
  priceBody: string
  tableCaption: string
  cols: [string, string, string]
  rows: RefRow[]
  sourcesTitle: string
  notAdvice: string
}

const FR: RefCopy = {
  breadcrumb: "Fil d'Ariane",
  home: "Accueil",
  updated: "Mis à jour le",
  by: "l'équipe Fatorati",
  eyebrow: "Sources",
  title: "Quels repères une TPE marocaine doit-elle avoir sous la main ?",
  intro:
    "Fatorati est une application de gestion pour les artisans, freelances et petites entreprises au Maroc. Elle ne remplace ni l'expert-comptable, ni l'avocat, ni le portail de la Direction Générale des Impôts. Les chiffres ci-dessous sont ceux des textes officiels, pas ceux de l'aperçu de démonstration du tableau de bord.",
  inlineBefore: "Repère officiel : le taux normal de TVA est de",
  inlineAfter: "Une TVA versée hors délai est passible d'une pénalité de",
  vatLabel: "20 %",
  penaltyLabel: "20 %",
  dgiLabel: "DGI, guide TVA",
  cgiLabel: "CGI, art. 208",
  sections: [
    {
      q: "Quel est le taux normal de TVA au Maroc ?",
      a: "Le taux normal de la taxe sur la valeur ajoutée est de 20 %. La DGI rappelle aussi des taux réduits (dont 7 % avec droit à déduction sur certaines ventes) et des exonérations, par exemple sur une partie des produits de large consommation. Une facture marocaine doit donc afficher le taux qui correspond à l'opération, avec l'ICE, et non appliquer 20 % par habitude. Fatorati rappelle la mention ; il ne choisit pas le taux à votre place.",
      quote: "Le taux normal de la taxe sur la valeur ajoutée est fixé à 20 %.",
      quoteCite: SOURCES.tva.url,
      quoteSource: "Direction Générale des Impôts, guide TVA",
      quoteUrl: SOURCES.tva.url,
    },
    {
      q: "Quelle pénalité si la TVA est versée hors délai ?",
      a: "L'article 208 du Code général des impôts prévoit, dans le cas général, une pénalité de 10 % et une majoration de 5 % pour le premier mois de retard, puis 0,50 % par mois ou fraction de mois supplémentaire. Cette pénalité de 10 % est portée à 20 % en cas de défaut de versement ou de versement hors délai de la TVA due. Le chiffre de 15 % parfois répété mélange la pénalité et la majoration du premier mois : ce n'est pas le taux spécifique à la TVA.",
      quote: "La pénalité de 10 % est portée à 20 % en cas de versement hors délai de la taxe sur la valeur ajoutée due.",
      quoteCite: SOURCES.cgi.url,
      quoteSource: "Direction Générale des Impôts, article 208 du CGI",
      quoteUrl: SOURCES.cgi.url,
    },
    {
      q: "La loi 09-08 s'applique-t-elle à une petite entreprise ?",
      a: "Oui, dès qu'un traitement de données personnelles est réalisé au Maroc. La CNDP vise les organismes publics et privés, y compris une TPE qui tient un fichier clients, des fiches de paie ou un site. La loi n° 09-08 du 18 février 2009 a été publiée au Bulletin officiel n° 5714 du 5 mars 2009. Fatorati limite l'accès aux données du compte et ne les vend pas ; la déclaration d'un traitement auprès de la CNDP, lorsqu'elle est exigée, reste à la charge du responsable du traitement.",
      quote: "Tous les traitements dont les responsables ou les moyens de traitement sont situés sur le territoire marocain sont tenus de se conformer à la loi 09-08 du 18 février 2009 (BO n° 5714 du 5 mars 2009).",
      quoteCite: SOURCES.cndp.url,
      quoteSource: "Commission nationale de contrôle de la protection des données à caractère personnel",
      quoteUrl: SOURCES.cndp.url,
    },
  ],
  howtoTitle: "Comment une TPE suit-elle ces échéances sans les disperser ?",
  howtoIntro:
    "Quatre gestes suffisent pour que le calendrier, les alertes et le coffre racontent la même histoire. Ce n'est pas une procédure fiscale : c'est la méthode que Fatorati rend visible.",
  steps: [
    { name: "Ouvrir un espace", text: "Créez un compte Fatorati. L'offre Essentiel démarre à 0 MAD, sans carte bancaire." },
    { name: "Poser les dates réelles", text: "Saisissez l'ICE, les échéances DGI, les renouvellements de contrats et les abonnements d'outils, chacun avec son montant." },
    { name: "Lire l'alerte avant la date", text: "Le calendrier et la gestion des risques affichent la date et le texte applicable, avec le lien vers la DGI ou la CNDP quand la règle vient d'un texte officiel." },
    { name: "Garder la pièce", text: "Exportez ou déposez le document dans le coffre. La durée légale de conservation comptable ou fiscale peut dépasser la durée du compte." },
  ],
  priceTitle: "Que coûte Fatorati, et que ne fait-il pas ?",
  priceBody:
    "Trois formules, publiées en dirhams : Essentiel à 0 MAD pour commencer, Pro à 199 MAD par mois, Équipe à 499 MAD par mois. On peut changer de formule ou s'arrêter. Fatorati ne produit pas une liasse fiscale, ne télé-déclare pas à la DGI et ne se substitue pas à un conseil. Les montants du tableau de bord illustré (1 720 MAD, +12 %) sont un aperçu de démonstration, pas une statistique.",
  tableCaption: "Repères chiffrés cités sur cette page",
  cols: ["Repère", "Valeur", "Source"],
  rows: [
    { label: "TVA, taux normal", value: "20 %", source: "DGI, guide TVA", url: SOURCES.tva.url },
    { label: "Pénalité, TVA hors délai", value: "20 %", source: "CGI, art. 208", url: SOURCES.cgi.url },
    { label: "Pénalité + majoration, 1er mois (cas général)", value: "10 % + 5 %", source: "CGI, art. 208", url: SOURCES.cgi.url },
    { label: "Loi 09-08", value: "18 février 2009, BO n° 5714", source: "CNDP", url: SOURCES.cndp.url },
    { label: "Fatorati Essentiel / Pro / Équipe", value: "0 / 199 / 499 MAD", source: "Page Tarifs", url: "/pricing" },
  ],
  sourcesTitle: "Sources",
  notAdvice: "Ces extraits aident à citer le bon texte. Ils ne sont pas un conseil fiscal ou juridique personnalisé.",
}

const EN: RefCopy = {
  breadcrumb: "Breadcrumb",
  home: "Home",
  updated: "Updated",
  by: "the Fatorati team",
  eyebrow: "Sources",
  title: "Which official figures should a Moroccan small business keep at hand?",
  intro:
    "Fatorati is a management application for artisans, freelancers and small businesses in Morocco. It does not replace an accountant, a lawyer, or the tax authority portal. The figures below come from official texts, not from the sample dashboard on this site.",
  inlineBefore: "Official figure: the standard VAT rate is",
  inlineAfter: "VAT paid late carries a penalty of",
  vatLabel: "20%",
  penaltyLabel: "20%",
  dgiLabel: "DGI, VAT guide",
  cgiLabel: "CGI, art. 208",
  sections: [
    {
      q: "What is the standard VAT rate in Morocco?",
      a: "The standard value-added tax rate is 20%. The tax authority (DGI) also publishes reduced rates, including 7% with a right to deduct on some sales, and exemptions for part of the basic food basket. A Moroccan invoice should show the rate that matches the transaction, plus the ICE number. Fatorati reminds you of the line; it does not pick the rate for you.",
      quote: "The standard value-added tax rate is set at 20%.",
      quoteCite: SOURCES.tva.url,
      quoteSource: "Direction Générale des Impôts, VAT guide",
      quoteUrl: SOURCES.tva.url,
    },
    {
      q: "What penalty applies when VAT is paid late?",
      a: "Article 208 of the General Tax Code sets, in the general case, a 10% penalty plus a 5% surcharge for the first month of delay, then 0.50% per extra month or fraction of a month. That 10% penalty is raised to 20% when VAT due is not paid, or is paid late. A blended 15% figure is the first-month general case, not the VAT-specific penalty.",
      quote: "The 10% penalty is raised to 20% when value-added tax due is paid late.",
      quoteCite: SOURCES.cgi.url,
      quoteSource: "Direction Générale des Impôts, CGI article 208",
      quoteUrl: SOURCES.cgi.url,
    },
    {
      q: "Does Law 09-08 apply to a very small business?",
      a: "Yes, as soon as personal data is processed in Morocco. The CNDP covers public and private bodies, including a small firm that keeps a client file, payroll records or a website. Law 09-08 of 18 February 2009 was published in Official Bulletin No. 5714 on 5 March 2009. Fatorati restricts account access and does not sell the data; filing a processing declaration with the CNDP, when required, stays with the controller.",
      quote: "Every processing whose controller or means are located in Morocco must comply with Law 09-08 of 18 February 2009 (Official Bulletin No. 5714 of 5 March 2009).",
      quoteCite: SOURCES.cndp.url,
      quoteSource: "National commission for the protection of personal data",
      quoteUrl: SOURCES.cndp.url,
    },
  ],
  howtoTitle: "How can a small business track these deadlines in one place?",
  howtoIntro: "Four steps keep the calendar, the alerts and the vault telling the same story. This is a working method, not a tax filing procedure.",
  steps: [
    { name: "Open a workspace", text: "Create a Fatorati account. The Essential plan starts at MAD 0, with no card required." },
    { name: "Enter the real dates", text: "Add the ICE, DGI deadlines, contract renewals and tool subscriptions, each with its amount." },
    { name: "Read the alert before the date", text: "The calendar and risk view show the date and the rule, with a link to the DGI or the CNDP when the rule comes from an official text." },
    { name: "Keep the document", text: "Export it or store it in the vault. Legal retention for accounting or tax can outlast the account." },
  ],
  priceTitle: "What does Fatorati cost, and what does it not do?",
  priceBody:
    "Three plans, published in dirhams: Essential at MAD 0 to start, Pro at MAD 199 per month, Team at MAD 499 per month. You can change plan or stop. Fatorati does not produce a tax return, does not file with the DGI, and does not replace advice. The illustrated dashboard figures (MAD 1,720, +12%) are a demo preview, not a statistic.",
  tableCaption: "Figures cited on this page",
  cols: ["Figure", "Value", "Source"],
  rows: [
    { label: "VAT, standard rate", value: "20%", source: "DGI, VAT guide", url: SOURCES.tva.url },
    { label: "Penalty, late VAT", value: "20%", source: "CGI, art. 208", url: SOURCES.cgi.url },
    { label: "Penalty + surcharge, first month (general case)", value: "10% + 5%", source: "CGI, art. 208", url: SOURCES.cgi.url },
    { label: "Law 09-08", value: "18 February 2009, BO No. 5714", source: "CNDP", url: SOURCES.cndp.url },
    { label: "Fatorati Essential / Pro / Team", value: "MAD 0 / 199 / 499", source: "Pricing page", url: "/pricing" },
  ],
  sourcesTitle: "Sources",
  notAdvice: "These extracts help you cite the right text. They are not personal tax or legal advice.",
}

const AR: RefCopy = {
  breadcrumb: "مسار التصفح",
  home: "الرئيسية",
  updated: "آخر تحديث",
  by: "فريق فاتورتي",
  eyebrow: "المصادر",
  title: "ما الأرقام الرسمية التي يجب أن تبقيها المقاولة الصغيرة في متناولها؟",
  intro:
    "فاتورتي تطبيق إدارة للحرفيين والمستقلين والشركات الصغيرة في المغرب. لا يحل محل المحاسب ولا المحامي ولا بوابة المديرية العامة للضرائب. الأرقام أدناه مأخوذة من النصوص الرسمية، لا من لوحة العرض التوضيحية في الموقع.",
  inlineBefore: "مرجع رسمي: السعر العادي للضريبة على القيمة المضافة هو",
  inlineAfter: "أداء الضريبة خارج الأجل يعرّض لذعيرة بنسبة",
  vatLabel: "20٪",
  penaltyLabel: "20٪",
  dgiLabel: "المديرية العامة للضرائب، دليل الضريبة",
  cgiLabel: "المدونة العامة للضرائب، المادة 208",
  sections: [
    {
      q: "ما هو السعر العادي للضريبة على القيمة المضافة في المغرب؟",
      a: "السعر العادي للضريبة على القيمة المضافة هو 20٪. تنشر المديرية العامة للضرائب أيضاً أسعاراً مخفضة، منها 7٪ مع الحق في الخصم على بعض البيوع، وإعفاءات لجزء من المواد واسعة الاستهلاك. يجب أن تُظهر الفاتورة السعر المطابق للعملية مع رقم التعريف الموحد للمقاولة. فاتورتي تذكّر بالبيان ولا تختار السعر نيابة عنك.",
      quote: "حُدد السعر العادي للضريبة على القيمة المضافة في 20٪.",
      quoteCite: SOURCES.tva.url,
      quoteSource: "المديرية العامة للضرائب، دليل الضريبة على القيمة المضافة",
      quoteUrl: SOURCES.tva.url,
    },
    {
      q: "ما الذعيرة إذا دُفعت الضريبة خارج الأجل؟",
      a: "تنص المادة 208 من المدونة العامة للضرائب، في الحالة العامة، على ذعيرة 10٪ وزيادة 5٪ عن الشهر الأول من التأخير، ثم 0,50٪ عن كل شهر أو جزء شهر إضافي. تُرفع ذعيرة 10٪ إلى 20٪ عند عدم أداء الضريبة على القيمة المضافة المستحقة أو أدائها خارج الأجل. رقم 15٪ الذي يُتداول أحياناً يخلط بين الذعيرة والزيادة عن الشهر الأول، وليس هو السعر الخاص بهذه الضريبة.",
      quote: "تُرفع ذعيرة 10٪ إلى 20٪ عند أداء الضريبة على القيمة المضافة المستحقة خارج الأجل.",
      quoteCite: SOURCES.cgi.url,
      quoteSource: "المديرية العامة للضرائب، المادة 208 من المدونة العامة للضرائب",
      quoteUrl: SOURCES.cgi.url,
    },
    {
      q: "هل يسري القانون 09-08 على المقاولة الصغيرة جداً؟",
      a: "نعم، بمجرد معالجة بيانات شخصية في المغرب. تشمل اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي الهيئات العامة والخاصة، بما فيها مقاولة صغيرة تحتفظ بملف زبائن أو بكشوف أجور أو بموقع. صدر القانون 09-08 في 18 فبراير 2009 ونُشر في الجريدة الرسمية عدد 5714 بتاريخ 5 مارس 2009. تقيّد فاتورتي الوصول إلى بيانات الحساب ولا تبيعها؛ ويبقى التصريح بالمعالجة لدى اللجنة، عندما يكون مطلوباً، على عاتق المسؤول عن المعالجة.",
      quote: "كل معالجة يوجد مسؤولوها أو وسائلها على التراب المغربي ملزمة بالامتثال للقانون 09-08 الصادر في 18 فبراير 2009 (الجريدة الرسمية عدد 5714 بتاريخ 5 مارس 2009).",
      quoteCite: SOURCES.cndp.url,
      quoteSource: "اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي",
      quoteUrl: SOURCES.cndp.url,
    },
  ],
  howtoTitle: "كيف تتابع مقاولة صغيرة هذه المواعيد دون تشتيتها؟",
  howtoIntro: "أربع خطوات تكفي ليروي التقويم والتنبيهات والخزنة القصة نفسها. هذه طريقة عمل، وليست مسطرة إيداع جبائي.",
  steps: [
    { name: "افتح مساحة", text: "أنشئ حساباً في فاتورتي. خطة الأساسي تبدأ من 0 درهم، دون بطاقة بنكية." },
    { name: "أدخل المواعيد الحقيقية", text: "أضف التعريف الموحد ومواعيد المديرية العامة للضرائب وتجديد العقود واشتراكات الأدوات، كلٌّ بمبلغه." },
    { name: "اقرأ التنبيه قبل الموعد", text: "يعرض التقويم وإدارة المخاطر التاريخ والقاعدة، مع رابط إلى المديرية أو اللجنة عندما تأتي القاعدة من نص رسمي." },
    { name: "احتفظ بالوثيقة", text: "صدّرها أو أودعها في الخزنة. قد تتجاوز مدة الحفظ المحاسبية أو الجبائية مدة الحساب." },
  ],
  priceTitle: "بكم تكلف فاتورتي، وما الذي لا تفعله؟",
  priceBody:
    "ثلاث خطط منشورة بالدرهم: الأساسي بـ 0 درهم للبدء، برو بـ 199 درهماً في الشهر، والفريق بـ 499 درهماً في الشهر. يمكن تغيير الخطة أو التوقف. لا تُنتج فاتورتي إقراراً جبائياً ولا تُودعه لدى المديرية العامة للضرائب ولا تحل محل استشارة. أرقام اللوحة التوضيحية (1 720 درهماً، +12٪) مثال للعرض وليست إحصائية.",
  tableCaption: "أرقام مُستشهد بها في هذه الصفحة",
  cols: ["المرجع", "القيمة", "المصدر"],
  rows: [
    { label: "الضريبة على القيمة المضافة، السعر العادي", value: "20٪", source: "دليل الضريبة", url: SOURCES.tva.url },
    { label: "ذعيرة الضريبة خارج الأجل", value: "20٪", source: "المادة 208", url: SOURCES.cgi.url },
    { label: "ذعيرة + زيادة، الشهر الأول (الحالة العامة)", value: "10٪ + 5٪", source: "المادة 208", url: SOURCES.cgi.url },
    { label: "القانون 09-08", value: "18 فبراير 2009، ج.ر. 5714", source: "اللجنة الوطنية", url: SOURCES.cndp.url },
    { label: "فاتورتي أساسي / برو / فريق", value: "0 / 199 / 499 درهماً", source: "صفحة الأسعار", url: "/pricing" },
  ],
  sourcesTitle: "المصادر",
  notAdvice: "هذه المقتطفات تساعد على الاستشهاد بالنص الصحيح. ليست استشارة جبائية أو قانونية خاصة.",
}

export const REFERENCE: Record<RefLang, RefCopy> = { fr: FR, en: EN, ar: AR }

export type PageLead = { eyebrow: string; title: string; lead: string }

const LEADS: Record<RefLang, Record<string, PageLead>> = {
  fr: {
    features: {
      eyebrow: "Fonctionnalités",
      title: "Que réunit Fatorati pour une TPE marocaine ?",
      lead: "Fatorati réunit dans une seule application le calendrier des échéances, les alertes de conformité et le suivi du coût des outils. Une petite entreprise y voit ses dates DGI, ses contrats et ses abonnements sans ouvrir trois logiciels.",
    },
    assistant: {
      eyebrow: "Assistant",
      title: "Quelles règles marocaines l'assistant rappelle-t-il ?",
      lead: "L'assistant propose des modèles de contrats et les mentions utiles au droit marocain : article 723 du DOC pour la prestation, clause de confidentialité au titre de la loi 09-08, facture avec ICE et TVA. Il cite la règle ; il ne signe pas à votre place.",
    },
    about: {
      eyebrow: "À propos",
      title: "Qui est Fatorati, et pour qui ?",
      lead: "Fatorati est édité pour les artisans, freelances et TPE au Maroc qui veulent une gestion claire, en français et en arabe, sans logiciel de comptabilité lourd. L'équipe est joignable à Tanger, à bonjour@fatorati.tech.",
    },
    benefits: {
      eyebrow: "Avantages",
      title: "Pourquoi une TPE gagnerait-elle à centraliser ses échéances ?",
      lead: "Le gain concret est de voir clients, dépenses, contrats et dates au même endroit, avant qu'une pénalité ou un renouvellement oublié ne coûte plus cher que l'outil. Fatorati est mobile-first : la même vue sert au bureau et sur le terrain.",
    },
    pricing: {
      eyebrow: "Tarifs",
      title: "Combien coûte Fatorati ?",
      lead: "Essentiel est à 0 MAD pour commencer, sans carte bancaire. Pro est à 199 MAD par mois et Équipe à 499 MAD par mois. Les prix sont en dirhams, publiés sur cette page, et la formule se change ou s'arrête sans engagement caché.",
    },
    blog: {
      eyebrow: "Ressources",
      title: "Où trouver les guides de gestion pour une TPE au Maroc ?",
      lead: "Le journal Fatorati répond à des questions pratiques : échéances à ne pas manquer, points à vérifier avant de signer, et lecture du budget outils. Chaque note est datée. Les règles chiffrées renvoient à la DGI ou à la CNDP, pas à un exemple.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Fatorati, c'est quoi ?",
      lead: "Fatorati est l'application de gestion mobile des artisans, freelances et TPE au Maroc : échéances, contrats, abonnements et alertes, en français, anglais et arabe. Ce n'est pas un logiciel de comptabilité certifié et ce n'est pas un conseil.",
    },
    contact: {
      eyebrow: "Contact",
      title: "Comment contacter l'équipe Fatorati ?",
      lead: "Écrivez à bonjour@fatorati.tech pour une question sur les tarifs, la mise en route ou la conformité. L'équipe est à Tanger, au Maroc. La page À propos décrit le produit ; cette page sert à écrire.",
    },
    privacy: {
      eyebrow: "Confidentialité",
      title: "Quelles données Fatorati traite-t-il, et pourquoi ?",
      lead: "Fatorati collecte le compte et les données professionnelles que vous saisissez pour fournir l'espace de gestion. Il ne les vend pas et n'en fait pas de la publicité. Le cadre est la loi 09-08, sous le contrôle de la CNDP. Le détail est sur cette page.",
    },
    terms: {
      eyebrow: "Conditions",
      title: "À quelles conditions utilise-t-on Fatorati ?",
      lead: "Vous utilisez le service de façon licite, gardez vos identifiants secrets, et restez responsable des déclarations fiscales. Fatorati peut faire évoluer les fonctions. Le droit marocain s'applique. Le texte complet est ci-dessous.",
    },
    cookies: {
      eyebrow: "Cookies",
      title: "Quels cookies Fatorati dépose-t-il ?",
      lead: "Les cookies nécessaires mémorisent la langue, le thème et le choix du bandeau. Google Analytics ne se charge que si vous acceptez la mesure d'audience. Il n'y a pas de cookie publicitaire. Vous pouvez refuser sans perdre le site.",
    },
  },
  en: {
    features: {
      eyebrow: "Features",
      title: "What does Fatorati put in one app for a Moroccan small business?",
      lead: "Fatorati combines the deadline calendar, compliance alerts and tool-cost tracking in one mobile application. A small firm sees DGI dates, contracts and subscriptions without opening three products.",
    },
    assistant: {
      eyebrow: "Assistant",
      title: "Which Moroccan rules does the assistant surface?",
      lead: "The assistant offers contract templates and the lines that matter under Moroccan law: DOC article 723 for services, a confidentiality clause under Law 09-08, and an invoice with ICE and VAT. It cites the rule; it does not sign for you.",
    },
    about: {
      eyebrow: "About",
      title: "Who is Fatorati for?",
      lead: "Fatorati is built for artisans, freelancers and small businesses in Morocco who want clear management, in French and Arabic, without a heavy accounting suite. The team can be reached in Tangier at bonjour@fatorati.tech.",
    },
    benefits: {
      eyebrow: "Benefits",
      title: "Why keep deadlines in one place?",
      lead: "The practical gain is seeing clients, spending, contracts and dates together, before a missed renewal or a late filing costs more than the tool. Fatorati is mobile-first: the same view works in the office and on site.",
    },
    pricing: {
      eyebrow: "Pricing",
      title: "How much does Fatorati cost?",
      lead: "Essential is MAD 0 to start, with no card. Pro is MAD 199 per month and Team is MAD 499 per month. Prices are in dirhams, published on this page, and the plan can be changed or stopped with no hidden term.",
    },
    blog: {
      eyebrow: "Resources",
      title: "Where are the management guides for a Moroccan small business?",
      lead: "The Fatorati journal answers practical questions: deadlines worth not missing, what to check before signing, and how to read a tools budget. Each note is dated. Figures point to the DGI or the CNDP, not to a sample.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "What is Fatorati?",
      lead: "Fatorati is the mobile management app for artisans, freelancers and small businesses in Morocco: deadlines, contracts, subscriptions and alerts, in French, English and Arabic. It is not certified accounting software and it is not advice.",
    },
    contact: {
      eyebrow: "Contact",
      title: "How do you contact the Fatorati team?",
      lead: "Write to bonjour@fatorati.tech about pricing, rollout or compliance. The team is in Tangier, Morocco. The About page describes the product; this page is for writing to us.",
    },
    privacy: {
      eyebrow: "Privacy",
      title: "What data does Fatorati process, and why?",
      lead: "Fatorati collects the account and the business data you enter in order to provide the workspace. It does not sell that data or use it for advertising. The frame is Law 09-08, overseen by the CNDP. The detail is on this page.",
    },
    terms: {
      eyebrow: "Terms",
      title: "On what terms do you use Fatorati?",
      lead: "You use the service lawfully, keep your credentials secret, and remain responsible for tax filings. Features may change. Moroccan law applies. The full text is below.",
    },
    cookies: {
      eyebrow: "Cookies",
      title: "Which cookies does Fatorati set?",
      lead: "Necessary cookies remember language, theme and the banner choice. Google Analytics loads only if you accept audience measurement. There is no advertising cookie. You can refuse and still use the site.",
    },
  },
  ar: {
    features: {
      eyebrow: "الميزات",
      title: "ماذا تجمع فاتورتي لمقاولة مغربية صغيرة؟",
      lead: "تجمع فاتورتي في تطبيق واحد تقويم المواعيد وتنبيهات الامتثال ومتابعة تكلفة الأدوات. ترى المقاولة الصغيرة مواعيد المديرية العامة للضرائب وعقودها واشتراكاتها دون فتح ثلاثة برامج.",
    },
    assistant: {
      eyebrow: "المساعد",
      title: "أي قواعد مغربية يذكّر بها المساعد؟",
      lead: "يقترح المساعد نماذج عقود والبيانات المفيدة في القانون المغربي: الفصل 723 من قانون الالتزامات والعقود للخدمة، وبند السرية بموجب القانون 09-08، وفاتورة بالتعريف الموحد والضريبة. يستشهد بالقاعدة ولا يوقّع نيابة عنك.",
    },
    about: {
      eyebrow: "عن فاتورتي",
      title: "من هي فاتورتي، ولمن؟",
      lead: "صُممت فاتورتي للحرفيين والمستقلين والمقاولات الصغيرة في المغرب الذين يريدون إدارة واضحة بالفرنسية والعربية، دون برنامج محاسبة ثقيل. يمكن مراسلة الفريق في طنجة على bonjour@fatorati.tech.",
    },
    benefits: {
      eyebrow: "المزايا",
      title: "لماذا يجدر بمقاولة صغيرة أن تجمع مواعيدها في مكان واحد؟",
      lead: "الفائدة العملية هي رؤية الزبائن والمصاريف والعقود والمواعيد معاً، قبل أن يكلف تجديد منسي أو إيداع متأخر أكثر من الأداة نفسها. فاتورتي مصممة للهاتف: العرض نفسه يصلح في المكتب والميدان.",
    },
    pricing: {
      eyebrow: "الأسعار",
      title: "بكم تكلف فاتورتي؟",
      lead: "الأساسي بـ 0 درهم للبدء، دون بطاقة بنكية. برو بـ 199 درهماً في الشهر والفريق بـ 499 درهماً في الشهر. الأسعار بالدرهم، منشورة في هذه الصفحة، ويمكن تغيير الخطة أو إيقافها دون التزام خفي.",
    },
    blog: {
      eyebrow: "الموارد",
      title: "أين تجد أدلة الإدارة لمقاولة صغيرة في المغرب؟",
      lead: "تجيب مجلة فاتورتي عن أسئلة عملية: مواعيد لا تُفوَّت، وما يُراجع قبل التوقيع، وقراءة ميزانية الأدوات. كل ملاحظة مؤرخة. الأرقام تحيل إلى المديرية العامة للضرائب أو إلى اللجنة، لا إلى مثال.",
    },
    faq: {
      eyebrow: "الأسئلة",
      title: "ما هي فاتورتي؟",
      lead: "فاتورتي تطبيق الإدارة على الهاتف للحرفيين والمستقلين والمقاولات الصغيرة في المغرب: المواعيد والعقود والاشتراكات والتنبيهات، بالفرنسية والإنجليزية والعربية. ليس برنامج محاسبة معتمداً وليس استشارة.",
    },
    contact: {
      eyebrow: "تواصل معنا",
      title: "كيف تتواصل مع فريق فاتورتي؟",
      lead: "اكتب إلى bonjour@fatorati.tech لسؤال عن الأسعار أو الانطلاق أو الامتثال. الفريق في طنجة، المغرب. صفحة «عن فاتورتي» تصف المنتج؛ هذه الصفحة للكتابة إلينا.",
    },
    privacy: {
      eyebrow: "الخصوصية",
      title: "ما البيانات التي تعالجها فاتورتي، ولماذا؟",
      lead: "تجمع فاتورتي الحساب والبيانات المهنية التي تُدخلها لتوفير مساحة الإدارة. لا تبيعها ولا تستخدمها للإعلان. الإطار هو القانون 09-08 تحت مراقبة اللجنة الوطنية. التفصيل في هذه الصفحة.",
    },
    terms: {
      eyebrow: "الشروط",
      title: "بأي شروط تُستخدم فاتورتي؟",
      lead: "تستخدم الخدمة بشكل قانوني، وتحافظ على سرية بيانات الدخول، وتبقى مسؤولاً عن الإقرارات الجبائية. قد تتطور الوظائف. يسري القانون المغربي. النص الكامل أدناه.",
    },
    cookies: {
      eyebrow: "ملفات الارتباط",
      title: "أي ملفات ارتباط تضع فاتورتي؟",
      lead: "الملفات الضرورية تحفظ اللغة والمظهر واختيار الشريط. لا يُحمَّل Google Analytics إلا إذا قبلت قياس الجمهور. لا يوجد ملف إعلاني. يمكنك الرفض مع الإبقاء على استخدام الموقع.",
    },
  },
}

export function pageLead(lang: RefLang, page: string): PageLead | null {
  return LEADS[lang][page] ?? null
}

/** Questions rendered in the reference block — the FAQPage schema must use these strings. */
export function referenceFaq(lang: RefLang): RefQa[] {
  return REFERENCE[lang].sections.map((section) => ({ q: section.q, a: section.a }))
}

export function referenceHowTo(lang: RefLang): { name: string; description: string; steps: RefStep[] } {
  const copy = REFERENCE[lang]
  return { name: copy.howtoTitle, description: copy.howtoIntro, steps: copy.steps }
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http")
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  )
}

export function InlineCitation({ lang, className = "" }: { lang: RefLang; className?: string }) {
  const copy = REFERENCE[lang]
  return (
    <p className={className}>
      {copy.inlineBefore} <strong>{copy.vatLabel}</strong>{" "}
      (<ExternalLink href={SOURCES.tva.url}><cite>{copy.dgiLabel}</cite></ExternalLink>). {copy.inlineAfter}{" "}
      <q>{copy.penaltyLabel}</q>{" "}
      (<ExternalLink href={SOURCES.cgi.url}><cite>{copy.cgiLabel}</cite></ExternalLink>).
    </p>
  )
}

/** Official quotation in the first screen, so a crawler that only reads the top still finds a citation. */
export function HeroQuote({ lang, className = "" }: { lang: RefLang; className?: string }) {
  const section = REFERENCE[lang].sections[0]
  if (!section?.quote) return null
  return (
    <blockquote cite={section.quoteCite} className={`landing-quote mx-auto max-w-xl text-start ${className}`}>
      <p><q>{section.quote}</q></p>
      <footer>
        — <cite><ExternalLink href={section.quoteUrl ?? section.quoteCite ?? SOURCES.dgi.url}>{section.quoteSource}</ExternalLink></cite>
      </footer>
    </blockquote>
  )
}

export function PageIntro({ lang, page }: { lang: RefLang; page: string }) {
  const to = useLocaleHref()
  const copy = REFERENCE[lang]
  const lead = pageLead(lang, page)
  if (!lead) return null
  return (
    <header className="mx-auto max-w-3xl px-5 pt-12 sm:px-8">
      <nav aria-label={copy.breadcrumb} className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--l-faint)]">
        <a href={to("/")} onClick={onInternalLinkClick} className="font-semibold text-[var(--l-muted)] hover:text-[var(--l-heading)]">{copy.home}</a>
        <span aria-hidden="true">/</span>
        <span>{lead.eyebrow}</span>
      </nav>
      <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-400">{lead.eyebrow}</p>
      <h1 className="font-display mt-3 text-[32px] font-bold leading-tight text-[var(--l-heading)] sm:text-[40px]">{lead.title}</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-[var(--l-text)]">{lead.lead}</p>
      <InlineCitation lang={lang} className="mt-4 text-[14.5px] leading-relaxed text-[var(--l-muted)]" />
      <p className="mt-3 text-[12.5px] text-[var(--l-faint)]">
        {copy.updated} <time dateTime={CONTENT_UPDATED}>{UPDATED_LABEL[lang]}</time>
        {" · "}
        <a href={to("about")} onClick={onInternalLinkClick} className="font-semibold text-[var(--l-muted)] hover:text-[var(--l-heading)]">{copy.by}</a>
      </p>
    </header>
  )
}

export function ReferenceSection({ lang }: { lang: RefLang }) {
  const to = useLocaleHref()
  const copy = REFERENCE[lang]
  return (
    <section id="reperes" aria-labelledby="reperes-title" className="landing-sources mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-400">{copy.eyebrow}</p>
      <h2 id="reperes-title" className="font-display mt-3 text-[28px] font-bold leading-tight text-[var(--l-heading)] sm:text-[34px]">{copy.title}</h2>
      <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--l-text)]">{copy.intro}</p>
      <p className="mt-3 text-[12.5px] text-[var(--l-faint)]">
        {copy.updated} <time dateTime={CONTENT_UPDATED}>{UPDATED_LABEL[lang]}</time>
        {" · "}
        <a href={to("about")} onClick={onInternalLinkClick} className="font-semibold hover:text-[var(--l-heading)]">{copy.by}</a>
        {" · "}
        <a href={to("contact")} onClick={onInternalLinkClick} className="font-semibold hover:text-[var(--l-heading)]">{lang === "fr" ? "Contact" : lang === "en" ? "Contact" : "تواصل معنا"}</a>
        {" · "}
        <ExternalLink href={GITHUB_URL}><cite>GitHub</cite></ExternalLink>
      </p>

      {copy.sections.map((section) => (
        <section key={section.q} className="mt-10">
          <h2 className="font-display text-[22px] font-bold leading-snug text-[var(--l-heading)]">{section.q}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--l-text)]">{section.a}</p>
          {section.quote && (
            <blockquote cite={section.quoteCite} className="landing-quote">
              <p><q>{section.quote}</q></p>
              <footer>
                — <cite><ExternalLink href={section.quoteUrl ?? section.quoteCite ?? SOURCES.dgi.url}>{section.quoteSource}</ExternalLink></cite>
              </footer>
            </blockquote>
          )}
        </section>
      ))}

      <section className="mt-10" id="methode">
        <h2 className="font-display text-[22px] font-bold leading-snug text-[var(--l-heading)]">{copy.howtoTitle}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--l-text)]">{copy.howtoIntro}</p>
        <ol className="mt-4 list-decimal space-y-3 ps-5 text-[15px] leading-relaxed text-[var(--l-text)]">
          {copy.steps.map((step) => (
            <li key={step.name}><strong className="text-[var(--l-heading)]">{step.name}.</strong> {step.text}</li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[22px] font-bold leading-snug text-[var(--l-heading)]">{copy.priceTitle}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--l-text)]">{copy.priceBody}</p>
      </section>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-[var(--l-border)]">
        <table>
          <caption className="px-4 py-3 text-start text-[13px] font-semibold text-[var(--l-heading)]">{copy.tableCaption}</caption>
          <thead>
            <tr>
              {copy.cols.map((col) => <th key={col} scope="col">{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {copy.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.value}</td>
                <td><ExternalLink href={row.url}><cite>{row.source}</cite></ExternalLink></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-[22px] font-bold text-[var(--l-heading)]">{copy.sourcesTitle}</h2>
        <ul className="mt-4 space-y-2 text-[14.5px] leading-relaxed">
          <li><ExternalLink href={SOURCES.tva.url}><cite>{SOURCES.tva.name}</cite></ExternalLink> — {copy.vatLabel}.</li>
          <li><ExternalLink href={SOURCES.cgi.url}><cite>{SOURCES.cgi.name}</cite></ExternalLink> — {copy.penaltyLabel}.</li>
          <li><ExternalLink href={SOURCES.cndp.url}><cite>{SOURCES.cndp.name}</cite></ExternalLink></li>
          <li><ExternalLink href={SOURCES.dgi.url}><cite>{SOURCES.dgi.name}</cite></ExternalLink></li>
          <li><ExternalLink href={GITHUB_URL}><cite>GitHub — FatooraLaw</cite></ExternalLink></li>
        </ul>
        <p className="mt-4 text-[13px] leading-relaxed text-[var(--l-faint)]">{copy.notAdvice}</p>
      </section>
    </section>
  )
}
