import type { Language } from "../lib/language/store.ts"

/**
 * Settings, local backups and company identity.
 *
 * The storage/security notices are important operational guidance: the app saves
 * data in this browser, does not encrypt it, and its JSON export is sensitive.
 * The translation keeps all three facts explicit.
 */
const en = {
  subtitle: "Company configuration, tax settings and documents",
  save: "Save",
  saved: "Saved",
  saveError: "Could not save settings.",
  localSaveError: "Local save failed. Export your data before leaving this tab.",
  localData: {
    body: "Business data is saved in this browser, separately for each account. Export a copy regularly before changing devices or clearing browser storage.",
    export: "Export my local data",
    legacy: "Data from the older version remains on this device. It is not automatically assigned to an account, to avoid sharing another user's data.",
    exportLegacy: "Export the older backup",
    exportError: "Could not export the backup. Your data remains in this tab.",
    legacyError: "Could not read the local backup. The original data has been kept.",
    title: "Local data on this device",
    security: "This data is not encrypted by the application. A JSON backup is a sensitive copy: keep it in a secure location. Export does not replace a restore procedure.",
  },
  identity: {
    title: "Company identity",
    logoAlt: "Company logo",
    logoFile: "Logo file",
    uploadLogo: "Upload logo",
    loadingLogo: "Reading logo…",
    removeLogo: "Remove",
    logoHelp: "PNG, JPEG, WebP or GIF · 512 KB maximum",
    logoSize: "The logo must not exceed 512 KB.",
    logoFormat: "Choose a PNG, JPEG, WebP or GIF image.",
    logoEmpty: "The logo file is empty.",
    logoContent: "The file contents do not match the declared image format.",
    logoRead: "Could not read the logo. Try another file.",
    logoInvalid: "Invalid logo.",
    company: "Company name",
    ice: "ICE",
    taxId: "Tax ID",
    rc: "Commercial register",
    city: "City",
    address: "Address",
  },
  fiscal: {
    title: "Tax and currency",
    currency: "Currency",
    currencies: {
      MAD: "Moroccan dirham (MAD)",
      EUR: "Euro (EUR)",
      USD: "US dollar (USD)",
    },
    vat: "VAT rate (%)",
    vatError: "Enter a VAT rate from 0 to 100% (0 is allowed).",
  },
  documents: {
    title: "Document header and footer",
    header: "Header note",
    footer: "Footer note",
  },
}

type SettingsCopy = typeof en

const fr: SettingsCopy = {
  subtitle: "Configuration de l'entité, fiscalité & documents",
  save: "Enregistrer",
  saved: "Enregistré",
  saveError: "Impossible d'enregistrer les paramètres.",
  localSaveError: "La sauvegarde locale a échoué. Exportez vos données avant de quitter cet onglet.",
  localData: {
    body: "Les données métier sont enregistrées dans ce navigateur, séparément pour chaque compte. Exportez régulièrement une copie avant de changer d'appareil ou d'effacer le stockage du navigateur.",
    export: "Exporter mes données locales",
    legacy: "Les données de l'ancienne version sont conservées sur cet appareil. Elles ne sont pas attribuées automatiquement à un compte, pour éviter de partager les données d'un autre utilisateur.",
    exportLegacy: "Exporter la sauvegarde ancienne",
    exportError: "Impossible d'exporter la sauvegarde. Vos données restent dans cet onglet.",
    legacyError: "Impossible de lire la sauvegarde locale. Les données originales sont conservées.",
    title: "Données locales sur cet appareil",
    security: "Ces données ne sont pas chiffrées par l'application. Une sauvegarde JSON est une copie sensible : conservez-la dans un emplacement sécurisé. L'export ne remplace pas une procédure de restauration.",
  },
  identity: {
    title: "Identité de l'entreprise",
    logoAlt: "Logo",
    logoFile: "Fichier du logo",
    uploadLogo: "Charger le logo",
    loadingLogo: "Lecture du logo…",
    removeLogo: "retirer",
    logoHelp: "PNG, JPEG, WebP ou GIF · 512 Ko maximum",
    logoSize: "Le logo ne doit pas dépasser 512 Ko.",
    logoFormat: "Choisissez une image PNG, JPEG, WebP ou GIF.",
    logoEmpty: "Le fichier du logo est vide.",
    logoContent: "Le contenu du fichier ne correspond pas au format d'image annoncé.",
    logoRead: "Lecture du logo impossible. Réessayez avec un autre fichier.",
    logoInvalid: "Logo invalide.",
    company: "Raison sociale",
    ice: "ICE",
    taxId: "Identifiant fiscal",
    rc: "Registre de commerce",
    city: "Ville",
    address: "Adresse",
  },
  fiscal: {
    title: "Fiscalité & devise",
    currency: "Devise",
    currencies: {
      MAD: "Dirham (MAD)",
      EUR: "Euro (EUR)",
      USD: "Dollar (USD)",
    },
    vat: "Taux de TVA (%)",
    vatError: "Indiquez un taux de TVA entre 0 et 100 % (0 est autorisé).",
  },
  documents: {
    title: "En-tête & pied de document",
    header: "Note d'en-tête",
    footer: "Note de pied de page",
  },
}

