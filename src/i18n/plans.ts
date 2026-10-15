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
    free: "Clients, projects and invoicing, with reports to read.",
    pro: "Everything except risks, the legal vault and subscriptions.",
    boost: "Everything there is, including risks, legal and subscriptions.",
  } as Record<PlanCode, string>,
  freePrice: "Free",
  perMonth: "/ month",
  perYear: "/ year",
  period: { "1M": "1 month", "1Y": "1 year" } as Record<PlanPeriod, string>,

  /** Status, wherever the account's own plan is shown. */
  statusTitle: "Your plan",
  active: (plan: string, date: string) => `${plan} is active until ${date}`,
  lastDay: (plan: string) => `${plan} ends today`,
  daysLeft: (days: number) => (days === 1 ? "1 day left" : `${days} days left`),
  expired: (plan: string, date: string) => `Your ${plan} ended on ${date}`,
  never: "No code activated yet — the account is on FREE.",
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
}

/** One copy shape for the three languages; a missing key is a compile error. */
type PlansCopy = typeof en

const fr: PlansCopy = {
  names: { free: "FREE", pro: "PRO", boost: "BOOST" },
  tagline: {
    free: "Clients, projets et facturation, avec les rapports en lecture.",
    pro: "Tout sauf les risques, le coffre juridique et les abonnements.",
    boost: "Tout, y compris les risques, le juridique et les abonnements.",
  },
  freePrice: "Gratuit",
  perMonth: "/ mois",
  perYear: "/ an",
  period: { "1M": "1 mois", "1Y": "1 an" },

  statusTitle: "Votre plan",
  active: (plan, date) => `${plan} est actif jusqu'au ${date}`,
  lastDay: (plan) => `${plan} se termine aujourd'hui`,
  daysLeft: (days) => (days === 1 ? "1 jour restant" : `${days} jours restants`),
  expired: (plan, date) => `Votre ${plan} a pris fin le ${date}`,
  never: "Aucun code activé — le compte est en FREE.",
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
}

const ar: PlansCopy = {
  names: { free: "FREE", pro: "PRO", boost: "BOOST" },
  tagline: {
    free: "العملاء والمشاريع والفواتير، مع قراءة التقارير.",
    pro: "كل شيء ما عدا المخاطر والخزنة القانونية والاشتراكات.",
    boost: "كل شيء، بما في ذلك المخاطر والقانوني والاشتراكات.",
  },
  freePrice: "مجاني",
  perMonth: "/ شهر",
  perYear: "/ سنة",
  period: { "1M": "شهر واحد", "1Y": "سنة واحدة" },

  statusTitle: "خطتك",
  active: (plan, date) => `${plan} نشطة حتى ${date}`,
  lastDay: (plan) => `${plan} تنتهي اليوم`,
  daysLeft: (days) => (days === 1 ? "يوم واحد متبقٍ" : `${days} يوماً متبقياً`),
  expired: (plan, date) => `انتهت ${plan} في ${date}`,
  never: "لم يتم تنشيط أي رمز — الحساب على FREE.",
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
}

export const plans = { ar, en, fr }
