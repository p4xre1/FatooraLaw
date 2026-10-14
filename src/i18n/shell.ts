import type { ModuleKey } from "../store/types.ts"
import type { Language } from "../lib/language/store.ts"

/**
 * Copy for the signed-in shell — currently the left-hand navigation rail.
 *
 * `ShellCopy` is an explicit contract rather than a `typeof en` inference: the
 * rail is the one screen whose shape is asserted by tests, so naming the type
 * keeps it reviewable, and `Record<Language, ShellCopy>` still makes a missing
 * key in any one language a compile error.
 *
 * `modules` is deliberately partial. French falls through to the labels in
 * `components/nav.tsx`, which `App.tsx` also derives the page title and the
 * first allowed module from, so restating them here would give the same string
 * two homes. English and Arabic supply every module.
 */

export type ShellCopy = {
  groups: { daily: string; management: string; more: string }
  modules: Partial<Record<ModuleKey, string>>
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
  localNotice: string
  exportBackup: string
  account: string
  language: string
  signOut: string
  openMenu: string
}

export const shell: Record<Language, ShellCopy> = {
  fr: {
    groups: { daily: "Au quotidien", management: "Gestion", more: "Plus d'outils" },
    // French labels already live in `NAV`; only the other locales override.
    modules: {},
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
    localNotice: "Données stockées sur cet appareil.",
    exportBackup: "Exporter une sauvegarde",
    account: "Menu du compte",
    language: "Langue",
    signOut: "Se déconnecter",
    openMenu: "Ouvrir",
  },
  en: {
    groups: { daily: "Day to day", management: "Management", more: "More tools" },
    modules: {
      dashboard: "Dashboard",
      projects: "Projects",
      contacts: "Clients & Suppliers",
      procurement: "Purchases & Expenses",
      inventory: "Stock & Equipment",
      calendar: "Calendar",
      risk: "Risk Management",
      tools: "Subscriptions & Tools",
      legal: "Legal Vault",
      reports: "Reports & Tax",
      team: "Team & Roles",
      audit: "Audit Log",
      settings: "Settings",
    },
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
    localNotice: "Data is stored on this device.",
    exportBackup: "Export a backup",
    account: "Account menu",
    language: "Language",
    signOut: "Sign out",
    openMenu: "Open",
  },
  ar: {
    groups: { daily: "يومياً", management: "التدبير", more: "أدوات أخرى" },
    modules: {
      dashboard: "لوحة التحكم",
      projects: "المشاريع",
      contacts: "العملاء والموردون",
      procurement: "المشتريات والمصاريف",
      inventory: "المخزون والمعدات",
      calendar: "التقويم",
      risk: "إدارة المخاطر",
      tools: "الاشتراكات والأدوات",
      legal: "الخزنة القانونية",
      reports: "التقارير والضرائب",
      team: "الفريق والأدوار",
      audit: "سجل التدقيق",
      settings: "الإعدادات",
    },
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
    localNotice: "البيانات محفوظة على هذا الجهاز.",
    exportBackup: "تصدير نسخة احتياطية",
    account: "قائمة الحساب",
    language: "اللغة",
    signOut: "تسجيل الخروج",
    openMenu: "فتح",
  },
}
