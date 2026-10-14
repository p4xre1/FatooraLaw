import type { Language } from "../lib/language/store.ts"

/**
 * Inventory and project assignment.
 *
 * Item names, reference codes, project names and unit strings are user-entered
 * data. This section translates the controls around them, not the values people
 * have saved — Arabic UI must not rewrite a user's French material label.
 */
const en = {
  subtitle: (items: number, low: number) => `${items} item${items === 1 ? "" : "s"} · ${low} below minimum`,
  newItem: "New item",
  lowStock: (count: number) => `Low-stock alert — ${count} item${count === 1 ? "" : "s"}`,
  searchLabel: "Search inventory",
  searchPlaceholder: "Search item, SKU…",
  filters: {
    all: "All",
    material: "Materials",
    equipment: "Equipment",
  },
  empty: "No items.",
  table: {
    item: "Item",
    type: "Type",
    level: "Stock level",
    threshold: "Minimum",
    assignment: "Assignment",
    adjustment: "Adjust",
  },
  itemType: {
    material: "Material",
    equipment: "Equipment",
  },
  unassigned: "Unassigned",
  unassign: "Unassign",
  subtract: "Remove one",
  addOne: "Add one",
  createTitle: "New item",
  designation: "Item name",
  sku: "SKU / Reference",
  quantity: "Quantity",
  minimum: "Minimum level",
  unit: "Unit",
  defaultUnit: "unit",
  amountError: "Quantity and minimum must be non-negative and within the allowed limit.",
  addError: "Could not add the item.",
  save: "Add to stock",
}

type InventoryCopy = typeof en

const fr: InventoryCopy = {
  subtitle: (items: number, low: number) => `${items} référence${items === 1 ? "" : "s"} · ${low} sous le seuil`,
  newItem: "Nouvel article",
  lowStock: (count: number) => `Alerte stock faible — ${count} article${count === 1 ? "" : "s"}`,
  searchLabel: "Rechercher dans le stock",
  searchPlaceholder: "Rechercher article, SKU…",
  filters: {
    all: "Tout",
    material: "Matériaux",
    equipment: "Matériel",
  },
  empty: "Aucun article.",
  table: {
    item: "Article",
    type: "Type",
    level: "Niveau",
    threshold: "Seuil",
    assignment: "Affectation",
    adjustment: "Ajustement",
  },
  itemType: {
    material: "Matériau",
    equipment: "Matériel",
  },
  unassigned: "Non affecté",
  unassign: "Retirer",
  subtract: "Retirer une unité",
  addOne: "Ajouter une unité",
  createTitle: "Nouvel article",
  designation: "Désignation",
  sku: "SKU / Référence",
  quantity: "Quantité",
  minimum: "Seuil minimum",
  unit: "Unité",
  defaultUnit: "unité",
  amountError: "La quantité et le seuil doivent être positifs ou nuls et dans la limite autorisée.",
  addError: "Impossible d'ajouter l'article.",
  save: "Ajouter au stock",
}

const ar: InventoryCopy = {
  subtitle: (items: number, low: number) => `${items} ${items === 1 ? "صنف" : items === 2 ? "صنفان" : "أصناف"} · ${low} دون الحد الأدنى`,
  newItem: "صنف جديد",
  lowStock: (count: number) => `تنبيه انخفاض المخزون — ${count} ${count === 1 ? "صنف" : count === 2 ? "صنفان" : "أصناف"}`,
  searchLabel: "البحث في المخزون",
  searchPlaceholder: "ابحث عن صنف أو رمز SKU…",
  filters: {
    all: "الكل",
    material: "المواد",
    equipment: "المعدات",
  },
  empty: "لا توجد أصناف.",
  table: {
    item: "الصنف",
    type: "النوع",
    level: "مستوى المخزون",
    threshold: "الحد الأدنى",
    assignment: "التخصيص",
    adjustment: "التعديل",
  },
  itemType: {
    material: "مادة",
    equipment: "معدات",
  },
  unassigned: "غير مخصص",
  unassign: "إلغاء التخصيص",
  subtract: "إنقاص وحدة",
  addOne: "إضافة وحدة",
  createTitle: "صنف جديد",
  designation: "اسم الصنف",
  sku: "رمز SKU / المرجع",
  quantity: "الكمية",
  minimum: "الحد الأدنى",
  unit: "الوحدة",
  defaultUnit: "وحدة",
  amountError: "يجب أن تكون الكمية والحد الأدنى غير سالبين وضمن الحد المسموح.",
  addError: "تعذرت إضافة الصنف.",
  save: "إضافة إلى المخزون",
}

export const inventory: Record<Language, InventoryCopy> = { ar, en, fr }
