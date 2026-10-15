import type { Language } from "../lib/language/store.ts"

/**
 * Reports and fiscal summary.
 *
 * Several labels deliberately explain what a figure is *not*: project budgets
 * are not invoiced revenue, recorded collections are not dated cash flow, and
 * the configured VAT rate is not enough to calculate a tax return. Those limits
 * are product facts, so they stay next to the figures in all three languages.
 */
const en = {
  subtitle: "Summary of recorded local data · no simulated calculations",
  period: "Expense period",
  months: (count: number) => `Last ${count} months`,
  exportExpenses: "Export expenses",
  exportError: "Export failed. Please try again.",
  pdf: "PDF",
  emptyTitle: "No financial data recorded",
  emptyBody: "Add your own projects, clients and expenses. No revenue, tax or bank balance is invented to fill this report.",
  hiddenSamples: (count: number) => `${count} preloaded example${count === 1 ? "" : "s"} excluded from this view. Saved data remains in your modules and backups.`,
  invalidRecords: (count: number) => `${count} invalid entr${count === 1 ? "y" : "ies"} not represented. Check the recorded amounts and dates.`,
  allPeriods: "All periods",
  summaries: {
    budget: { label: "Project budgets", source: "Budgets entered, not invoiced revenue" },
    collected: { label: "Collections entered", source: "Cumulative amounts entered on projects, without dated payment history" },
    expenses: { label: "Approved expenses", source: "Recorded and approved amounts, not proof of bank payment" },
    receivables: { label: "Client balances to collect", source: "Positive balances recorded on client records" },
  },
  clientsMap: {
    title: "Clients by city — Morocco",
    subtitle: "Every client a point on the map: where they are, and what they have paid.",
    byClients: "By clients",
    bySpent: "By collected",
    topCities: "Top cities",
    otherPlaces: "Other places",
    bestIn: (city: string) => `Best clients in ${city}`,
    clients: (n: number) => `${n} client${n === 1 ? "" : "s"}`,
    schematic: "Schematic map — simplified outline, true relative positions.",
    noClients: "No clients with a city yet. Add clients and give them their city to light up the map.",
  },
  tax: {
    title: "VAT not calculated",
    body: "A configured rate is not enough to calculate a tax return. Sales and purchase invoices, net/gross bases, exempt transactions, and collected/deductible VAT amounts are not recorded in a tax ledger here.",
    limits: "No net profit, monthly revenue, bank balance or 30-day forecast is estimated. This summary is not a profit-and-loss statement or a tax return.",
  },
  monthly: {
    title: "Approved monthly expenses",
    series: "Approved expenses",
    note: (currency: string) => `Recorded dates and amounts · excluding pending expenses and future dates · ${currency}`,
    empty: "No dated approved expense in this period.",
  },
  totals: "Recorded totals (all periods)",
  table: {
    line: "Item",
    source: "Amount source",
    amount: "Amount",
  },
  exportColumns: {
    month: "Month",
    expenses: "Approved expenses",
    count: "Number of entries",
  },
}

type ReportsCopy = typeof en

const fr: ReportsCopy = {
  subtitle: "Récapitulatif des données locales enregistrées · sans calculs simulés",
  period: "Période des dépenses",
  months: (count: number) => `${count} derniers mois`,
  exportExpenses: "Exporter les dépenses",
  exportError: "Échec de l'export. Veuillez réessayer.",
  pdf: "PDF",
  emptyTitle: "Aucune donnée financière enregistrée",
  emptyBody: "Ajoutez vos propres projets, clients et dépenses. Aucun revenu, impôt ou solde bancaire n'est inventé pour remplir ce rapport.",
  hiddenSamples: (count: number) => `${count} exemple${count === 1 ? "" : "s"} préchargé${count === 1 ? "" : "s"} exclu${count === 1 ? "" : "s"} de cette vue. Les données enregistrées sont conservées dans les modules et sauvegardes.`,
  invalidRecords: (count: number) => `${count} entrée${count === 1 ? "" : "s"} invalide${count === 1 ? "" : "s"} non représentée${count === 1 ? "" : "s"}. Vérifiez les montants et dates enregistrés.`,
  allPeriods: "Toutes périodes",
  summaries: {
    budget: { label: "Budgets des projets", source: "Budgets saisis, pas un chiffre d'affaires facturé" },
    collected: { label: "Encaissements saisis", source: "Cumuls saisis dans les projets, sans historique des dates de paiement" },
    expenses: { label: "Dépenses approuvées", source: "Montants enregistrés et approuvés, pas une preuve de paiement bancaire" },
    receivables: { label: "Soldes clients à recouvrer", source: "Soldes positifs enregistrés dans les fiches clients" },
  },
  clientsMap: {
    title: "Clients par ville — Maroc",
    subtitle: "Chaque client un point sur la carte : où il est, et ce qu'il a encaissé.",
    byClients: "Par clients",
    bySpent: "Par encaissé",
    topCities: "Villes principales",
    otherPlaces: "Autres lieux",
    bestIn: (city: string) => `Meilleurs clients à ${city}`,
    clients: (n: number) => `${n} client${n === 1 ? "" : "s"}`,
    schematic: "Carte schématique — contour simplifié, positions relatives exactes.",
    noClients: "Aucun client avec une ville pour le moment. Ajoutez des clients et leur ville pour allumer la carte.",
  },
  tax: {
    title: "TVA non calculée",
    body: "Le taux configuré ne suffit pas à calculer une déclaration. Les factures de vente et d'achat, bases HT/TTC, opérations exonérées et montants de TVA collectée/déductible ne sont pas enregistrés dans un grand livre fiscal ici.",
    limits: "Aucun résultat net, revenu mensuel, solde bancaire ou prévision à 30 jours n'est estimé. Ce récapitulatif ne constitue pas un compte de résultat ni une déclaration fiscale.",
  },
  monthly: {
    title: "Dépenses mensuelles approuvées",
    series: "Dépenses approuvées",
    note: (currency: string) => `Dates et montants enregistrés · hors dépenses en attente et dates futures · ${currency}`,
    empty: "Aucune dépense approuvée datée dans cette période.",
  },
  totals: "Totaux enregistrés (toutes périodes)",
  table: {
    line: "Poste",
    source: "Source du montant",
    amount: "Montant",
  },
  exportColumns: {
    month: "Mois",
    expenses: "Dépenses approuvées",
    count: "Nombre d'entrées",
  },
}

