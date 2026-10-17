import type { PlanCode, PlanPeriod } from "../lib/plans"

/**
 * The plan screens: the lock page, the dashboard strip and the activation card
 * in Paramètres. Written `en` first and declared `typeof en` below, so a key
 * that exists in one language and not another is a compile error (the same rule
 * as every other section — see `i18n/index.ts`).
 *
 * Module names inside the plan cards are **not** repeated here: they come from
 * `shared.modules`, the one place that names a module, so the card and the rail
 * always say the same word.
 */
const en = {
  /** The accounts. Same word in every language — they are product labels. */
  names: { free: "FREE", pro: "PRO", boost: "BOOST" } as Record<PlanCode, string>,
  tagline: {
    free: "Clients, projects, purchases & expenses and invoicing, with reports to read.",
    pro: "Everything except risks, the legal vault and subscriptions.",
    boost: "Everything there is, including risks, legal and subscriptions.",
  } as Record<PlanCode, string>,
  freePrice: "Free",
  perMonth: "/ month",
  perYear: "/ year",
  period: { "1M": "1 month", "1Y": "1 year" } as Record<PlanPeriod, string>,
  /** The value sentence on each card — what the plan is worth, not what it has. */
  value: {
    free: "Zero commitment: clients, projects, purchases, expenses and invoicing to start today — you pay only when you grow.",
    pro: "The full cockpit of a growing business: spending, stock, deadlines, team and reports in one place.",
    boost: "The firm-grade tier: risks, legal vault and subscriptions — the compliance that keeps penalties away.",
  } as Record<PlanCode, string>,
  cloudNote: "PRO & BOOST include 100 MB of cloud backup storage per account. Extra storage on request: $2 USD/GB/month, subject to availability.",
  scannerNote: "The Stock & Equipment barcode scanner is included in PRO and BOOST.",
  popular: "Most chosen",
  bestValue: "Best value",
  saveYear: (amount: string) => `Save ${amount} a year`,
  twoMonthsFree: "≈ 2 months free",
  /** The three promises printed under the cards — all of them kept by design. */
  trust: {
    immediate: "Immediate activation once your code arrives",
    noCard: "Bank transfer — no card required",
    support: "WhatsApp support, in French and Arabic",
  },

  /** Status, wherever the account's own plan is shown. */
  statusTitle: "Your plan",
  active: (plan: string, date: string) => `${plan} is active until ${date}`,
  lastDay: (plan: string) => `${plan} ends today`,
  daysLeft: (days: number) => (days === 1 ? "1 day left" : `${days} days left`),
  expired: (plan: string, date: string) => `Your ${plan} ended on ${date}`,
  never: "No code activated yet — the account is on FREE.",
  frozen: (plan: string, days: number) => `${plan} is frozen — ${days === 1 ? "1 day" : `${days} days`} waiting when it resumes.`,
  stopped: (plan: string) => `${plan} was stopped. Contact Fatorati on WhatsApp to restart it.`,
  lockedModules: (count: number) => (count === 1 ? "1 module is locked" : `${count} modules are locked`),
  lockedTitle: (plan: string) => `${plan} plan required`,
  lockedBody: (module: string, plan: string) => `“${module}” is part of the ${plan} plan.`,
  current: "Current plan",
  includes: "This plan includes",
  upgradeTo: (plan: string) => `Unlock ${plan}`,

  /** Buying: the code is sold over WhatsApp, paid by transfer. */
  buyTitle: "Buy an activation code",
  buy: (plan: string) => `Buy ${plan}`,
  buyHint: "Payment by bank transfer (RIB) on WhatsApp; we send your code right after.",
  buyOnWhatsApp: "Buy a code on WhatsApp",
  haveCode: "Already have a code? Enter it in Paramètres below.",

  /** Redemption, in Paramètres. */
  codeTitle: "Plan & activation",
  codeSubtitle: "Enter the code you received to unlock a plan.",
  codeLabel: "Code received on WhatsApp",
  codePlaceholder: "PRO-1M-A1B2C3D4",
  codeHelp: "Codes are not case-sensitive. The plan runs from the day you activate it.",
  activate: "Activate",
  activating: "Checking…",
  codeSuccess: (plan: string, date: string) => `${plan} activated until ${date}.`,
  codeExtended: (plan: string, date: string) => `${plan} extended until ${date}.`,
  codeFormat: "That does not look like a code. It should read PLAN-PERIOD-8 CHARACTERS, e.g. PRO-1M-A1B2C3D4.",
  codeWrong: "That code is not valid. Ask Fatorati for a new one on WhatsApp.",
  clearCode: "Remove the activation from this account",

  /** The module toolbar and the dashboard strip. */
  unlockToUse: (module: string, plan: string) => `${module} needs the ${plan} plan`,
  dashboardTitle: "Plan & modules",
  /** The × that hides a buy/upgrade message. */
  dismiss: "Hide this message",
}

