import { describe, expect, it } from "vitest"
import { clientAge, matchesSegment, rankClients, tierForScore } from "../src/lib/clientRank"
import { aggregateByCity, matchCity, normalizeCityName } from "../src/lib/cities"
import { formatKeywords, parseKeywords, sanitizeKeywords } from "../src/lib/keywords"
import type { Contact, Project, StockItem } from "../src/store/types"

/**
 * The client ranking: collected money leads, the segments slice. Score
 * expectations are computed by hand from the weights in lib/clientRank.ts
 * (spend 50 log-scaled, projects 15, balance 15, age 10), so a weight
 * change breaks this file on purpose — it is the ranking's contract.
 */

const client = (patch: Partial<Contact>): Contact => ({
  id: "c", type: "client", name: "Client", ice: "", phone: "", email: "",
  city: "Tanger", balance: 0, birthYear: null, source: null, channel: null, ...patch,
})
const project = (patch: Partial<Project>): Project => ({
  id: "p", name: "Projet", clientId: "c", budget: 0, paid: 0, cost: 0,
  status: "active", progress: 0, start: "2026-01-01", end: "2026-06-01",
  milestones: [], equipmentIds: [], ...patch,
})
const stockItem = (patch: Partial<StockItem>): StockItem => ({
  id: "s", name: "Article", sku: "SKU", qty: 1, minQty: 0, unit: "pièce",
  assignedProjectId: null, type: "material", keywords: [], ...patch,
})

const YEAR = 2026

describe("keywords", () => {
  it("folds case, spaces and duplicates into one vocabulary", () => {
    expect(parseKeywords("Ciment, plomberie ; Chantier, ciment")).toEqual(["ciment", "plomberie", "chantier"])
    expect(parseKeywords("  , ;")).toEqual([])
    expect(sanitizeKeywords([" Bois ", "bois", ""])).toEqual(["bois"])
    expect(formatKeywords(["ciment", "sable"])).toBe("ciment, sable")
  })

  it("caps the list so a pasted paragraph cannot become a vocabulary", () => {
    const many = Array.from({ length: 30 }, (_, i) => `mot${i}`).join(",")
    expect(parseKeywords(many)).toHaveLength(12)
  })
})

describe("the score", () => {
  it("ages from a birth year, and admits when it does not know", () => {
    expect(clientAge(1990, YEAR)).toBe(36)
    expect(clientAge(null, YEAR)).toBeNull()
    expect(clientAge(1800, YEAR)).toBeNull()
    expect(clientAge(2030, YEAR)).toBeNull()
  })

  it("tiers at the published thresholds", () => {
    expect(tierForScore(90)).toBe("vip")
    expect(tierForScore(75)).toBe("vip")
    expect(tierForScore(55)).toBe("gold")
    expect(tierForScore(35)).toBe("silver")
    expect(tierForScore(34)).toBe("bronze")
  })

  it("ranks by collected money first, and says what every point is", () => {
    const contacts = [
      client({ id: "whale", name: "Whale", balance: 0, birthYear: 1990 }),
      client({ id: "small", name: "Small", balance: 0, birthYear: 1990 }),
      client({ id: "debtor", name: "Debtor", balance: -1000, birthYear: null }),
      { ...client({ id: "sup", name: "Fournisseur" }), type: "supplier" as const },
    ]
    const projects = [
      project({ id: "p1", clientId: "whale", budget: 100000, paid: 90000 }),
      project({ id: "p2", clientId: "whale", budget: 50000, paid: 10000 }),
      project({ id: "p3", clientId: "small", budget: 5000, paid: 5000 }),
      project({ id: "p4", clientId: "debtor", budget: 8000, paid: 0 }),
    ]
    const ranked = rankClients(contacts, projects, [], YEAR)

    // Suppliers are not ranked; the whale leads; the debtor trails.
    expect(ranked.map((r) => r.contact.id)).toEqual(["whale", "small", "debtor"])
    const [whale, small, debtor] = ranked
    expect(whale.spent).toBe(100000) // collected, not the 150 000 contracted
    expect(whale.contracted).toBe(150000)
    expect(whale.parts.spend).toBe(50) // the base's maximum spend
    expect(whale.parts.projects).toBe(15) // and its most projects (2)
    expect(whale.score).toBe(90) // 50 + 15 + 15 (clear balance) + 10 (age 36)
    expect(whale.tier).toBe("vip")

    expect(small.spent).toBe(5000)
    expect(small.parts.spend).toBeLessThan(whale.parts.spend) // log-scaled, not crushed to 2.5
    expect(small.parts.spend).toBeGreaterThan(20)

    expect(debtor.parts.balance).toBe(0) // the base's largest debt
    expect(debtor.parts.age).toBe(0) // unknown birth year earns nothing
    expect(debtor.tier).toBe("bronze")
  })

  it("a base of one client with no money is a quiet zero, not NaN", () => {
    const ranked = rankClients([client({ id: "solo" })], [], [], YEAR)
    expect(ranked[0].score).toBe(15) // balance only
    expect(Number.isFinite(ranked[0].score)).toBe(true)
  })
})

