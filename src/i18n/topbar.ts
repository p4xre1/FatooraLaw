import type { Language } from "../lib/language/store.ts"

/** Translatable labels for the persistent application header and its popovers. */
const en = {
  quickActions: "Quick actions",
  newProject: "New project",
  newExpense: "New expense",
  generateContract: "Generate a contract",
  accountMenu: "Account menu",
  profileCompany: "Profile & company",
  signOut: "Sign out",
  localDev: "Local mode (dev)",
  openNavigation: "Open navigation",
}

type TopbarCopy = typeof en

const fr: TopbarCopy = {
  quickActions: "Actions rapides",
  newProject: "Nouveau projet",
  newExpense: "Nouvelle dépense",
  generateContract: "Générer un contrat",
  accountMenu: "Menu du compte",
  profileCompany: "Profil & entreprise",
  signOut: "Déconnexion",
  localDev: "Mode local (dev)",
  openNavigation: "Ouvrir la navigation",
}

const ar: TopbarCopy = {
  quickActions: "إجراءات سريعة",
  newProject: "مشروع جديد",
  newExpense: "مصروف جديد",
  generateContract: "إنشاء عقد",
  accountMenu: "قائمة الحساب",
  profileCompany: "الملف الشخصي والشركة",
  signOut: "تسجيل الخروج",
  localDev: "الوضع المحلي (تطوير)",
  openNavigation: "فتح قائمة التنقل",
}

export const topbar: Record<Language, TopbarCopy> = { ar, en, fr }
