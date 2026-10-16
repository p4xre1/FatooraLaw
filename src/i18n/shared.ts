import type { ModuleKey, Role, Severity } from "../store/types.ts"
import type { Language } from "../lib/language/store.ts"

/**
 * Vocabulary every module needs and none of them owns: what a module is called,
 * what a role is called, what a severity is called.
 *
 * These were scattered before — module labels in `components/nav.tsx`, role
 * labels in `lib/mizan.ts`, severity labels re-declared in both
 * `modules/AuditLog.tsx` and the dashboard's dictionary — so translating one
 * screen left the others French and the same word could be spelled two ways.
 * One section, three languages, and `Record<ModuleKey, string>` means adding a
 * module to `store/types.ts` is a compile error here until it is named in all
 * three.
 */
const en = {
  modules: {
    dashboard: "Dashboard",
    invoices: "Invoices",
    projects: "Projects",
    contacts: "Clients & Suppliers",
    procurement: "Purchases & Expenses",
    inventory: "Stock & Equipment",
    delivery: "Delivery",
    verification: "Client Verification",
    calendar: "Calendar",
    risk: "Risk Management",
    tools: "Subscriptions & Tools",
    legal: "Legal Vault",
    reports: "Reports & Tax",
    team: "Team & Roles",
    audit: "Audit Log",
    settings: "Settings",
  } as Record<ModuleKey, string>,
  roles: {
    owner: "Owner",
    accountant: "Accountant",
    supervisor: "Supervisor",
    assistant: "Assistant",
  } as Record<Role, string>,
  severity: {
    info: "Info",
    warning: "Warning",
    critical: "Critical",
  } as Record<Severity, string>,
  /**
   * Sub-minute relative time. `Intl.RelativeTimeFormat` renders 0 minutes as
   * "cette minute-ci" / "this minute", which reads like a duration rather than
   * "just now", so that one case is a string instead.
   */
  justNow: "just now",
}

type SharedCopy = typeof en

const fr: SharedCopy = {
  modules: {
    dashboard: "Tableau de bord",
    invoices: "Factures",
    projects: "Projets",
    contacts: "Clients & Fournisseurs",
    procurement: "Achats & Dépenses",
    inventory: "Stock & Matériel",
    delivery: "Livraisons",
    verification: "Vérification clients",
    calendar: "Calendrier",
    risk: "Gestion des Risques",
    tools: "Abonnements & Outils",
    legal: "Coffre juridique",
    reports: "Rapports & Fiscalité",
    team: "Équipe & Rôles",
    audit: "Journal d'audit",
    settings: "Paramètres",
  },
  roles: {
    owner: "Propriétaire",
    accountant: "Comptable",
    supervisor: "Superviseur",
    assistant: "Assistant",
  },
  severity: {
    info: "Info",
    warning: "Attention",
    critical: "Critique",
  },
  justNow: "à l'instant",
}

const ar: SharedCopy = {
  modules: {
    dashboard: "لوحة التحكم",
    invoices: "الفواتير",
    projects: "المشاريع",
    contacts: "العملاء والموردون",
    procurement: "المشتريات والمصاريف",
    inventory: "المخزون والمعدات",
    delivery: "التوصيل",
    verification: "التحقق من العملاء",
    calendar: "التقويم",
    risk: "إدارة المخاطر",
    tools: "الاشتراكات والأدوات",
    legal: "الخزنة القانونية",
    reports: "التقارير والضرائب",
    team: "الفريق والأدوار",
    audit: "سجل التدقيق",
    settings: "الإعدادات",
  },
  roles: {
    owner: "المالك",
    accountant: "المحاسب",
    supervisor: "المشرف",
    assistant: "المساعد",
  },
  severity: {
    info: "معلومة",
    warning: "تنبيه",
    critical: "حرج",
  },
  justNow: "الآن",
}

export const shared: Record<Language, SharedCopy> = { ar, en, fr }