describe("segments and keyword profiles", () => {
  const contacts = [
    client({ id: "a", name: "A", city: "Tanger", source: "whatsapp", channel: "direct" }),
    client({ id: "b", name: "B", city: "Casablanca", source: "instagram", channel: "reseller" }),
  ]
  const projects = [
    project({ id: "pa", clientId: "a" }),
    project({ id: "pb", clientId: "b", equipmentIds: ["s2"] }),
  ]
  const stock = [
    stockItem({ id: "s1", assignedProjectId: "pa", keywords: ["Ciment", "chantier"] }),
    stockItem({ id: "s2", keywords: ["plomberie"] }),
    stockItem({ id: "s3", assignedProjectId: "other", keywords: ["ignored"] }),
  ]
  const ranked = rankClients(contacts, projects, stock, YEAR)

  it("a client inherits the keywords of the stock their projects used", () => {
    expect(ranked.find((r) => r.contact.id === "a")?.keywords).toEqual(["chantier", "ciment"])
    expect(ranked.find((r) => r.contact.id === "b")?.keywords).toEqual(["plomberie"])
  })

  it("slices by city, source, channel and keyword — together", () => {
    const byId = (id: string) => ranked.find((r) => r.contact.id === id)!
    expect(matchesSegment(byId("a"), { city: "tanger" })).toBe(true)
    expect(matchesSegment(byId("a"), { city: "Casablanca" })).toBe(false)
    expect(matchesSegment(byId("a"), { source: "whatsapp", keyword: "ciment" })).toBe(true)
    expect(matchesSegment(byId("b"), { channel: "reseller", keyword: "ciment" })).toBe(false)
    expect(matchesSegment(byId("b"), {})).toBe(true)
  })
})

describe("cities", () => {
  it("normalizes accents and case, and knows the Arabic spellings", () => {
    expect(normalizeCityName("  Béni   Mellal ")).toBe("beni mellal")
    expect(matchCity("tanger")?.fr).toBe("Tanger")
    expect(matchCity("Tangier")?.fr).toBe("Tanger")
    expect(matchCity("الدار البيضاء")?.fr).toBe("Casablanca")
    expect(matchCity("FES")?.fr).toBe("Fès")
    expect(matchCity("Atlantis")).toBeNull()
  })

  it("rolls clients up per city and keeps the unknown ones", () => {
    const agg = aggregateByCity([
      { city: "Tanger", spent: 100 },
      { city: "tanger ", spent: 50 },
      { city: "Casablanca", spent: 900 },
      { city: "Village Inconnu", spent: 10 },
    ])
    expect(agg.map((a) => [a.label, a.clients, a.spent])).toEqual([
      ["Casablanca", 1, 900],
      ["Tanger", 2, 150],
      ["Village Inconnu", 1, 10],
    ])
    expect(agg[1].city?.fr).toBe("Tanger")
    expect(agg[2].city).toBeNull()
  })
})