/** One copy shape for the three languages; a missing key is a compile error. */
type PlansCopy = typeof en

const fr: PlansCopy = {
  names: { free: "FREE", pro: "PRO", boost: "BOOST" },
  tagline: {
    free: "Clients, projets, achats & dépenses et facturation, avec les rapports en lecture.",
    pro: "Tout sauf les risques, le coffre juridique et les abonnements.",
    boost: "Tout, y compris les risques, le juridique et les abonnements.",
  },
  freePrice: "Gratuit",
  perMonth: "/ mois",
  perYear: "/ an",
  period: { "1M": "1 mois", "1Y": "1 an" },
  value: {
    free: "Zéro engagement : clients, projets, achats, dépenses et facturation pour démarrer aujourd'hui — vous payez quand vous grandissez.",
    pro: "Le pilotage complet d'une activité qui grandit : dépenses, stock, échéances, équipe et rapports au même endroit.",
    boost: "Le niveau cabinet : risques, coffre juridique et abonnements — la conformité qui tient les pénalités à distance.",
  },
  cloudNote: "PRO et BOOST incluent 100 Mo de sauvegarde cloud par compte. Espace supplémentaire sur demande : 2 USD/Go/mois, selon disponibilité.",
  scannerNote: "Le scanner de codes-barres du Stock & Matériel est inclus dans PRO et BOOST.",
  popular: "Le plus choisi",
  bestValue: "Meilleure valeur",
  saveYear: (amount) => `Économisez ${amount} par an`,
  twoMonthsFree: "≈ 2 mois offerts",
  trust: {
    immediate: "Activation immédiate dès réception du code",
    noCard: "Paiement par virement — aucune carte requise",
    support: "Support WhatsApp, en français et en arabe",
  },

  statusTitle: "Votre plan",
  active: (plan, date) => `${plan} est actif jusqu'au ${date}`,
  lastDay: (plan) => `${plan} se termine aujourd'hui`,
  daysLeft: (days) => (days === 1 ? "1 jour restant" : `${days} jours restants`),
  expired: (plan, date) => `Votre ${plan} a pris fin le ${date}`,
  never: "Aucun code activé — le compte est en FREE.",
  frozen: (plan, days) => `${plan} est gelé — ${days === 1 ? "1 jour" : `${days} jours`} en attente à la reprise.`,
  stopped: (plan) => `${plan} a été arrêté. Contactez Fatorati sur WhatsApp pour le redémarrer.`,
  lockedModules: (count) => (count === 1 ? "1 module est verrouillé" : `${count} modules sont verrouillés`),
  lockedTitle: (plan) => `Plan ${plan} requis`,
  lockedBody: (module, plan) => `« ${module} » fait partie du plan ${plan}.`,
  current: "Plan actuel",
  includes: "Ce plan inclut",
  upgradeTo: (plan) => `Débloquer ${plan}`,

  buyTitle: "Acheter un code d'activation",
  buy: (plan) => `Acheter ${plan}`,
  buyHint: "Paiement par virement (RIB) sur WhatsApp ; nous envoyons le code juste après.",
  buyOnWhatsApp: "Acheter un code sur WhatsApp",
  haveCode: "Vous avez déjà un code ? Saisissez-le dans Paramètres, ci-dessous.",

  codeTitle: "Plan & activation",
  codeSubtitle: "Saisissez le code reçu pour débloquer un plan.",
  codeLabel: "Code reçu sur WhatsApp",
  codePlaceholder: "PRO-1M-A1B2C3D4",
  codeHelp: "Les codes ne sont pas sensibles à la casse. Le plan court à partir du jour de l'activation.",
  activate: "Activer",
  activating: "Vérification…",
  codeSuccess: (plan, date) => `${plan} activé jusqu'au ${date}.`,
  codeExtended: (plan, date) => `${plan} prolongé jusqu'au ${date}.`,
  codeFormat: "Ce n'est pas un code valide. Format attendu : PLAN-PÉRIODE-8 CARACTÈRES, par ex. PRO-1M-A1B2C3D4.",
  codeWrong: "Ce code n'est pas valide. Demandez-en un nouveau à Fatorati sur WhatsApp.",
  clearCode: "Retirer l'activation de ce compte",

  unlockToUse: (module, plan) => `${module} nécessite le plan ${plan}`,
  dashboardTitle: "Plan & modules",
  /** The × that hides a buy/upgrade message. */
  dismiss: "Masquer ce message",
}

