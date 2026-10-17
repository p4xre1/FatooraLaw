import { describe, expect, it } from "vitest"
import { ContactImportError, parseContactImport, uniqueImportedContacts } from "../src/lib/contactImport"
const header = "Name,Type,ICE,Phone,Email,City,Balance"
const csv = `${header}\nAlice,client,ICE123,0123456789,alice@example.com,Tanger,-19.50`
describe("contacts CSV import", () => {
  it("preserves phone text and imports signed balances", () => {
    expect(parseContactImport(csv)[0]).toMatchObject({ name: "Alice", phone: "0123456789", balance: -19.5 })
  })
  it("accepts BOM, quoted names/newlines and safe exported phone prefixes", () => {
    expect(parseContactImport(`\uFEFF${header}\r\n"Atlas, SARL",supplier,,'+212600000000,,"Tan\nger",0`)[0]).toMatchObject({ name: "Atlas, SARL", phone: "+212600000000", city: "Tanger" })
  })
  it("accepts French semicolon exports, reordered headers, decimal commas and empty optional fields", () => {
    expect(parseContactImport("Type;Nom;ICE;Téléphone;E-mail;Ville;Solde\nsupplier;Société;;;;Tanger;-12,50")[0]).toMatchObject({ name: "Société", type: "supplier", balance: -12.5 })
    expect(parseContactImport(`${header}\nAlice,client,,,,,`)[0].balance).toBe(0)
  })
  it("accepts Arabic export headers", () => {
    expect(parseContactImport("الاسم,النوع,ICE,الهاتف,البريد الإلكتروني,المدينة,الرصيد\nعلي,client,,,,طنجة,0")[0].name).toBe("علي")
  })
  it.each([
    ["", "empty"], [header, "empty"], ["Alice,client,,,,,0", "header"],
    [`${header}\nAlice,customer,,,,,0`, "type"], [`${header}\n,client,,,,,0`, "name"],
    [`${header}\nAlice,client,,,,,Infinity`, "balance"], [`${header}\nAlice,client,,,,,1000000000000`, "balance"],
    [`${header}\nAlice,client,,,,,0x10`, "balance"], [`${header}\n"Alice,client,,,,,0`, "csv"],
  ])("rejects invalid input without returning partial rows", (text, code) => {
    try { parseContactImport(text); throw new Error("Expected rejection") }
    catch (cause) { expect(cause).toBeInstanceOf(ContactImportError); expect((cause as ContactImportError).code).toBe(code) }
  })
  it("rejects oversized row counts", () => {
    expect(() => parseContactImport(header + "\nAlice,client,,,,,0".repeat(10_001))).toThrow("rows")
  })
  it("deduplicates exact rows against both existing contacts and this file", () => {
    const rows = parseContactImport(csv)
    expect(uniqueImportedContacts([...rows, ...rows], []).contacts).toHaveLength(1)
    const result = uniqueImportedContacts(rows, [{ ...rows[0], id: "existing" }])
    expect(result).toMatchObject({ contacts: [], skipped: 1 })
    expect(uniqueImportedContacts([{ ...rows[0], name: "Bob" }], [{ ...rows[0], id: "existing" }]).contacts).toHaveLength(1)
  })
})
