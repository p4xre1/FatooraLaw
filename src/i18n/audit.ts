import type { Language } from "../lib/language/store.ts"

/**
 * The audit log.
 *
 * The subtitle is not a translation of the string it replaces. It read
 * "Traçabilité immuable des événements système" — immutable traceability — but
 * the log is an array in the account's own localStorage record: a user can
 * export it, restore an older backup over it, or clear it from Settings, and
 * nothing hashes or append-locks it (docs/FEATURES_AND_TOOLS.md lists this among
 * the strings that overstate what the app does). Translating a claim into three
 * languages would have made it three times as load-bearing, so the copy now says
 * what the screen actually shows.
 *
 * `export.*` are the CSV column headers. They are translated because the file is
 * read by the same person as the screen; the row *values* are stored data and
 * are emitted as recorded.
 */
const en = {
  title: "Audit log",
  subtitle: "History of the events recorded on this device",
  exportButton: "Export the log",
  totalEvents: "Total events",
  last24: "Last 24 h",
  critical24: "Critical actions (24 h)",
  searchPlaceholder: "Search actor, action, target…",
  all: "All",
  empty: "No events.",
  export: {
    timestamp: "Timestamp",
    actor: "Actor",
    action: "Action",
    target: "Target",
    module: "Module",
    severity: "Severity",
  },
}

type AuditCopy = typeof en

const fr: AuditCopy = {
  title: "Journal d'audit",
  subtitle: "Historique des événements enregistrés sur cet appareil",
  exportButton: "Exporter le journal",
  totalEvents: "Événements totaux",
  last24: "Dernières 24 h",
  critical24: "Actions critiques (24 h)",
  searchPlaceholder: "Rechercher acteur, action, cible…",
  all: "Tout",
  empty: "Aucun événement.",
  export: {
    timestamp: "Horodatage",
    actor: "Acteur",
    action: "Action",
    target: "Cible",
    module: "Module",
    severity: "Sévérité",
  },
}

const ar: AuditCopy = {
  title: "سجل التدقيق",
  subtitle: "سجل الأحداث المحفوظة على هذا الجهاز",
  exportButton: "تصدير السجل",
  totalEvents: "مجموع الأحداث",
  last24: "آخر 24 ساعة",
  critical24: "إجراءات حرجة (24 ساعة)",
  searchPlaceholder: "ابحث عن الفاعل أو الإجراء أو الهدف…",
  all: "الكل",
  empty: "لا توجد أحداث.",
  export: {
    timestamp: "التوقيت",
    actor: "الفاعل",
    action: "الإجراء",
    target: "الهدف",
    module: "الوحدة",
    severity: "الخطورة",
  },
}

export const audit: Record<Language, AuditCopy> = { ar, en, fr }