const ar: ReportsCopy = {
  subtitle: "ملخص البيانات المحلية المسجلة · دون حسابات تجريبية",
  period: "فترة المصاريف",
  months: (count: number) => `آخر ${count} أشهر`,
  exportExpenses: "تصدير المصاريف",
  exportError: "تعذر التصدير. يرجى المحاولة مجدداً.",
  pdf: "PDF",
  emptyTitle: "لا توجد بيانات مالية مسجلة",
  emptyBody: "أضف مشاريعك وعملاءك ومصاريفك. لا يتم اختلاق إيرادات أو ضرائب أو أرصدة بنكية لملء هذا التقرير.",
  hiddenSamples: (count: number) => `تم استبعاد ${count} أمثلة محمّلة مسبقاً من هذه الواجهة. تبقى البيانات المسجلة في الأقسام والنسخ الاحتياطية.`,
  invalidRecords: (count: number) => `لم يتم عرض ${count} إدخالات غير صالحة. تحقق من المبالغ والتواريخ المسجلة.`,
  allPeriods: "جميع الفترات",
  summaries: {
    budget: { label: "ميزانيات المشاريع", source: "ميزانيات مدخلة وليست إيرادات مفوترة" },
    collected: { label: "المبالغ المحصلة المسجلة", source: "مبالغ تراكمية مدخلة في المشاريع دون سجل تواريخ الدفع" },
    expenses: { label: "المصاريف المعتمدة", source: "مبالغ مسجلة ومعتمدة وليست دليلاً على الدفع البنكي" },
    receivables: { label: "أرصدة العملاء المستحقة", source: "أرصدة موجبة مسجلة في ملفات العملاء" },
  },
  clientsMap: {
    title: "العملاء حسب المدينة — المغرب",
    subtitle: "كل عميل نقطة على الخريطة: أين يوجد، وكم دفع.",
    byClients: "حسب العملاء",
    bySpent: "حسب المُحصَّل",
    topCities: "أهم المدن",
    otherPlaces: "أماكن أخرى",
    bestIn: (city: string) => `أفضل العملاء في ${city}`,
    clients: (n: number) => `${n} ${n === 1 ? "عميل" : "عملاء"}`,
    schematic: "خريطة تخطيطية — حدود مبسطة ومواقع نسبية صحيحة.",
    noClients: "لا يوجد عملاء بمدينة بعد. أضف عملاء ومدنهم لتضيء الخريطة.",
  },
  tax: {
    title: "لم يتم احتساب الضريبة على القيمة المضافة",
    body: "لا يكفي تحديد نسبة لاحتساب إقرار ضريبي. لا تُسجل هنا فواتير البيع والشراء أو الأسس قبل/بعد الضريبة أو العمليات المعفاة أو مبالغ الضريبة المحصلة والقابلة للخصم ضمن دفتر ضريبي.",
    limits: "لا يتم تقدير صافي الربح أو الإيرادات الشهرية أو الرصيد البنكي أو توقعات الثلاثين يوماً. هذا الملخص ليس حساب أرباح وخسائر ولا إقراراً ضريبياً.",
  },
  monthly: {
    title: "المصاريف الشهرية المعتمدة",
    series: "المصاريف المعتمدة",
    note: (currency: string) => `تواريخ ومبالغ مسجلة · دون المصاريف المعلقة والتواريخ المستقبلية · ${currency}`,
    empty: "لا توجد مصاريف معتمدة ومؤرخة في هذه الفترة.",
  },
  totals: "الإجماليات المسجلة (جميع الفترات)",
  table: {
    line: "البند",
    source: "مصدر المبلغ",
    amount: "المبلغ",
  },
  exportColumns: {
    month: "الشهر",
    expenses: "المصاريف المعتمدة",
    count: "عدد الإدخالات",
  },
}

export const reports: Record<Language, ReportsCopy> = { ar, en, fr }
