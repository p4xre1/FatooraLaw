import type {
  AdCampaign, Contact, Contract, DeliveryOrder, Expense, Project, Role, StockItem, SubscriptionTool, TeamMember,
} from "../store/types"
import { uid } from "../store/seed"
import { IMPORT_SECTIONS, sanitize, type ImportPayload, type ImportSection } from "../store/useMizan"
import { MAX_AMOUNT, MAX_QUANTITY } from "./businessValidation"
import { calendarDay, todayISO } from "./calendarDates"
import { parseKeywords } from "./keywords"
import { parseCSV, toCSV } from "./mizan"
import { rolePermissions } from "./permissions"

/**
 * CSV import for every kind of business record, not only contacts.
 *
 * One engine, nine datasets. A dataset is a list of columns plus a function
 * that turns one validated row into one stored record, which keeps the rules
 * that matter in a single place:
 *
 * - **Headers are matched, not counted.** Columns may be reordered, written in
 *   French, English or Arabic, and optional ones may be left out entirely.
 *   Unknown columns are ignored rather than rejected, so an export from another
 *   tool usually imports as-is.
 * - **Numbers and dates are read the way people write them** — `1 250,50`,
 *   `1,250.50`, `15/03/2026`, `2026-03-15` — because a spreadsheet saved in
 *   France and one saved in the US disagree about commas, and neither user
 *   should have to care.
 * - **Nothing is imported until the whole file parses.** A bad row 900 throws
 *   with its row number and the header it failed on; the caller shows that and
 *   the workspace is untouched.
 * - **Records are built complete, ids included,** so an orders file can create
 *   the clients it mentions and point its orders at them in the same atomic
 *   `importRecords()` call.
 */

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024
export const IMPORT_MAX_ROWS = 10_000
/** Rows shown back to the user before they confirm. */
export const IMPORT_PREVIEW_ROWS = 5
/** A call counter is a tally, not a measurement: a sane ceiling catches typos. */
const MAX_CALL_ATTEMPTS = 1_000

export const IMPORT_DATASETS = IMPORT_SECTIONS
export type ImportDataset = ImportSection

export type ImportErrorCode =
  | "empty" | "csv" | "header" | "rows"
  | "required" | "number" | "range" | "integer" | "rate" | "date" | "choice"

/** A failure the user can act on: which row, which column, what was expected. */
export class DataImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    readonly row = 0,
    readonly column = "",
    readonly expected = "",
  ) {
    super(code)
  }
}

/* ---------- reading cells ---------- */