const ar: PlansCopy = {
  names: { free: "FREE", pro: "PRO", boost: "BOOST" },
  tagline: {
    free: "العملاء والمشاريع والمشتريات والمصاريف والفواتير، مع قراءة التقارير.",
    pro: "كل شيء ما عدا المخاطر والخزنة القانونية والاشتراكات.",
    boost: "كل شيء، بما في ذلك المخاطر والقانوني والاشتراكات.",
  },
  freePrice: "مجاني",
  perMonth: "/ شهر",
  perYear: "/ سنة",
  period: { "1M": "شهر واحد", "1Y": "سنة واحدة" },
  value: {
    free: "دون أي التزام: العملاء والمشاريع والمشتريات والمصاريف والفواتير لتبدأ اليوم — تدفع فقط عندما يكبر نشاطك.",
    pro: "القيادة الكاملة لنشاط في نمو: المصاريف والمخزون والآجال والفريق والتقارير في مكان واحد.",
    boost: "مستوى المكاتب: المخاطر والخزنة القانونية والاشتراكات — الامتثال الذي يبعد عنك الغرامات.",
  },
  cloudNote: "PRO وBOOST يتضمنان 100 ميغابايت سحابية لكل حساب. مساحة إضافية عند الطلب: 2 دولار/غيغابايت/شهر حسب التوفر.",
  scannerNote: "ماسح الباركود للمخزون والمعدات مشمول في PRO وBOOST.",
  popular: "الأكثر اختياراً",
  bestValue: "أفضل قيمة",
  saveYear: (amount) => `وفّر ${amount} في السنة`,
  twoMonthsFree: "≈ شهران مجاناً",
  trust: {
    immediate: "تنشيط فوري فور وصول الرمز إليك",
    noCard: "الدفع بالتحويل البنكي — دون بطاقة",
    support: "دعم عبر واتساب، بالفرنسية والعربية",
  },

  statusTitle: "خطتك",
  active: (plan, date) => `${plan} نشطة حتى ${date}`,
  lastDay: (plan) => `${plan} تنتهي اليوم`,
  daysLeft: (days) => (days === 1 ? "يوم واحد متبقٍ" : `${days} يوماً متبقياً`),
  expired: (plan, date) => `انتهت ${plan} في ${date}`,
  never: "لم يتم تنشيط أي رمز — الحساب على FREE.",
  frozen: (plan, days) => `${plan} مجمّدة — ${days === 1 ? "يوم واحد" : `${days} يوماً`} في الانتظار عند الاستئناف.`,
  stopped: (plan) => `تم إيقاف ${plan}. تواصل مع فاتورتي على واتساب لإعادة تشغيلها.`,
  lockedModules: (count) => (count === 1 ? "وحدة واحدة مقفلة" : `${count} وحدات مقفلة`),
  lockedTitle: (plan) => `مطلوب خطة ${plan}`,
  lockedBody: (module, plan) => `«${module}» جزء من خطة ${plan}.`,
  current: "الخطة الحالية",
  includes: "تشمل هذه الخطة",
  upgradeTo: (plan) => `إلغاء قفل ${plan}`,

  buyTitle: "شراء رمز التنشيط",
  buy: (plan) => `اشترِ ${plan}`,
  buyHint: "الدفع بالتحويل البنكي (RIB) عبر واتساب، ونرسل لك الرمز مباشرة بعد ذلك.",
  buyOnWhatsApp: "اشترِ رمزاً على واتساب",
  haveCode: "لديك رمز بالفعل؟ أدخله في الإعدادات أدناه.",

  codeTitle: "الخطة والتنشيط",
  codeSubtitle: "أدخل الرمز الذي استلمته لإلغاء قفل خطة.",
  codeLabel: "الرمز المستلم على واتساب",
  codePlaceholder: "PRO-1M-A1B2C3D4",
  codeHelp: "الرموز غير حساسة لحالة الأحرف. تبدأ الخطة من يوم التنشيط.",
  activate: "تنشيط",
  activating: "جارٍ التحقق…",
  codeSuccess: (plan, date) => `تم تنشيط ${plan} حتى ${date}.`,
  codeExtended: (plan, date) => `تم تمديد ${plan} حتى ${date}.`,
  codeFormat: "هذا ليس رمزاً صحيحاً. الصيغة: الخطة-المدة-8 أحرف، مثال PRO-1M-A1B2C3D4.",
  codeWrong: "هذا الرمز غير صالح. اطلب رمزاً جديداً من فاتورتي على واتساب.",
  clearCode: "إزالة التنشيط من هذا الحساب",

  unlockToUse: (module, plan) => `${module} تحتاج خطة ${plan}`,
  dashboardTitle: "الخطة والوحدات",
  /** The × that hides a buy/upgrade message. */
  dismiss: "إخفاء هذه الرسالة",
}

export const plans = { ar, en, fr }
