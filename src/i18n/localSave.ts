import type { Language } from "../lib/language/store.ts"

/** Warning shown when a localStorage write fails for the active account. */
const en = {
  failure: "Local save failed: storage is full or unavailable. Changes remain in this tab but have not been saved. Export a backup before leaving or signing out.",
  export: "Export a backup",
  exportError: "Export failed. Keep this tab open and try again.",
}

type LocalSaveCopy = typeof en

const fr: LocalSaveCopy = {
  failure: "La sauvegarde locale a échoué : le stockage est plein ou indisponible. Les modifications restent dans cet onglet, mais ne sont pas enregistrées. Exportez une sauvegarde avant de quitter ou de vous déconnecter.",
  export: "Exporter une sauvegarde",
  exportError: "L'export a échoué. Gardez cet onglet ouvert et réessayez.",
}

const ar: LocalSaveCopy = {
  failure: "تعذر الحفظ محلياً: مساحة التخزين ممتلئة أو غير متاحة. تبقى التغييرات في علامة التبويب هذه لكنها لم تُحفظ. صدّر نسخة احتياطية قبل المغادرة أو تسجيل الخروج.",
  export: "تصدير نسخة احتياطية",
  exportError: "تعذر التصدير. أبقِ علامة التبويب مفتوحة وحاول مجدداً.",
}

export const localSave: Record<Language, LocalSaveCopy> = { ar, en, fr }
