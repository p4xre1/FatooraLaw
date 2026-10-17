import type { Language } from "../lib/language/store.ts"
import type { RiskCategory, RiskLevel } from "../lib/riskAnalytics.ts"

type RiskCopy = {
  subtitle: string
  sourceNotice: string
  count: Record<RiskLevel, string>
  levels: Record<RiskLevel, string>
  filters: Record<RiskLevel | "all", string>
  searchPlaceholder: string
  searchLabel: string
  dateLabel: string
  empty: string
  categories: Record<RiskCategory, string>
  detail: {
    deadline: { overdue: string; today: string; upcoming: string; note: string }
    stock: string
    receivable: { pending: string; delivered: string }
    project: { overdue: string; today: string; upcoming: string }
    subscription: { expired: string; today: string; upcoming: string }
    verification: string
  }
}

const en: RiskCopy = {
  subtitle: "Operational alerts based only on records in your account",
  sourceNotice: "These reminders use your saved records and simple operational thresholds. They do not identify legal or tax obligations, calculate statutory deadlines, or assess compliance. Add official dates you want to track to your calendar.",
  count: { high: "Urgent alerts", medium: "Needs attention" },
  levels: { high: "Urgent", medium: "Attention" },
  filters: { all: "All", high: "Urgent", medium: "Attention" },
  searchPlaceholder: "Search your records…",
  searchLabel: "Search operational alerts",
  dateLabel: "Record date:",
  empty: "No operational alerts match your records and filters.",
  categories: {
    deadlines: "Calendar deadline",
    inventory: "Inventory",
    receivables: "Receivable",
    projects: "Project",
    subscriptions: "Subscription",
    verification: "Order verification",
  },
  detail: {
    deadline: { overdue: "Your calendar deadline passed {days} day(s) ago.", today: "Your calendar deadline is today.", upcoming: "Your calendar deadline is in {days} day(s).", note: "Note: {note}" },
    stock: "Stock: {quantity} {unit}; minimum threshold: {minimum} {unit}.",
    receivable: { pending: "{amount} remains unpaid on this verified order.", delivered: "{amount} remains unpaid on this delivered order." },
    project: { overdue: "The recorded project end date passed {days} day(s) ago.", today: "The recorded project end date is today.", upcoming: "The recorded project end date is in {days} day(s)." },
    subscription: { expired: "This recorded subscription expired {days} day(s) ago.", today: "This recorded subscription expires today.", upcoming: "This recorded subscription expires in {days} day(s)." },
    verification: "This order has been awaiting verification for {days} day(s).",
  },
}

const fr: RiskCopy = {
  subtitle: "Alertes opérationnelles fondées uniquement sur les dossiers de votre compte",
  sourceNotice: "Ces rappels utilisent vos dossiers enregistrés et des seuils opérationnels simples. Ils n'identifient aucune obligation juridique ou fiscale, ne calculent aucune échéance légale et n'évaluent pas la conformité. Ajoutez au calendrier les dates officielles que vous souhaitez suivre.",
  count: { high: "Alertes urgentes", medium: "À surveiller" },
  levels: { high: "Urgent", medium: "À surveiller" },
  filters: { all: "Tout", high: "Urgent", medium: "À surveiller" },
  searchPlaceholder: "Rechercher dans vos dossiers…",
  searchLabel: "Rechercher des alertes opérationnelles",
  dateLabel: "Date du dossier :",
  empty: "Aucune alerte opérationnelle ne correspond aux dossiers et filtres sélectionnés.",
  categories: {
    deadlines: "Échéance du calendrier",
    inventory: "Stock",
    receivables: "Créance client",
    projects: "Projet",
    subscriptions: "Abonnement",
    verification: "Vérification de commande",
  },
  detail: {
    deadline: { overdue: "Votre échéance du calendrier est passée depuis {days} jour(s).", today: "Votre échéance du calendrier est aujourd'hui.", upcoming: "Votre échéance du calendrier est dans {days} jour(s).", note: "Note : {note}" },
    stock: "Stock : {quantity} {unit} ; seuil minimum : {minimum} {unit}.",
    receivable: { pending: "Il reste {amount} à encaisser sur cette commande vérifiée.", delivered: "Il reste {amount} à encaisser sur cette commande livrée." },
    project: { overdue: "La date de fin enregistrée du projet est passée depuis {days} jour(s).", today: "La date de fin enregistrée du projet est aujourd'hui.", upcoming: "La date de fin enregistrée du projet est dans {days} jour(s)." },
    subscription: { expired: "Cet abonnement enregistré a expiré depuis {days} jour(s).", today: "Cet abonnement enregistré expire aujourd'hui.", upcoming: "Cet abonnement enregistré expire dans {days} jour(s)." },
    verification: "Cette commande attend une vérification depuis {days} jour(s).",
  },
}

const ar: RiskCopy = {
  subtitle: "تنبيهات تشغيلية تستند فقط إلى السجلات الموجودة في حسابك",
  sourceNotice: "تستخدم هذه التذكيرات سجلاتك المحفوظة وعتبات تشغيلية بسيطة. وهي لا تحدد الالتزامات القانونية أو الضريبية، ولا تحسب المواعيد القانونية، ولا تقيّم الامتثال. أضف إلى التقويم التواريخ الرسمية التي تريد متابعتها.",
  count: { high: "تنبيهات عاجلة", medium: "تحتاج إلى متابعة" },
  levels: { high: "عاجل", medium: "للمتابعة" },
  filters: { all: "الكل", high: "عاجل", medium: "للمتابعة" },
  searchPlaceholder: "ابحث في سجلاتك…",
  searchLabel: "البحث في التنبيهات التشغيلية",
  dateLabel: "تاريخ السجل:",
  empty: "لا توجد تنبيهات تشغيلية تطابق سجلاتك وعوامل التصفية.",
  categories: {
    deadlines: "موعد في التقويم",
    inventory: "المخزون",
    receivables: "مستحقات العميل",
    projects: "المشروع",
    subscriptions: "الاشتراك",
    verification: "التحقق من الطلب",
  },
  detail: {
    deadline: { overdue: "انقضى الموعد الذي أضفته إلى التقويم منذ {days} يومًا.", today: "الموعد الذي أضفته إلى التقويم هو اليوم.", upcoming: "الموعد الذي أضفته إلى التقويم بعد {days} يومًا.", note: "ملاحظة: {note}" },
    stock: "المخزون: {quantity} {unit}؛ الحد الأدنى: {minimum} {unit}.",
    receivable: { pending: "المبلغ المتبقي للتحصيل من هذا الطلب المؤكد هو {amount}.", delivered: "المبلغ المتبقي للتحصيل من هذا الطلب المسلّم هو {amount}." },
    project: { overdue: "انقضى تاريخ انتهاء المشروع المسجل منذ {days} يومًا.", today: "تاريخ انتهاء المشروع المسجل هو اليوم.", upcoming: "تاريخ انتهاء المشروع المسجل بعد {days} يومًا." },
    subscription: { expired: "انتهى الاشتراك المسجل منذ {days} يومًا.", today: "ينتهي الاشتراك المسجل اليوم.", upcoming: "ينتهي الاشتراك المسجل بعد {days} يومًا." },
    verification: "ينتظر هذا الطلب التحقق منذ {days} يومًا.",
  },
}

export const risk: Record<Language, RiskCopy> = { ar, en, fr }
