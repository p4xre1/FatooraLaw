import { beforeEach, describe, expect, it } from "vitest"
import {
  DataImportError, IMPORT_DATASETS, importColumnList, importPlan, parseImport,
  type ImportDataset, type ImportLinks,
} from "../src/lib/dataImport"
import type { AdCampaign, Contact, Contract, DeliveryOrder, Expense, Project, StockItem, SubscriptionTool, TeamMember } from "../src/store/types"
import { emptyBusinessData } from "../src/store/defaults"
import { useMizan } from "../src/store/useMizan"

const client: Contact = { id: "ct1", type: "client", name: "Groupe Atlas", ice: "", phone: "+212 661-204-118", email: "", city: "Tanger", balance: 0 }
const supplier: Contact = { id: "sp1", type: "supplier", name: "Aciers du Nord", ice: "", phone: "", email: "", city: "Nador", balance: -100 }
const campaign: AdCampaign = { id: "cp1", name: "Soldes Ramadan", platform: "facebook", spend: 1000, startedAt: "", endedAt: "" }
const article: StockItem = { id: "st1", name: "Ciment 50kg", sku: "CIM-50", qty: 100, minQty: 10, unit: "sac", assignedProjectId: null, type: "material", costPrice: 42 }
const links: ImportLinks = { contacts: [client, supplier], campaigns: [campaign], stock: [article] }
const empty: ImportLinks = { contacts: [], campaigns: [], stock: [] }

const parse = <T,>(dataset: ImportDataset, text: string, context: ImportLinks = empty) =>
  parseImport(dataset, text, context).records as T[]

function failure(dataset: ImportDataset, text: string): DataImportError {
  try {
    parseImport(dataset, text, empty)
  } catch (cause) {
    expect(cause).toBeInstanceOf(DataImportError)
    return cause as DataImportError
  }
  throw new Error("Expected the import to be rejected")
}

describe("every dataset is importable", () => {
  it("covers all nine collections, each with a template column list", () => {
    expect([...IMPORT_DATASETS]).toEqual(["contacts", "projects", "expenses", "stock", "orders", "campaigns", "contracts", "team", "tools"])
    for (const dataset of IMPORT_DATASETS) expect(importColumnList(dataset).length).toBeGreaterThan(10)
    // Required columns are the ones a record cannot exist without.
    expect(importColumnList("contacts")).toContain("Name*")
    expect(importColumnList("orders")).toContain("Client*")
  })
})

describe("contacts", () => {
  const header = "Name,Type,ICE,Phone,Email,City,Balance"
  it("preserves phone text and imports signed balances", () => {
    const rows = parse<Contact>("contacts", `${header}\nAlice,client,ICE123,0123456789,alice@example.com,Tanger,-19.50`)
    expect(rows[0]).toMatchObject({ name: "Alice", phone: "0123456789", balance: -19.5, type: "client" })
  })
  it("accepts BOM, quoted names and newlines, and the exported phone prefix", () => {
    const rows = parse<Contact>("contacts", `\uFEFF${header}\r\n"Atlas, SARL",supplier,,'+212600000000,,"Tan\nger",0`)
    expect(rows[0]).toMatchObject({ name: "Atlas, SARL", type: "supplier", phone: "+212600000000", city: "Tanger" })
  })
  it("accepts French semicolon exports, reordered headers and decimal commas", () => {
    const rows = parse<Contact>("contacts", "Type;Nom;ICE;Téléphone;E-mail;Ville;Solde\nsupplier;Société;;;;Tanger;-12,50")
    expect(rows[0]).toMatchObject({ name: "Société", type: "supplier", balance: -12.5 })
  })
  it("accepts Arabic headers and tab-separated files", () => {
    expect(parse<Contact>("contacts", "الاسم,النوع,الهاتف,المدينة,الرصيد\nعلي,client,,طنجة,0")[0].name).toBe("علي")
    expect(parse<Contact>("contacts", "Name\tType\tCity\nSamir\tsupplier\tFès")[0]).toMatchObject({ name: "Samir", type: "supplier", city: "Fès" })
  })
  it("imports a file that only has the columns it needs, defaulting the rest", () => {
    expect(parse<Contact>("contacts", "Name,Phone\nAmina,0600000000")[0]).toMatchObject({ name: "Amina", type: "client", balance: 0, ice: "", city: "" })
  })
  it("ignores columns it does not know instead of refusing the file", () => {
    expect(parse<Contact>("contacts", "Name,Loyalty points\nAmina,320")[0]).toMatchObject({ name: "Amina" })
  })
  it.each([
    ["", "empty"],
    ["Name,Type", "empty"],
    ["Alice,client,,,,,0", "header"],
    [`${header}\nAlice,prospect,,,,,0`, "choice"],
    [`${header}\n,client,,,,,0`, "required"],
    [`${header}\nAlice,client,,,,,Infinity`, "number"],
    [`${header}\nAlice,client,,,,,0x10`, "number"],
    [`${header}\nAlice,client,,,,,1000000000000`, "range"],
    [`${header}\n"Alice,client,,,,,0`, "csv"],
  ])("rejects invalid input (%#) without returning partial rows", (text, code) => {
    expect(failure("contacts", text).code).toBe(code)
  })
  it("names the row and the header the file itself used", () => {
    const error = failure("contacts", "Nom;Solde\nAlice;12\nBob;abc")
    expect(error).toMatchObject({ code: "number", row: 3, column: "Solde" })
  })
  it("rejects oversized row counts", () => {
    expect(failure("contacts", header + "\nAlice,client,,,,,0".repeat(10_001)).code).toBe("rows")
  })
})