const ar: SettingsCopy = {
  subtitle: "إعدادات الشركة والضرائب والمستندات",
  save: "حفظ",
  saved: "تم الحفظ",
  saveError: "تعذر حفظ الإعدادات.",
  localSaveError: "تعذر الحفظ محلياً. صدّر بياناتك قبل مغادرة علامة التبويب.",
  localData: {
    body: "تُحفظ بيانات العمل في هذا المتصفح، بشكل منفصل لكل حساب. صدّر نسخة بانتظام قبل تغيير الجهاز أو مسح مساحة تخزين المتصفح.",
    export: "تصدير بياناتي المحلية",
    legacy: "تظل بيانات الإصدار السابق محفوظة على هذا الجهاز. لا تُنسب تلقائياً إلى حساب، لتجنب مشاركة بيانات مستخدم آخر.",
    exportLegacy: "تصدير النسخة الاحتياطية القديمة",
    exportError: "تعذر تصدير النسخة الاحتياطية. بقيت بياناتك في علامة التبويب هذه.",
    legacyError: "تعذرت قراءة النسخة المحلية. تم الإبقاء على البيانات الأصلية.",
    title: "بيانات محلية على هذا الجهاز",
    security: "لا يقوم التطبيق بتشفير هذه البيانات. نسخة JSON الاحتياطية حساسة؛ احتفظ بها في مكان آمن. ولا يغني التصدير عن إجراء للاستعادة.",
  },
  identity: {
    title: "بيانات تعريف الشركة",
    logoAlt: "شعار الشركة",
    logoFile: "ملف الشعار",
    uploadLogo: "تحميل الشعار",
    loadingLogo: "جارٍ قراءة الشعار…",
    removeLogo: "إزالة",
    logoHelp: "PNG أو JPEG أو WebP أو GIF · الحد الأقصى 512 كيلوبايت",
    logoSize: "يجب ألا يتجاوز حجم الشعار 512 كيلوبايت.",
    logoFormat: "اختر صورة بصيغة PNG أو JPEG أو WebP أو GIF.",
    logoEmpty: "ملف الشعار فارغ.",
    logoContent: "محتوى الملف لا يطابق صيغة الصورة المعلنة.",
    logoRead: "تعذرت قراءة الشعار. جرّب ملفاً آخر.",
    logoInvalid: "الشعار غير صالح.",
    company: "اسم الشركة",
    ice: "ICE",
    taxId: "المعرّف الضريبي",
    rc: "السجل التجاري",
    city: "المدينة",
    address: "العنوان",
  },
  fiscal: {
    title: "الضرائب والعملة",
    currency: "العملة",
    currencies: {
      MAD: "الدرهم المغربي (MAD)",
      EUR: "اليورو (EUR)",
      USD: "الدولار الأمريكي (USD)",
    },
    vat: "نسبة الضريبة على القيمة المضافة (%)",
    vatError: "أدخل نسبة بين 0 و100٪ (القيمة 0 مسموح بها).",
  },
  documents: {
    title: "ترويسة وتذييل المستند",
    header: "ملاحظة الترويسة",
    footer: "ملاحظة التذييل",
  },
}

export const settings: Record<Language, SettingsCopy> = { ar, en, fr }
