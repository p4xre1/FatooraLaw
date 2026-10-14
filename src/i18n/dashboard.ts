import { MONTHS, MONTHS_AR, MONTHS_EN } from "../lib/analytics.ts"
import type { Language } from "../lib/language/store.ts"

/**
 * The dashboard's copy.
 *
 * This section started life as a private `dict` inside `modules/Dashboard.tsx`,
 * paired with its own `mizan.dashboard.lang` key and its own FR/AR button — so
 * the dashboard and the navigation rail could disagree about the language, and
 * the dashboard had no English at all. Both now read the app-wide preference.
 *
 * Two fields carry data rather than sentences, and both exist because the
 * figures on this screen are derived from recorded rows whose labels are stored
 * in French:
 *   - `months` feeds the chart axis through `dashboardData()`;
 *   - `categories` translates a stored expense category, falling back to the
 *     stored label when it is a category the user created. French maps nothing
 *     because French *is* the stored label.
 *
 * `en` is written first and the others are declared `typeof en`, so a key added
 * to one language and forgotten in another is a compile error.
 */
const en = {
  title: "Dashboard", subtitle: "Recorded local data · no simulated figures",
  range: (n: number) => `Last ${n} months`, period: "Expense period", widgets: "Widgets", show: "Show",
  flow: "Monthly expenses", projects: "Budgets and collections", breakdown: "Breakdown",
  quickProject: "Create a project", quickExpense: "Record an expense", quickContract: "Generate a contract",
  cardBudget: "Project budgets", cardCollected: "Collections entered", cardExpenses: "Approved expenses", cardReceivables: "Client balances to collect",
  allDates: "All periods", projectCount: (n: number) => `${n} project${n === 1 ? "" : "s"}`, expenseCount: (n: number) => `${n} expense${n === 1 ? "" : "s"}`, clientCount: (n: number) => `${n} client${n === 1 ? "" : "s"}`,
  chartExpenses: "Approved monthly expenses", chartExpensesSub: "By recorded date · exact amounts · excluding pending expenses",
  seriesExpense: "Approved expenses", seriesBudget: "Budget entered", seriesCollected: "Collections entered",
  chartBreakdown: "Expense breakdown", chartBreakdownSub: "Approved expenses in the period, by category",
  chartProjects: "Budgets and collections by project", chartProjectsSub: "Cumulative amounts entered · up to 8 projects · all periods",
  emptyTitle: "No financial data recorded", emptyDescription: "Add your projects, your expenses or your clients. Totals and charts use only that data, with no preloaded examples.",
  emptyPeriod: "No dated approved expense in this period.", emptyCategory: "No positive amount to break down in this period.", emptyProjects: "Enter a project's budget or collections to show this chart.",
  cashNote: "Collections are the cumulative amounts entered on projects, not a bank balance. Without a dated payment history, no monthly revenue and no cash flow is estimated.",
  samples: (n: number) => `${n} preloaded example${n === 1 ? "" : "s"} excluded from this view. Recorded data is still kept in your modules and your backups.`,
  invalid: (n: number) => `${n} invalid ${n === 1 ? "entry" : "entries"} not represented. Check the amounts and dates in your records.`,
  recent: "Recent activity", viewLog: "View the log", emptyActivity: "No activity recorded.", critical: "Critical", warning: "Warning", info: "Info",
  exportMonth: "Month", exportExpense: "Approved expenses", exportCount: "Number of entries", exportError: "Export failed. Please try again.",
  months: MONTHS_EN,
  categories: { "Matériaux": "Materials", "Quincaillerie": "Hardware", "Location": "Rental", "Carburant": "Fuel", "Sans catégorie": "Uncategorised" } as Record<string, string>,
}

type DashboardCopy = typeof en