describe("projects, expenses, stock", () => {
  it("links a project to an existing client and reads translated statuses", () => {
    const rows = parse<Project>("projects", "Nom;Client;Budget;Avancement;Statut;Début\nVilla Tanger;Groupe Atlas;120 000,50;40;en cours;15/03/2026", links)
    expect(rows[0]).toMatchObject({ name: "Villa Tanger", clientId: "ct1", budget: 120_000.5, progress: 40, status: "active", start: "2026-03-15" })
  })
  it("refuses a fractional progress instead of rounding it silently", () => {
    expect(failure("projects", "Name,Progress\nVilla,40.5").code).toBe("integer")
    expect(failure("projects", "Name,Progress\nVilla,140").code).toBe("range")
  })
  it("links an expense to its supplier, reads French payment methods and VAT", () => {
    const rows = parse<Expense>("expenses", "Date,Vendor,Category,Method,Amount,Status,Receipt,VAT rate,Note\n2026-02-01,Aciers du Nord,Matériaux,virement,1250.40,approuvé,oui,20,Fers", links)
    expect(rows[0]).toMatchObject({ vendorId: "sp1", method: "transfer", amount: 1250.4, status: "approved", receipt: true, taxRate: 20, date: "2026-02-01" })
  })
  it("requires the amount of an expense and rejects an impossible VAT rate", () => {
    expect(failure("expenses", "Date,Amount\n2026-02-01,").code).toBe("required")
    expect(failure("expenses", "Amount,VAT rate\n10,140").code).toBe("rate")
  })
  it("imports stock articles with keywords and decimal quantities", () => {
    const rows = parse<StockItem>("stock", "Name,SKU,Qty,Min qty,Unit,Type,Keywords,Cost price\nSable,SAB-1,12.5,2,m3,matériel,\"Ciment, chantier\",80")
    expect(rows[0]).toMatchObject({ name: "Sable", sku: "SAB-1", qty: 12.5, type: "material", keywords: ["ciment", "chantier"], costPrice: 80 })
  })
})

describe("orders", () => {
  const header = "Date,Client,Phone,City,Campaign,Product,Qty,Unit price,Delivery cost,Amount paid,Verification,Delivery"
  it("links a known client, campaign and stock article, and stamps the stage clocks", () => {
    const result = parseImport("orders", `${header}\n15/03/2026,Groupe Atlas,,,Soldes Ramadan,CIM-50,2,300,30,630,vérifié,livré`, links)
    const [order] = result.records as DeliveryOrder[]
    expect(result.contacts).toHaveLength(0)
    expect(order).toMatchObject({
      clientId: "ct1", campaignId: "cp1", deliveryCost: 30, amountPaid: 630,
      verificationStatus: "verified", deliveryStatus: "delivered", stockDeducted: true,
    })
    expect(order.items[0]).toMatchObject({ stockId: "st1", label: "CIM-50", qty: 2, unitPrice: 300, unitCost: 42 })
    expect(order.createdAt).toBe("2026-03-15T00:00:00.000Z")
    expect(order.deliveredAt).toBe(order.createdAt)
    expect(order.paidAt).toBe(order.createdAt)
  })
  it("creates one client per unknown buyer, reusing it across that buyer's rows", () => {
    const result = parseImport("orders", `${header}\n,Nadia,0600112233,Tétouan,,Table,1,500,0,0,nouveau,en attente\n,Nadia,+212 600 112 233,Tétouan,,Chaise,4,150,0,0,nouveau,en attente`, links)
    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0]).toMatchObject({ type: "client", name: "Nadia", city: "Tétouan", balance: 0 })
    const orders = result.records as DeliveryOrder[]
    expect(orders[0].clientId).toBe(result.contacts[0].id)
    expect(orders[1].clientId).toBe(result.contacts[0].id)
    expect(orders[0].paidAt).toBeNull()
    expect(orders[0].stockDeducted).toBe(false)
  })
  it("requires a client and a product on every row", () => {
    expect(failure("orders", "Client,Product\n,Table").code).toBe("required")
    expect(failure("orders", "Client\nNadia").code).toBe("header")
  })
})

