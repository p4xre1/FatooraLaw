import type { Contact } from "../store/types"
import { sanitize } from "../store/useMizan"
import { MAX_AMOUNT } from "./businessValidation"
import { parseCSV, toCSV } from "./mizan"

export type ImportedContact = Omit<Contact, "id">
export const CONTACT_IMPORT_MAX_BYTES = 2 * 1024 * 1024
export const CONTACT_IMPORT_MAX_ROWS = 10_000
const fields = ["name", "type", "ice", "phone", "email", "city", "balance"] as const
const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f\s_-]/g, "").toLowerCase()
const aliases = [
  ["name", "nom", "الاسم"], ["type", "النوع"], ["ice"],
  ["phone", "telephone", "الهاتف"], ["email", "البريد الإلكتروني"],
  ["city", "ville", "المدينة"], ["balance", "solde", "الرصيد"],
].map((list) => list.map(normalize))
export type ContactImportErrorCode = "empty" | "header" | "csv" | "rows" | "name" | "type" | "balance"
export class ContactImportError extends Error {
  constructor(public code: ContactImportErrorCode, public row = 0) { super(code) }
}

/** Accept our 7-column templates/exports, with translated or reordered headers. */
export function parseContactImport(text: string): ImportedContact[] {
  if (!text.trim()) throw new ContactImportError("empty")
  let records: string[][]
  try {
    records = parseCSV(text).filter((r) => r.some((v) => v.trim()))
    if (records[0]?.length !== 7) records = parseCSV(text, ";").filter((r) => r.some((v) => v.trim()))
  } catch { throw new ContactImportError("csv") }
  const header = records.shift()
  if (!header || header.length !== 7) throw new ContactImportError("header")
  const indices = fields.map((_, i) => header.findIndex((value) => aliases[i].includes(normalize(value))))
  if (indices.some((i) => i < 0) || new Set(indices).size !== 7) throw new ContactImportError("header")
  if (!records.length) throw new ContactImportError("empty")
  if (records.length > CONTACT_IMPORT_MAX_ROWS) throw new ContactImportError("rows")
  return records.map((record, i) => {
    if (record.length !== 7) throw new ContactImportError("header", i + 2)
    // Undo the safe text prefix added by our CSV exporter to phone/formula-like strings.
    const [name, type, ice, phone, email, city, balanceText] = indices.map((index) => record[index].trim().replace(/^'(?=[=+@-])/, ""))
    if (!sanitize(name)) throw new ContactImportError("name", i + 2)
    if (type !== "client" && type !== "supplier") throw new ContactImportError("type", i + 2)
    // Decimal commas are common in semicolon-delimited Excel exports.
    const numeric = balanceText.replace(/^(-?\d+),(\d+)$/, "$1.$2")
    if (numeric && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(numeric)) throw new ContactImportError("balance", i + 2)
    const balance = numeric ? Number(numeric) : 0
    if (!Number.isFinite(balance) || Math.abs(balance) > MAX_AMOUNT) throw new ContactImportError("balance", i + 2)
    return { name: sanitize(name), type, ice: sanitize(ice), phone: sanitize(phone), email: sanitize(email), city: sanitize(city), balance }
  })
}

/** Skip exact repeated records, not different people who happen to share a phone. */
export function uniqueImportedContacts(rows: ImportedContact[], existing: readonly Contact[]) {
  const key = (contact: ImportedContact) => JSON.stringify(fields.map((field) => typeof contact[field] === "string" ? sanitize(String(contact[field])).toLowerCase() : contact[field]))
  const seen = new Set(existing.map(key))
  const contacts = rows.filter((contact) => {
    const id = key(contact)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  return { contacts, skipped: rows.length - contacts.length }
}

export function downloadContactTemplate() {
  toCSV([{ Name: "Example client - replace this row", Type: "client", ICE: "", Phone: "", Email: "", City: "", Balance: 0 }], "fatorati-contacts-template.csv")
}
