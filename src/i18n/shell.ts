import type { Language } from "../lib/language/store.ts"

/**
 * Copy for the signed-in shell — currently the left-hand navigation rail.
 *
 * `ShellCopy` is an explicit contract rather than a `typeof en` inference: the
 * rail is the one screen whose shape is asserted by tests, so naming the type
 * keeps it reviewable, and `Record<Language, ShellCopy>` still makes a missing
 * key in any one language a compile error.
 *
 * Module *names* are not here: they live in `src/i18n/shared.ts`, because the
 * page title, the team permission grid and the audit log all need the same
 * thirteen names, and this rail must not be the only place that knows them.
 */

export type ShellCopy = {
  groups: { daily: string; management: string; more: string }
  invoices: string
  newInvoice: string
  quickActions: string
  newProject: string
  newExpense: string
  newContract: string
  search: string
  searchLabel: string
  navLabel: string
  noResults: string
  collapse: string
  expand: string
  account: string
  language: string
  signOut: string
  openMenu: string
}

export const shell: Record<Language, ShellCopy> = {
  fr: {
    groups: { daily: "Au quotidien", management: "Gestion", more: "Plus d'outils" },
    // French labels already live in `NAV`; only the other locales override.
    invoices: "Factures",
    newInvoice: "Nouvelle facture",
    quickActions: "Actions rapides",
    newProject: "Nouveau projet",
    newExpense: "Nouvelle dépense",
    newContract: "Générer un contrat",
    search: "Rechercher un module…",
    searchLabel: "Rechercher un module",
    navLabel: "Navigation principale",
    noResults: "Aucun module ne correspond.",
    collapse: "Réduire le menu",
    expand: "Déployer le menu",
    account: "Menu du compte",
    language: "Langue",
    signOut: "Se déconnecter",
    openMenu: "Ouvrir",
  },
  en: {
    groups: { daily: "Day to day", management: "Management", more: "More tools" },
    invoices: "Invoices",
    newInvoice: "New invoice",
    quickActions: "Quick actions",
    newProject: "New project",
    newExpense: "New expense",
    newContract: "Create a contract",
    search: "Search a module…",
    searchLabel: "Search a module",
    navLabel: "Main navigation",
    noResults: "No module matches.",
    collapse: "Collapse menu",
    expand: "Expand menu",
    account: "Account menu",
    language: "Language",
    signOut: "Sign out",
    openMenu: "Open",
  },
  ar: {
    groups: { daily: "يومياً", management: "التدبير", more: "أدوات أخرى" },
    invoices: "الفواتير",
    newInvoice: "فاتورة جديدة",
    quickActions: "إجراءات سريعة",
    newProject: "مشروع جديد",
    newExpense: "مصروف جديد",
    newContract: "إنشاء عقد",
    search: "ابحث عن وحدة…",
    searchLabel: "ابحث عن وحدة",
    navLabel: "التنقل الرئيسي",
    noResults: "لا توجد وحدة مطابقة.",
    collapse: "تصغير القائمة",
    expand: "توسيع القائمة",
    account: "قائمة الحساب",
    language: "اللغة",
    signOut: "تسجيل الخروج",
    openMenu: "فتح",
  },
}