/** Fold accents, Arabic diacritics, spacing and punctuation away before matching. */
const normalize = (value: string) =>
  value.trim().normalize("NFD").replace(/[\u0300-\u036f\u0640]/g, "").replace(/[\s_\-'’".()/]/g, "").toLowerCase()

/** Undo the apostrophe our CSV exporter adds in front of formula-like text. */
const plain = (value: string) => value.trim().replace(/^'(?=[=+@-])/, "")

const CURRENCY = /(mad|dhs|dh|درهم|eur|usd|€|\$)$/i

/** `null` when the cell is empty, `NaN` when it cannot be a number. */
function toNumber(text: string): number | null {
  let value = plain(text).replace(/[\s\u00a0\u202f]/g, "").replace(CURRENCY, "")
  if (!value) return null
  const dot = value.lastIndexOf(".")
  const comma = value.lastIndexOf(",")
  // One comma is a decimal comma (`-12,50`); several are thousands separators.
  if (dot >= 0 && comma >= 0) value = comma > dot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "")
  else if (comma >= 0) value = (value.match(/,/g) ?? []).length > 1 ? value.replace(/,/g, "") : value.replace(",", ".")
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return Number.NaN
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/** `""` when empty, `null` when it is not a date we can trust. */
function toISODate(text: string): string | null {
  const value = plain(text)
  if (!value) return ""
  const ymd = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(value)
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s].*)?$/.exec(value)
  const parts = ymd ? [ymd[1], ymd[2], ymd[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : null
  if (!parts) return null
  const iso = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
  return calendarDay(iso) === null ? null : iso
}

const TRUE_WORDS = new Set(["1", "true", "yes", "y", "oui", "o", "vrai", "x", "نعم", "صحيح", "مفعل"])
const FALSE_WORDS = new Set(["0", "false", "no", "n", "non", "faux", "لا", "خطا", "معطل"])

/* ---------- dataset definitions ---------- */

type Kind = "text" | "amount" | "signed" | "quantity" | "integer" | "rate" | "date" | "choice" | "boolean" | "keywords"

type Column = {
  key: string
  /** The header written into the downloadable template. */
  label: string
  kind: Kind
  /** Other spellings accepted in a file (French, Arabic, common variants). */
  aliases?: readonly string[]
  /** The column must exist and carry a value on every row. */
  required?: boolean
  /** Canonical values of a choice column, each with the words that map onto it. */
  choices?: Readonly<Record<string, readonly string[]>>
  /** Example value written in the template's single sample row. */
  sample?: string
}

const column = (key: string, label: string, kind: Kind, extra: Partial<Column> = {}): Column => ({ key, label, kind, ...extra })

const CONTACT_TYPES = {
  client: ["client", "clients", "customer", "acheteur", "زبون", "عميل"],
  supplier: ["supplier", "fournisseur", "vendor", "مورد", "مزود"],
} as const

const nameColumn = (label: string, aliases: readonly string[], sample: string) =>
  column("name", label, "text", { aliases, required: true, sample })

const DATASETS: Record<ImportDataset, readonly Column[]> = {
  contacts: [
    nameColumn("Name", ["nom", "الاسم", "raison sociale", "nom du client", "nom complet"], "Example client — replace this row"),
    column("type", "Type", "choice", { aliases: ["النوع", "categorie"], choices: CONTACT_TYPES, sample: "client" }),
    column("ice", "ICE", "text", { aliases: ["ice number", "رقم التعريف الموحد"] }),
    column("phone", "Phone", "text", { aliases: ["telephone", "téléphone", "tel", "gsm", "mobile", "الهاتف", "رقم الهاتف"], sample: "+212600000000" }),
    column("email", "Email", "text", { aliases: ["e-mail", "mail", "courriel", "البريد الإلكتروني", "الايميل"] }),
    column("city", "City", "text", { aliases: ["ville", "المدينة"], sample: "Tanger" }),
    column("balance", "Balance", "signed", { aliases: ["solde", "الرصيد"], sample: "0" }),
  ],
  projects: [
    nameColumn("Name", ["nom", "projet", "project", "اسم المشروع", "المشروع"], "Example project"),
    column("client", "Client", "text", { aliases: ["clientid", "client name", "nom du client", "العميل"], sample: "" }),
    column("budget", "Budget", "amount", { aliases: ["الميزانية", "montant"], sample: "0" }),
    column("paid", "Paid", "amount", { aliases: ["encaisse", "encaissé", "paye", "payé", "المدفوع"], sample: "0" }),
    column("cost", "Cost", "amount", { aliases: ["cout", "coût", "depense", "التكلفة"], sample: "0" }),
    column("status", "Status", "choice", {
      aliases: ["statut", "etat", "état", "الحالة"], sample: "active",
      choices: {
        planning: ["planning", "planification", "planifie", "prevu", "تخطيط"],
        active: ["active", "actif", "en cours", "ongoing", "نشط", "جاري"],
        on_hold: ["on hold", "onhold", "en pause", "pause", "suspendu", "معلق", "متوقف"],
        done: ["done", "termine", "terminé", "fini", "acheve", "closed", "منجز", "مكتمل"],
      },
    }),
    column("progress", "Progress", "integer", { aliases: ["avancement", "progression", "التقدم"], sample: "0" }),
    column("start", "Start", "date", { aliases: ["debut", "début", "date de debut", "startdate", "البداية", "تاريخ البداية"], sample: "" }),
    column("end", "End", "date", { aliases: ["fin", "date de fin", "enddate", "echeance", "النهاية", "تاريخ النهاية"], sample: "" }),
  ],
  expenses: [
    column("date", "Date", "date", { aliases: ["التاريخ", "date depense"], sample: "" }),
    column("vendor", "Vendor", "text", { aliases: ["fournisseur", "supplier", "vendorid", "المورد"], sample: "" }),
    column("category", "Category", "text", { aliases: ["categorie", "catégorie", "الفئة", "rubrique"], sample: "Matériaux" }),
    column("method", "Method", "choice", {
      aliases: ["mode", "mode de paiement", "paiement", "payment", "طريقة الدفع"], sample: "cash",
      choices: {
        transfer: ["transfer", "virement", "bank transfer", "تحويل", "تحويل بنكي"],
        check: ["check", "cheque", "chèque", "شيك"],
        cash: ["cash", "especes", "espèces", "liquide", "نقدا", "نقد"],
      },
    }),
    column("amount", "Amount", "amount", { aliases: ["montant", "montant ttc", "ttc", "المبلغ"], required: true, sample: "0" }),
    column("status", "Status", "choice", {
      aliases: ["statut", "etat", "état", "الحالة"], sample: "pending",
      choices: {
        pending: ["pending", "en attente", "attente", "brouillon", "قيد الانتظار", "معلق"],
        approved: ["approved", "approuve", "approuvé", "valide", "validé", "مصادق", "معتمد"],
      },
    }),
    column("receipt", "Receipt", "boolean", { aliases: ["justificatif", "facture", "recu", "reçu", "وصل", "فاتورة"], sample: "no" }),
    column("taxRate", "VAT rate", "rate", { aliases: ["tva", "taux de tva", "vat", "نسبة الضريبة", "الضريبة"], sample: "" }),
    column("note", "Note", "text", { aliases: ["libelle", "libellé", "description", "ملاحظة", "البيان"], sample: "Example expense" }),
  ],
  stock: [
    nameColumn("Name", ["nom", "article", "produit", "product", "designation", "désignation", "المنتج", "الاسم"], "Example article"),
    column("sku", "SKU", "text", { aliases: ["reference", "référence", "ref", "code", "barcode", "code barre", "الرمز", "المرجع"], sample: "" }),
    column("qty", "Qty", "quantity", { aliases: ["quantite", "quantité", "quantity", "stock", "الكمية"], sample: "0" }),
    column("minQty", "Min qty", "quantity", { aliases: ["minimum", "seuil", "stock minimum", "min", "الحد الأدنى"], sample: "0" }),
    column("unit", "Unit", "text", { aliases: ["unite", "unité", "الوحدة"], sample: "pcs" }),
    column("type", "Type", "choice", {
      aliases: ["النوع", "categorie"], sample: "material",
      choices: {
        material: ["material", "materiel", "matériel", "matiere", "matière", "consommable", "مادة", "مواد"],
        equipment: ["equipment", "equipement", "équipement", "machine", "outil", "معدات", "آلة"],
      },
    }),
    column("keywords", "Keywords", "keywords", { aliases: ["mots cles", "mots-clés", "tags", "الكلمات المفتاحية"], sample: "" }),
    column("costPrice", "Cost price", "amount", { aliases: ["prix d'achat", "prix achat", "cout unitaire", "coût unitaire", "سعر الشراء"], sample: "" }),
  ],
  orders: [
    column("date", "Date", "date", { aliases: ["التاريخ", "date commande", "created"], sample: "" }),
    column("client", "Client", "text", { aliases: ["nom du client", "customer", "nom", "العميل", "الزبون"], required: true, sample: "Example client" }),
    column("phone", "Phone", "text", { aliases: ["telephone", "téléphone", "tel", "gsm", "الهاتف"], sample: "+212600000000" }),
    column("city", "City", "text", { aliases: ["ville", "المدينة"], sample: "Tanger" }),
    column("campaign", "Campaign", "text", { aliases: ["campagne", "campaignid", "الحملة"], sample: "" }),
    column("product", "Product", "text", { aliases: ["produit", "article", "designation", "sku", "المنتج"], required: true, sample: "Example product" }),
    column("qty", "Qty", "quantity", { aliases: ["quantite", "quantité", "quantity", "الكمية"], sample: "1" }),
    column("unitPrice", "Unit price", "amount", { aliases: ["prix", "prix de vente", "prix unitaire", "price", "سعر البيع"], sample: "0" }),
    column("unitCost", "Unit cost", "amount", { aliases: ["cout produit", "coût produit", "cout unitaire", "achat", "تكلفة المنتج"], sample: "" }),
    column("deliveryCost", "Delivery cost", "amount", { aliases: ["livraison", "frais de livraison", "shipping", "تكلفة التوصيل"], sample: "0" }),
    column("packagingCost", "Packaging cost", "amount", { aliases: ["emballage", "packaging", "التغليف"], sample: "0" }),
    column("otherFees", "Other fees", "amount", { aliases: ["autres frais", "frais", "fees", "رسوم أخرى"], sample: "0" }),
    column("amountPaid", "Amount paid", "amount", { aliases: ["encaisse", "encaissé", "montant encaisse", "paid", "المبلغ المدفوع"], sample: "0" }),
    column("verificationStatus", "Verification", "choice", {
      aliases: ["verification", "vérification", "statut de verification", "confirmation", "حالة التأكيد"], sample: "new",
      choices: {
        new: ["new", "nouveau", "nouvelle", "lead", "جديد"],
        calling: ["calling", "en appel", "appel", "a appeler", "قيد الاتصال"],
        no_answer: ["no answer", "noanswer", "sans reponse", "sans réponse", "injoignable", "لا يرد", "بدون رد"],
        verified: ["verified", "verifie", "vérifié", "confirme", "confirmé", "مؤكد"],
        refused: ["refused", "refuse", "refusé", "annule client", "مرفوض"],
      },
    }),
    column("deliveryStatus", "Delivery", "choice", {
      aliases: ["livraison statut", "statut de livraison", "fulfilment", "حالة التوصيل"], sample: "pending",
      choices: {
        pending: ["pending", "en attente", "attente", "قيد الانتظار"],
        preparing: ["preparing", "preparation", "préparation", "en preparation", "قيد التحضير"],
        shipped: ["shipped", "expedie", "expédié", "envoye", "envoyé", "en route", "تم الشحن"],
        delivered: ["delivered", "livre", "livré", "تم التسليم", "مسلم"],
        returned: ["returned", "retour", "retourne", "retourné", "مرتجع"],
        cancelled: ["cancelled", "canceled", "annule", "annulé", "ملغى", "ملغي"],
      },
    }),
    column("callAttempts", "Calls", "integer", { aliases: ["appels", "nombre d'appels", "tentatives", "المكالمات"], sample: "0" }),
    column("notes", "Notes", "text", { aliases: ["note", "remarques", "ملاحظات"], sample: "" }),
  ],
  campaigns: [
    nameColumn("Name", ["nom", "campagne", "campaign", "اسم الحملة", "الحملة"], "Example campaign"),
    column("platform", "Platform", "choice", {
      aliases: ["plateforme", "reseau", "réseau", "channel", "المنصة"], sample: "facebook",
      choices: {
        facebook: ["facebook", "fb", "meta", "فيسبوك"],
        instagram: ["instagram", "ig", "انستغرام", "إنستغرام"],
        google: ["google", "google ads", "adwords", "غوغل", "جوجل"],
        tiktok: ["tiktok", "tik tok", "تيك توك"],
        whatsapp: ["whatsapp", "wa", "واتساب"],
        other: ["other", "autre", "أخرى"],
      },
    }),
    column("spend", "Spend", "amount", { aliases: ["depense", "dépense", "budget", "cout", "coût", "الإنفاق", "المصروف"], sample: "0" }),
    column("startedAt", "Start", "date", { aliases: ["debut", "début", "date de debut", "البداية"], sample: "" }),
    column("endedAt", "End", "date", { aliases: ["fin", "date de fin", "النهاية"], sample: "" }),
    column("impressions", "Impressions", "amount", { aliases: ["affichages", "vues", "الظهور", "المشاهدات"], sample: "" }),
    column("clicks", "Clicks", "amount", { aliases: ["clics", "النقرات"], sample: "" }),
    column("conversions", "Conversions", "amount", { aliases: ["conversion", "commandes", "التحويلات"], sample: "" }),
    column("conversionValue", "Conversion value", "amount", { aliases: ["valeur des conversions", "chiffre d'affaires", "revenue", "قيمة التحويلات"], sample: "" }),
  ],
  contracts: [
    column("title", "Title", "text", { aliases: ["titre", "intitule", "intitulé", "objet", "العنوان", "الموضوع"], required: true, sample: "Example contract" }),
    column("type", "Type", "choice", {
      aliases: ["النوع", "nature"], sample: "service",
      choices: {
        construction: ["construction", "travaux", "chantier", "بناء", "أشغال"],
        service: ["service", "prestation", "services", "خدمة"],
        rental: ["rental", "location", "bail", "كراء", "إيجار"],
      },
    }),
    column("client", "Client", "text", { aliases: ["clientid", "nom du client", "العميل"], sample: "" }),
    column("value", "Value", "amount", { aliases: ["valeur", "montant", "القيمة", "المبلغ"], sample: "0" }),
    column("date", "Date", "date", { aliases: ["التاريخ", "date du contrat"], sample: "" }),
    column("status", "Status", "choice", {
      aliases: ["statut", "etat", "état", "الحالة"], sample: "draft",
      choices: {
        draft: ["draft", "brouillon", "مسودة"],
        sent: ["sent", "envoye", "envoyé", "transmis", "مرسل"],
        signed: ["signed", "signe", "signé", "موقع", "موقّع"],
      },
    }),
  ],
  team: [
    nameColumn("Name", ["nom", "nom complet", "membre", "الاسم"], "Example member"),
    column("email", "Email", "text", { aliases: ["e-mail", "mail", "courriel", "البريد الإلكتروني"], sample: "member@example.ma" }),
    column("role", "Role", "choice", {
      aliases: ["rôle", "fonction", "profil", "الدور", "الصفة"], sample: "assistant",
      choices: {
        accountant: ["accountant", "comptable", "finance", "محاسب"],
        supervisor: ["supervisor", "superviseur", "chef de chantier", "manager", "مشرف"],
        assistant: ["assistant", "assistante", "aide", "مساعد"],
      },
    }),
    column("active", "Active", "boolean", { aliases: ["actif", "active account", "statut", "نشط", "مفعل"], sample: "yes" }),
  ],
  tools: [
    nameColumn("Name", ["nom", "outil", "abonnement", "subscription", "الاسم", "الأداة"], "Example subscription"),
    column("cost", "Monthly cost", "amount", { aliases: ["cout", "coût", "cout mensuel", "coût mensuel", "prix", "montant", "التكلفة", "التكلفة الشهرية"], sample: "0" }),
    column("start", "Start", "date", { aliases: ["debut", "début", "date de debut", "البداية"], sample: "" }),
    column("expiry", "Expiry", "date", { aliases: ["expiration", "fin", "echeance", "échéance", "renouvellement", "الانتهاء", "تاريخ الانتهاء"], sample: "" }),
  ],
}

/** The columns of a dataset, for the on-screen hint and the template. */
export function importColumns(dataset: ImportDataset): { label: string; required: boolean }[] {
  return DATASETS[dataset].map((col) => ({ label: col.label, required: col.required === true }))
}

/** `Name*, Type*, ICE, Phone…` — the column list shown under the picker. */
export function importColumnList(dataset: ImportDataset): string {
  return importColumns(dataset).map((col) => (col.required ? `${col.label}*` : col.label)).join(", ")
}

export function downloadImportTemplate(dataset: ImportDataset): void {
  const sample = Object.fromEntries(DATASETS[dataset].map((col) => [col.label, col.sample ?? ""]))
  toCSV([sample], `fatorati-${dataset}-template.csv`)
}

/* ---------- row reader ---------- */

type Reader = {
  has: (key: string) => boolean
  text: (key: string) => string
  amount: (key: string, fallback?: number, max?: number) => number
  optionalAmount: (key: string) => number | undefined
  signed: (key: string, fallback: number) => number
  quantity: (key: string, fallback: number) => number
  integer: (key: string, fallback: number, max: number) => number
  rate: (key: string) => number | undefined
  date: (key: string, fallback: string) => string
  choice: <T extends string>(key: string, fallback: T) => T
  flag: (key: string, fallback: boolean) => boolean
  words: (key: string) => string[]
}

function makeReader(columns: Map<string, Column>, headers: Map<string, string>, cells: Map<string, string>, line: number): Reader {
  const header = (key: string) => headers.get(key) ?? columns.get(key)?.label ?? key
  const fail = (code: ImportErrorCode, key: string, expected = "") => new DataImportError(code, line, header(key), expected)
  const read = (key: string) => {
    // `sanitize` is what the store would apply anyway: stripping control
    // characters here means the preview shows the value that will be stored.
    const value = sanitize(cells.get(key) ?? "")
    if (!value && columns.get(key)?.required) throw fail("required", key)
    return value
  }
  const bounded = (key: string, fallback: number | undefined, max: number, signed: boolean) => {
    const text = read(key)
    if (!text) {
      if (fallback === undefined) throw fail("required", key)
      return fallback
    }
    const value = toNumber(text)
    if (value === null || Number.isNaN(value)) throw fail("number", key)
    if (value > max || value < (signed ? -max : 0)) throw fail("range", key, String(max))
    return value
  }
  return {
    has: (key) => (cells.get(key) ?? "").trim().length > 0,
    text: (key) => plain(read(key)),
    amount: (key, fallback, max = MAX_AMOUNT) => bounded(key, fallback, max, false),
    optionalAmount: (key) => (read(key) ? bounded(key, 0, MAX_AMOUNT, false) : undefined),
    signed: (key, fallback) => bounded(key, fallback, MAX_AMOUNT, true),
    quantity: (key, fallback) => bounded(key, fallback, MAX_QUANTITY, false),
    integer: (key, fallback, max) => {
      const value = bounded(key, fallback, max, false)
      if (!Number.isInteger(value)) throw fail("integer", key, String(max))
      return value
    },
    rate: (key) => {
      const text = read(key)
      if (!text) return undefined
      const value = toNumber(text)
      if (value === null || Number.isNaN(value)) throw fail("number", key)
      if (value < 0 || value > 100) throw fail("rate", key)
      return value
    },
    date: (key, fallback) => {
      const text = read(key)
      if (!text) return fallback
      const value = toISODate(text)
      if (!value) throw fail("date", key)
      return value
    },
    choice: <T extends string>(key: string, fallback: T) => {
      const text = read(key)
      const choices = columns.get(key)?.choices ?? {}
      if (!text) return fallback
      const token = normalize(text)
      for (const [canonical, words] of Object.entries(choices)) {
        if (normalize(canonical) === token || words.some((word) => normalize(word) === token)) return canonical as T
      }
      throw fail("choice", key, Object.keys(choices).join(", "))
    },
    flag: (key, fallback) => {
      const text = normalize(read(key))
      if (!text) return fallback
      if (TRUE_WORDS.has(text)) return true
      if (FALSE_WORDS.has(text)) return false
      throw fail("choice", key, "yes, no")
    },
    words: (key) => parseKeywords(read(key)),
  }
}

/* ---------- linking rows to existing records ---------- */

/** What an imported row may point at: records already in the workspace. */
export type ImportLinks = {
  contacts: readonly Contact[]
  campaigns: readonly AdCampaign[]
  stock: readonly StockItem[]
}

/** Moroccan numbers are written `+212 6…` and `06…`; the last nine digits decide. */
const phoneKey = (value: string) => {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 9 ? digits.slice(-9) : digits
}

type BuildContext = {
  links: ImportLinks
  /** One timestamp for the whole file, so identical rows stay identical. */
  now: string
  today: string
  records: ImportRecord[]
  /** Clients an orders file introduces, referenced by the orders it built. */
  contacts: Contact[]
  client: (name: string, phone: string, city: string) => string
  find: (text: string, preferred: Contact["type"]) => Contact | undefined
  campaign: (text: string) => AdCampaign | undefined
  article: (text: string) => StockItem | undefined
}

export type ImportRecord =
  | Contact | Project | Expense | StockItem | DeliveryOrder | AdCampaign | Contract | TeamMember | SubscriptionTool

function makeContext(links: ImportLinks): BuildContext {
  const now = new Date().toISOString()
  const created = new Map<string, string>()
  const contacts: Contact[] = []
  const find: BuildContext["find"] = (text, preferred) => {
    const token = normalize(text)
    if (!token) return undefined
    const phone = phoneKey(text)
    const pool = [...links.contacts, ...contacts]
    const match = (contact: Contact) =>
      normalize(contact.name) === token || (phone.length >= 9 && phoneKey(contact.phone) === phone)
    return pool.find((contact) => contact.type === preferred && match(contact)) ?? pool.find(match)
  }
  return {
    links, now, today: todayISO(), records: [], contacts,
    find,
    campaign: (text) => {
      const token = normalize(text)
      return token ? links.campaigns.find((campaign) => normalize(campaign.name) === token) : undefined
    },
    article: (text) => {
      const token = normalize(text)
      if (!token) return undefined
      return links.stock.find((item) => normalize(item.sku) === token) ?? links.stock.find((item) => normalize(item.name) === token)
    },
    client: (name, phone, city) => {
      const keys = [phoneKey(phone), normalize(name)].filter((key) => key.length > 0)
      for (const key of keys) {
        const known = created.get(key)
        if (known) return known
      }
      const existing = find(phone && phoneKey(phone).length >= 9 ? phone : name, "client")
      const id = existing?.id ?? uid()
      if (!existing) {
        contacts.push({ id, type: "client", name, ice: "", phone, email: "", city, balance: 0 })
      }
      for (const key of keys) created.set(key, id)
      return id
    },
  }
}

/* ---------- one row → one record ---------- */

type Builder = (row: Reader, ctx: BuildContext) => void

const BUILDERS: Record<ImportDataset, Builder> = {
  contacts: (row, ctx) => {
    ctx.records.push({
      id: uid(), type: row.choice<Contact["type"]>("type", "client"), name: row.text("name"),
      ice: row.text("ice"), phone: row.text("phone"), email: row.text("email"), city: row.text("city"),
      balance: row.signed("balance", 0),
    })
  },
  projects: (row, ctx) => {
    ctx.records.push({
      id: uid(), name: row.text("name"), clientId: ctx.find(row.text("client"), "client")?.id ?? "",
      budget: row.amount("budget", 0), paid: row.amount("paid", 0), cost: row.amount("cost", 0),
      status: row.choice<Project["status"]>("status", "planning"), progress: row.integer("progress", 0, 100),
      start: row.date("start", ""), end: row.date("end", ""), milestones: [], equipmentIds: [],
    })
  },
  expenses: (row, ctx) => {
    ctx.records.push({
      id: uid(), date: row.date("date", ctx.today), vendorId: ctx.find(row.text("vendor"), "supplier")?.id ?? "",
      category: row.text("category"), method: row.choice<Expense["method"]>("method", "cash"),
      amount: row.amount("amount"), status: row.choice<Expense["status"]>("status", "pending"),
      receipt: row.flag("receipt", false), note: row.text("note"), taxRate: row.rate("taxRate"), receiptImage: null,
    })
  },
  stock: (row, ctx) => {
    const keywords = row.words("keywords")
    ctx.records.push({
      id: uid(), name: row.text("name"), sku: row.text("sku"), qty: row.quantity("qty", 0),
      minQty: row.quantity("minQty", 0), unit: row.text("unit"), assignedProjectId: null,
      type: row.choice<StockItem["type"]>("type", "material"), costPrice: row.optionalAmount("costPrice"),
      ...(keywords.length ? { keywords } : {}),
    })
  },
  orders: (row, ctx) => {
    const label = row.text("product")
    const article = ctx.article(label)
    const clientId = ctx.client(row.text("client"), row.text("phone"), row.text("city"))
    const date = row.date("date", "")
    const createdAt = date ? `${date}T00:00:00.000Z` : ctx.now
    const qty = row.quantity("qty", 1)
    const unitPrice = row.amount("unitPrice", 0)
    const unitCost = row.has("unitCost") ? row.amount("unitCost", 0) : article?.costPrice ?? 0
    const amountPaid = row.amount("amountPaid", 0)
    const callAttempts = row.integer("callAttempts", 0, MAX_CALL_ATTEMPTS)
    const verificationStatus = row.choice<DeliveryOrder["verificationStatus"]>("verificationStatus", "new")
    const deliveryStatus = row.choice<DeliveryOrder["deliveryStatus"]>("deliveryStatus", "pending")
    const revenue = qty * unitPrice
    const delivered = deliveryStatus === "delivered"
    const called = callAttempts > 0 || ["calling", "no_answer", "verified"].includes(verificationStatus)
    ctx.records.push({
      id: uid(), clientId, campaignId: ctx.campaign(row.text("campaign"))?.id ?? null, createdAt,
      items: [{ stockId: article?.id ?? null, label, qty, unitPrice, unitCost }],
      deliveryCost: row.amount("deliveryCost", 0), packagingCost: row.amount("packagingCost", 0),
      otherFees: row.amount("otherFees", 0), amountPaid, verificationStatus, deliveryStatus, callAttempts,
      // Stage clocks the app normally stamps itself: an imported history has
      // only the order's own date to go on, so every reached stage carries it.
      firstCallAt: called ? createdAt : null,
      verifiedAt: verificationStatus === "verified" ? createdAt : null,
      paidAt: revenue > 0 && amountPaid >= revenue ? createdAt : null,
      shippedAt: delivered || deliveryStatus === "shipped" ? createdAt : null,
      deliveredAt: delivered ? createdAt : null,
      // A delivered order from the past left the warehouse before this import:
      // marking it deducted stops the app subtracting the same units again.
      stockDeducted: delivered,
      notes: row.text("notes"),
    })
  },
  campaigns: (row, ctx) => {
    ctx.records.push({
      id: uid(), name: row.text("name"), platform: row.choice<AdCampaign["platform"]>("platform", "other"),
      spend: row.amount("spend", 0), startedAt: row.date("startedAt", ""), endedAt: row.date("endedAt", ""),
      impressions: row.optionalAmount("impressions"), clicks: row.optionalAmount("clicks"),
      conversions: row.optionalAmount("conversions"), conversionValue: row.optionalAmount("conversionValue"),
    })
  },
  contracts: (row, ctx) => {
    ctx.records.push({
      id: uid(), title: row.text("title"), type: row.choice<Contract["type"]>("type", "service"),
      clientId: ctx.find(row.text("client"), "client")?.id ?? "", value: row.amount("value", 0),
      date: row.date("date", ctx.today), status: row.choice<Contract["status"]>("status", "draft"),
    })
  },
  team: (row, ctx) => {
    const role = row.choice<Role>("role", "assistant")
    ctx.records.push({
      id: uid(), name: row.text("name"), email: row.text("email"), role,
      active: row.flag("active", true), permissions: rolePermissions(role),
    })
  },
  tools: (row, ctx) => {
    ctx.records.push({
      id: uid(), name: row.text("name"), cost: row.amount("cost", 0),
      start: row.date("start", ""), expiry: row.date("expiry", ""),
    })
  },
}

/* ---------- parsing a file ---------- */

export type ImportResult = {
  dataset: ImportDataset
  /** Recognised headers, written as they appear in the file. */
  headers: string[]
  /** The first rows as they were read, aligned with `headers`. */
  preview: string[][]
  /** Records built for the dataset's own collection. */
  records: ImportRecord[]
  /** Clients an orders file adds, already referenced by those orders. */
  contacts: Contact[]
  total: number
}

const DELIMITERS = [",", ";", "\t"] as const

function headerMap(dataset: ImportDataset, header: readonly string[]) {
  const byAlias = new Map<string, Column>()
  for (const col of DATASETS[dataset]) {
    for (const alias of [col.key, col.label, ...(col.aliases ?? [])]) byAlias.set(normalize(alias), col)
  }
  /** column key → index in the record, and → the header text the file used. */
  const index = new Map<string, number>()
  const headers = new Map<string, string>()
  header.forEach((cell, position) => {
    const col = byAlias.get(normalize(cell))
    if (!col || index.has(col.key)) return
    index.set(col.key, position)
    headers.set(col.key, cell.trim())
  })
  return { index, headers }
}

/** Read the file with the delimiter that recognises the most known columns. */
function readRecords(dataset: ImportDataset, text: string): string[][] {
  let best: { rows: string[][]; score: number } | null = null
  for (const delimiter of DELIMITERS) {
    let rows: string[][]
    try {
      rows = parseCSV(text, delimiter).filter((row) => row.some((cell) => cell.trim()))
    } catch {
      throw new DataImportError("csv")
    }
    const score = headerMap(dataset, rows[0] ?? []).index.size
    if (!best || score > best.score) best = { rows, score }
  }
  return best?.rows ?? []
}

/**
 * Parse a CSV into finished records. Throws `DataImportError` — never returns
 * a partial list — so a caller can show the failure and keep the workspace as
 * it was.
 */
export function parseImport(dataset: ImportDataset, text: string, links: ImportLinks): ImportResult {
  if (!text.trim()) throw new DataImportError("empty")
  const rows = readRecords(dataset, text)
  const header = rows.shift()
  if (!header) throw new DataImportError("empty")
  const { index, headers } = headerMap(dataset, header)
  const columns = new Map(DATASETS[dataset].map((col) => [col.key, col]))
  if (!index.size) throw new DataImportError("header", 0, "", importColumnList(dataset))
  for (const col of DATASETS[dataset]) {
    if (col.required && !index.has(col.key)) throw new DataImportError("header", 0, col.label, importColumnList(dataset))
  }
  if (!rows.length) throw new DataImportError("empty")
  if (rows.length > IMPORT_MAX_ROWS) throw new DataImportError("rows", 0, "", String(IMPORT_MAX_ROWS))

  const ctx = makeContext(links)
  const preview: string[][] = []
  const order = [...index.keys()]
  rows.forEach((record, position) => {
    const cells = new Map(order.map((key) => [key, record[index.get(key)!] ?? ""]))
    // Row 1 is the header, so the first record a person sees is row 2.
    BUILDERS[dataset](makeReader(columns, headers, cells, position + 2), ctx)
    if (preview.length < IMPORT_PREVIEW_ROWS) preview.push(order.map((key) => plain(cells.get(key) ?? "")))
  })
  return {
    dataset,
    headers: order.map((key) => headers.get(key) ?? key),
    preview,
    records: ctx.records,
    contacts: ctx.contacts,
    total: ctx.records.length,
  }
}

/* ---------- duplicates and committing ---------- */

/** A record's content, ignoring its id, so a re-imported file is recognised. */
function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) => key !== "id" && item !== undefined && item !== null)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, item]) => `${key}:${fingerprint(item)}`)
      .join(",")}}`
  }
  return typeof value === "string" ? value.trim().toLowerCase() : String(value)
}

export type ImportPlan = { payload: ImportPayload; added: number; skipped: number; newContacts: number }

/**
 * What this file would actually add, measured against the workspace as it is
 * right now: exact repeats of a record that already exists are skipped, and so
 * are repeats inside the file itself. Nothing an existing record holds is
 * overwritten — an import only ever adds.
 */
export function importPlan(result: ImportResult, current: Partial<Record<ImportSection, readonly unknown[]>>): ImportPlan {
  const seen = new Set((current[result.dataset] ?? []).map(fingerprint))
  const kept: ImportRecord[] = []
  for (const record of result.records) {
    const key = fingerprint(record)
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(record)
  }
  // Only keep the clients whose orders survived the duplicate check.
  const referenced = new Set(kept.map((record) => (record as DeliveryOrder).clientId))
  const contacts = result.contacts.filter((contact) => referenced.has(contact.id))
  const payload: ImportPayload = { [result.dataset]: kept } as ImportPayload
  if (contacts.length && result.dataset !== "contacts") payload.contacts = contacts
  return { payload, added: kept.length, skipped: result.records.length - kept.length, newContacts: contacts.length }
}