describe("campaigns, contracts, team, tools", () => {
  it("imports campaigns with optional platform metrics", () => {
    const rows = parse<AdCampaign>("campaigns", "Name,Platform,Spend,Start,End,Impressions,Clicks\nRentrée,tiktok,2500,2026-01-01,2026-01-31,120000,3400")
    expect(rows[0]).toMatchObject({ name: "Rentrée", platform: "tiktok", spend: 2500, startedAt: "2026-01-01", impressions: 120_000, clicks: 3400 })
    expect(parse<AdCampaign>("campaigns", "Name,Spend\nRentrée,10")[0].conversions).toBeUndefined()
  })
  it("imports contracts linked to a client", () => {
    const rows = parse<Contract>("contracts", "Titre;Type;Client;Valeur;Date;Statut\nMarché cadre;travaux;Groupe Atlas;48000;01/02/2026;signé", links)
    expect(rows[0]).toMatchObject({ title: "Marché cadre", type: "construction", clientId: "ct1", value: 48_000, date: "2026-02-01", status: "signed" })
  })
  it("gives imported members the permissions of their role and never the owner role", () => {
    const [member] = parse<TeamMember>("team", "Name,Email,Role,Active\nKarim,karim@example.ma,comptable,no")
    expect(member).toMatchObject({ name: "Karim", role: "accountant", active: false })
    expect(member.permissions.procurement).toBe(true)
    expect(member.permissions.team).toBe(false)
    expect(failure("team", "Name,Role\nKarim,owner").code).toBe("choice")
  })
  it("imports subscriptions with their renewal dates", () => {
    expect(parse<SubscriptionTool>("tools", "Name,Monthly cost,Start,Expiry\nAdobe,299,2026-01-01,2026-12-31")[0])
      .toMatchObject({ name: "Adobe", cost: 299, start: "2026-01-01", expiry: "2026-12-31" })
  })
})

describe("the plan a confirmation would apply", () => {
  const csv = "Name,Type,City,Balance\nAlice,client,Tanger,10\nAlice,client,Tanger,10\nBob,supplier,Fès,0"
  it("skips repeats inside the file and repeats of records already stored", () => {
    const result = parseImport("contacts", csv, empty)
    const fresh = importPlan(result, emptyBusinessData())
    expect(fresh).toMatchObject({ added: 2, skipped: 1, newContacts: 0 })
    const stored = { ...emptyBusinessData(), contacts: [{ ...(fresh.payload.contacts ?? [])[0], id: "existing" }] }
    expect(importPlan(result, stored)).toMatchObject({ added: 1, skipped: 2 })
  })
  it("keeps only the clients whose orders survived the duplicate check", () => {
    const orders = "Client,Phone,Product,Qty,Unit price\nNadia,0600112233,Table,1,500\nNadia,0600112233,Table,1,500"
    const plan = importPlan(parseImport("orders", orders, empty), emptyBusinessData())
    expect(plan).toMatchObject({ added: 1, skipped: 1, newContacts: 1 })
    expect(plan.payload.contacts).toHaveLength(1)
    expect(plan.payload.orders?.[0].clientId).toBe(plan.payload.contacts?.[0].id)
  })
})

describe("landing an import in the workspace", () => {
  beforeEach(() => {
    useMizan.getState().signOut()
    localStorage.clear()
    useMizan.getState().signIn("Importer", "import@example.ma", "owner", "data-import-store")
  })

  it("adds the records, their clients and one audit line per collection", () => {
    const result = parseImport("orders", "Client,Phone,City,Product,Qty,Unit price\nNadia,0600112233,Tétouan,Table,1,500", empty)
    useMizan.getState().importRecords(importPlan(result, useMizan.getState()).payload)
    const state = useMizan.getState()
    expect(state.contacts).toHaveLength(1)
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0].clientId).toBe(state.contacts[0].id)
    expect(state.audit.filter((event) => event.action === "a importé").map((event) => event.target))
      .toEqual(expect.arrayContaining(["1 contacts (CSV)", "1 orders (CSV)"]))
  })

  it("applies nothing at all when one record in the payload is invalid", () => {
    const valid = parseImport("contacts", "Name,Balance\nAmina,10", empty)
    const payload = importPlan(valid, useMizan.getState()).payload
    payload.contacts = [...(payload.contacts ?? []), { ...(payload.contacts ?? [])[0], id: "bad", name: "Broken", balance: Number.POSITIVE_INFINITY }]
    expect(() => useMizan.getState().importRecords(payload)).toThrow()
    expect(useMizan.getState().contacts).toHaveLength(0)
  })

  it("refuses an order that points at no contact", () => {
    const result = parseImport("orders", "Client,Product,Qty,Unit price\nNadia,Table,1,500", empty)
    expect(() => useMizan.getState().importRecords({ orders: result.records as DeliveryOrder[] })).toThrow()
    expect(useMizan.getState().orders).toHaveLength(0)
  })
})
