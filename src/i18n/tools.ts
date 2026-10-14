import type { Language } from "../lib/language/store.ts"

/**
 * Subscriptions and tools.
 *
 * The screen's title is `shared.modules.tools`, not a key here: it is the same
 * string the rail, the page title and the team permission grid show, and a
 * second copy would eventually differ from them.
 *
 * The projected-cost chart carries an explicit disclaimer — these are the
 * theoretical amounts of the subscriptions covering each month, not a payment
 * history. That sentence is doing real work (it is the difference between an
 * estimate and a bank record) and is translated with the same care as the
 * numbers around it.
 */
const en = {
  subtitle: "Tracking recurring costs and expiry dates",
  addTool: "Add a tool",
  activeMonthlyCost: "Active monthly cost",
  activeMonthlyCostHint: "Excluding expired or upcoming subscriptions",
  activeTools: "Active tools",
  ofRecorded: (total: number) => `of ${total} recorded subscription${total === 1 ? "" : "s"}`,
  expiringSoon: "Expires within 30 days",
  renewSoon: "to renew soon",
  projectedTitle: "Projected monthly costs",
  lastSevenMonths: "Last 7 months",
  projectedNote:
    "Theoretical amounts of the subscriptions covering each month, without pro-rating. This chart is not a payment history.",
  projectedSeries: "Projected cost",
  table: {
    tool: "Tool",
    costPerMonth: "Cost / month",
    startDate: "Start date",
    expiry: "Expiry",
  },
  noExpiry: "No expiry",
  status: {
    expired: "Expired",
    scheduled: "Upcoming",
    unknown: "Dates to check",
    active: "Active",
    expiresIn: (days: number) => `Expires in ${days} d`,
  },
  removeAria: (name: string) => `Delete ${name}`,
  empty: "No subscriptions.",
  modalTitle: "Add a tool",
  toolName: "Tool name",
  toolNamePlaceholder: "e.g. Figma Organisation",
  monthlyCost: "Monthly cost (MAD)",
  addError: "Could not add the subscription.",
  dateOrderError: "The expiry cannot come before the start date.",
}

type ToolsCopy = typeof en

const fr: ToolsCopy = {
  subtitle: "Suivi des coûts récurrents et des dates d'expiration",
  addTool: "Ajouter un outil",
  activeMonthlyCost: "Coût mensuel actif",
  activeMonthlyCostHint: "Hors abonnements expirés ou à venir",
  activeTools: "Outils actifs",
  ofRecorded: (total: number) => `sur ${total} abonnements enregistrés`,
  expiringSoon: "Expire sous 30 jours",
  renewSoon: "à renouveler bientôt",
  projectedTitle: "Coûts mensuels prévus",
  lastSevenMonths: "7 derniers mois",
  projectedNote:
    "Montants théoriques des abonnements couvrant chaque mois, sans prorata. Ce graphique n'est pas un historique des paiements.",
  projectedSeries: "Coût prévu",
  table: {
    tool: "Outil",
    costPerMonth: "Coût / mois",
    startDate: "Date de début",
    expiry: "Expiration",
  },
  noExpiry: "Sans échéance",
  status: {
    expired: "Expiré",
    scheduled: "À venir",
    unknown: "Dates à vérifier",
    active: "Actif",
    expiresIn: (days: number) => `Expire dans ${days} j`,
  },
  removeAria: (name: string) => `Supprimer ${name}`,
  empty: "Aucun abonnement.",
  modalTitle: "Ajouter un outil",
  toolName: "Nom de l'outil",
  toolNamePlaceholder: "ex. Figma Organisation",
  monthlyCost: "Coût mensuel (MAD)",
  addError: "Impossible d'ajouter l'abonnement.",
  dateOrderError: "L'expiration ne peut pas précéder la date de début.",
}

const ar: ToolsCopy = {
  subtitle: "متابعة التكاليف الدورية وتواريخ الانتهاء",
  addTool: "إضافة أداة",
  activeMonthlyCost: "التكلفة الشهرية النشطة",
  activeMonthlyCostHint: "باستثناء الاشتراكات المنتهية أو القادمة",
  activeTools: "الأدوات النشطة",
  ofRecorded: (total: number) => `من ${total} اشتراكات مسجلة`,
  expiringSoon: "ينتهي خلال 30 يوماً",
  renewSoon: "يجب التجديد قريباً",
  projectedTitle: "التكاليف الشهرية المتوقعة",
  lastSevenMonths: "آخر 7 أشهر",
  projectedNote:
    "مبالغ تقديرية للاشتراكات التي تغطي كل شهر، بدون احتساب نسبي. هذا الرسم ليس سجلاً للمدفوعات.",
  projectedSeries: "التكلفة المتوقعة",
  table: {
    tool: "الأداة",
    costPerMonth: "التكلفة / شهر",
    startDate: "تاريخ البدء",
    expiry: "الانتهاء",
  },
  noExpiry: "بدون تاريخ انتهاء",
  status: {
    expired: "منتهي",
    scheduled: "قادم",
    unknown: "تواريخ تحتاج إلى تحقق",
    active: "نشط",
    expiresIn: (days: number) => `ينتهي خلال ${days} يوم`,
  },
  removeAria: (name: string) => `حذف ${name}`,
  empty: "لا توجد اشتراكات.",
  modalTitle: "إضافة أداة",
  toolName: "اسم الأداة",
  toolNamePlaceholder: "مثال: Figma Organisation",
  monthlyCost: "التكلفة الشهرية (MAD)",
  addError: "تعذرت إضافة الاشتراك.",
  dateOrderError: "لا يمكن أن يكون تاريخ الانتهاء قبل تاريخ البدء.",
}

export const tools: Record<Language, ToolsCopy> = { ar, en, fr }
