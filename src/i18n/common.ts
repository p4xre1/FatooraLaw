import type { Language } from "../lib/language/store.ts"

/**
 * Words that recur across modules: the buttons, table headers and field hints
 * that would otherwise be retranslated — and eventually reworded differently —
 * in every section. "Annuler" appearing as "Cancel" on one screen and "Abort" on
 * another is the kind of inconsistency that only shows up once everything is
 * translated, so it is worth one shared home.
 *
 * Deliberately small. A key belongs here only once a second module wants the
 * same word; a string that carries meaning specific to one screen stays in that
 * screen's section, where a reviewer can judge it in context.
 *
 * Currency and unit labels are not here. `MAD` is an ISO code and reads the same
 * in all three languages, and the account's own currency comes from settings.
 *
 * `optionalFem` exists because these hints attach to a field label, and French
 * and Arabic both make the adjective agree with it: "Date de début —
 * Facultative", not "Facultatif". English does not distinguish, so the two keys
 * hold the same word there. Collapsing them would put a grammar error on screen
 * in two of the three languages.
 */
const en = {
  add: "Add",
  all: "All",
  amount: "Amount",
  cancel: "Cancel",
  close: "Close",
  create: "Create",
  date: "Date",
  delete: "Delete",
  edit: "Edit",
  export: "Export",
  from: "From",
  name: "Name",
  notes: "Notes",
  optional: "Optional",
  optionalFem: "Optional",
  save: "Save",
  saved: "Saved",
  search: "Search",
  status: "Status",
  to: "To",
  total: "Total",
  actions: "Actions",
  none: "None",
  yes: "Yes",
  no: "No",
}

type CommonCopy = typeof en

const fr: CommonCopy = {
  add: "Ajouter",
  all: "Tout",
  amount: "Montant",
  cancel: "Annuler",
  close: "Fermer",
  create: "Créer",
  date: "Date",
  delete: "Supprimer",
  edit: "Modifier",
  export: "Exporter",
  from: "Du",
  name: "Nom",
  notes: "Notes",
  optional: "Facultatif",
  optionalFem: "Facultative",
  save: "Enregistrer",
  saved: "Enregistré",
  search: "Rechercher",
  status: "Statut",
  to: "Au",
  total: "Total",
  actions: "Actions",
  none: "Aucun",
  yes: "Oui",
  no: "Non",
}

const ar: CommonCopy = {
  add: "إضافة",
  all: "الكل",
  amount: "المبلغ",
  cancel: "إلغاء",
  close: "إغلاق",
  create: "إنشاء",
  date: "التاريخ",
  delete: "حذف",
  edit: "تعديل",
  export: "تصدير",
  from: "من",
  name: "الاسم",
  notes: "ملاحظات",
  optional: "اختياري",
  optionalFem: "اختيارية",
  save: "حفظ",
  saved: "تم الحفظ",
  search: "بحث",
  status: "الحالة",
  to: "إلى",
  total: "المجموع",
  actions: "إجراءات",
  none: "لا شيء",
  yes: "نعم",
  no: "لا",
}

export const common: Record<Language, CommonCopy> = { ar, en, fr }