const fr: DashboardCopy = {
    title: "Tableau de bord", subtitle: "Données locales enregistrées · aucun chiffre simulé",
    range: (n: number) => `${n} derniers mois`, period: "Période des dépenses", widgets: "Widgets", show: "Afficher",
    flow: "Dépenses mensuelles", projects: "Budgets et encaissements", breakdown: "Répartition",
    quickProject: "Créer un projet", quickExpense: "Créer une dépense", quickContract: "Générer un contrat",
    cardBudget: "Budgets des projets", cardCollected: "Encaissements saisis", cardExpenses: "Dépenses approuvées", cardReceivables: "Soldes clients à recouvrer",
    allDates: "Toutes périodes", projectCount: (n: number) => `${n} projet${n === 1 ? "" : "s"}`, expenseCount: (n: number) => `${n} dépense${n === 1 ? "" : "s"}`, clientCount: (n: number) => `${n} client${n === 1 ? "" : "s"}`,
    chartExpenses: "Dépenses mensuelles approuvées", chartExpensesSub: "Selon la date enregistrée · montants exacts · hors dépenses en attente",
    seriesExpense: "Dépenses approuvées", seriesBudget: "Budget saisi", seriesCollected: "Encaissements saisis",
    chartBreakdown: "Répartition des dépenses", chartBreakdownSub: "Dépenses approuvées de la période, par catégorie",
    chartProjects: "Budgets et encaissements par projet", chartProjectsSub: "Montants cumulés saisis · jusqu'à 8 projets · toutes périodes",
    emptyTitle: "Aucune donnée financière enregistrée", emptyDescription: "Ajoutez vos projets, vos dépenses ou vos clients. Les totaux et graphiques utiliseront uniquement ces données, sans exemples préchargés.",
    emptyPeriod: "Aucune dépense approuvée datée dans cette période.", emptyCategory: "Aucun montant positif à répartir dans cette période.", emptyProjects: "Saisissez le budget ou les encaissements d'un projet pour afficher ce graphique.",
    cashNote: "Les encaissements sont les montants cumulés saisis dans les projets, pas un solde bancaire. Sans historique daté des paiements, aucun revenu mensuel ni flux de trésorerie n'est estimé.",
    samples: (n: number) => `${n} exemple${n === 1 ? "" : "s"} préchargé${n === 1 ? "" : "s"} exclu${n === 1 ? "" : "s"} de cette vue. Les données enregistrées restent conservées dans vos modules et sauvegardes.`,
    invalid: (n: number) => `${n} entrée${n === 1 ? "" : "s"} invalide${n === 1 ? "" : "s"} non représentée${n === 1 ? "" : "s"}. Vérifiez les montants et dates dans vos dossiers.`,
    recent: "Activité récente", viewLog: "Voir le journal", emptyActivity: "Aucune activité enregistrée.", critical: "Critique", warning: "Attention", info: "Info",
    exportMonth: "Mois", exportExpense: "Dépenses approuvées", exportCount: "Nombre d'entrées", exportError: "Échec de l'export. Veuillez réessayer.",
  months: MONTHS,
  categories: {} as Record<string, string>,
}

const ar: DashboardCopy = {
    title: "لوحة التحكم", subtitle: "بيانات محلية مسجلة · بدون أرقام تجريبية",
    range: (n: number) => `آخر ${n} أشهر`, period: "فترة المصاريف", widgets: "الأدوات", show: "إظهار",
    flow: "المصاريف الشهرية", projects: "الميزانيات والتحصيلات", breakdown: "التوزيع",
    quickProject: "إنشاء مشروع", quickExpense: "تسجيل مصروف", quickContract: "إنشاء عقد",
    cardBudget: "ميزانيات المشاريع", cardCollected: "التحصيلات المسجلة", cardExpenses: "المصاريف المعتمدة", cardReceivables: "أرصدة العملاء المستحقة",
    allDates: "جميع الفترات", projectCount: (n: number) => `${n} مشاريع`, expenseCount: (n: number) => `${n} مصاريف`, clientCount: (n: number) => `${n} عملاء`,
    chartExpenses: "المصاريف الشهرية المعتمدة", chartExpensesSub: "حسب التاريخ المسجل · مبالغ فعلية · بدون المصاريف المعلقة",
    seriesExpense: "المصاريف المعتمدة", seriesBudget: "الميزانية المسجلة", seriesCollected: "التحصيلات المسجلة",
    chartBreakdown: "توزيع المصاريف", chartBreakdownSub: "مصاريف الفترة المعتمدة حسب الفئة",
    chartProjects: "الميزانيات والتحصيلات حسب المشروع", chartProjectsSub: "مبالغ تراكمية مسجلة · حتى 8 مشاريع · جميع الفترات",
    emptyTitle: "لا توجد بيانات مالية مسجلة", emptyDescription: "أضف مشاريعك أو مصاريفك أو عملاءك. تستخدم المؤشرات والرسوم هذه البيانات فقط، بدون أمثلة مسبقة.",
    emptyPeriod: "لا توجد مصاريف معتمدة مؤرخة في هذه الفترة.", emptyCategory: "لا توجد مبالغ موجبة لتوزيعها في هذه الفترة.", emptyProjects: "سجل ميزانية أو تحصيلات مشروع لإظهار هذا الرسم.",
    cashNote: "التحصيلات مبالغ تراكمية مسجلة في المشاريع وليست رصيداً بنكياً. بدون سجل دفعات مؤرخ لا يتم تقدير إيرادات شهرية أو تدفقات خزينة.",
    samples: (n: number) => `تم استبعاد ${n} أمثلة مسبقة من هذه الواجهة فقط. تبقى البيانات محفوظة في الأقسام والنسخ الاحتياطية.`,
    invalid: (n: number) => `لم يتم عرض ${n} إدخالات غير صالحة. تحقق من المبالغ والتواريخ في سجلاتك.`,
    recent: "النشاط الأخير", viewLog: "عرض السجل", emptyActivity: "لا يوجد نشاط مسجل.", critical: "حرج", warning: "تنبيه", info: "معلومة",
    exportMonth: "الشهر", exportExpense: "المصاريف المعتمدة", exportCount: "عدد الإدخالات", exportError: "تعذر التصدير. يرجى المحاولة مرة أخرى.",
  months: MONTHS_AR,
  categories: { "Matériaux": "مواد البناء", "Quincaillerie": "أدوات ومعدات", "Location": "إيجار", "Carburant": "وقود", "Sans catégorie": "بدون فئة" } as Record<string, string>,
}

export const dashboard: Record<Language, DashboardCopy> = { ar, en, fr }
