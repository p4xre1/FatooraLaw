import type { Contact, ContactSource, Project, SalesChannel, StockItem } from "../store/types"
import { sanitizeKeywords } from "./keywords"

/**
 * Ranking clients: a score, a tier, and segments.
 *
 * The score is computed from what the business already records, relative
 * to the client base it is computed in — it answers "who matters most
 * *among our clients*", which is the question a ranking exists for:
 *
 *   spend     50 pts — money actually collected (projects' `paid`),
 *             log-scaled so one whale does not flatten everyone else;
 *   projects  15 pts — how many projects the client has run;
 *   balance   15 pts — full marks when the client owes nothing; a debtor
 *             slides toward 0 against the largest debt in the base;
 *   age       10 pts — a weak signal and weighted like one: prime working
 *             age scores full, the bands around it less, unknown 0.
 *
 * City, source, channel and item keywords are *segments*, not points: a
 * client is not better for living in Casablanca. They slice the ranked
 * list ("our best WhatsApp clients in Tanger who buy ciment"), which is
 * what they are analytically for. The keyword profile comes from the
 * stock the client's projects used — the reason items carry keywords.
 */

export type ClientTier = "vip" | "gold" | "silver" | "bronze"

export type ScoreParts = {
  spend: number
  projects: number
  balance: number
  age: number
}

export type ClientStats = {
  contact: Contact
  /** Money actually collected from this client (Σ projects' paid). */
  spent: number
  /** Money contracted (Σ projects' budget), shown beside the collected. */
  contracted: number
  projectsCount: number
  balance: number
  age: number | null
  /** What this client buys, most-used first (from their projects' stock). */
  keywords: string[]
  parts: ScoreParts
  score: number
  tier: ClientTier
}

/** Age from a birth year alone — the only precision the app asks for. */
export function clientAge(birthYear: number | null | undefined, currentYear: number): number | null {
  if (!birthYear || birthYear < 1900 || birthYear > currentYear) return null
  return currentYear - birthYear
}

export function tierForScore(score: number): ClientTier {
  if (score >= 75) return "vip"
  if (score >= 55) return "gold"
  if (score >= 35) return "silver"
  return "bronze"
}

function agePoints(age: number | null): number {
  if (age === null) return 0
  if (age >= 25 && age <= 55) return 10
  if ((age >= 18 && age < 25) || (age > 55 && age <= 65)) return 6
  return 3
}

/** The keywords of everything a set of projects consumed, most-used first. */
function keywordProfile(projectIds: ReadonlySet<string>, projects: readonly Project[], stock: readonly StockItem[]): string[] {
  const counts = new Map<string, number>()
  const usedIds = new Set<string>()
  for (const item of stock) {
    if (item.assignedProjectId && projectIds.has(item.assignedProjectId)) usedIds.add(item.id)
  }
  for (const project of projects) {
    if (projectIds.has(project.id)) for (const id of project.equipmentIds) usedIds.add(id)
  }
  for (const item of stock) {
    if (!usedIds.has(item.id)) continue
    for (const word of sanitizeKeywords(item.keywords)) {
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([word]) => word)
}

/**
 * Every client's stats, best first. Only `type: "client"` contacts are
 * ranked — a supplier's "spend" would be our own purchases, not revenue.
 */
export function rankClients(
  contacts: readonly Contact[],
  projects: readonly Project[],
  stock: readonly StockItem[],
  currentYear: number,
): ClientStats[] {
  const clients = contacts.filter((contact) => contact.type === "client")

  const raw = clients.map((contact) => {
    const own = projects.filter((project) => project.clientId === contact.id)
    return {
      contact,
      own,
      spent: own.reduce((sum, p) => sum + p.paid, 0),
      contracted: own.reduce((sum, p) => sum + p.budget, 0),
    }
  })

  const maxSpent = Math.max(0, ...raw.map((r) => r.spent))
  const maxProjects = Math.max(0, ...raw.map((r) => r.own.length))
  const maxDebt = Math.max(0, ...raw.map((r) => -r.contact.balance))

  const stats = raw.map(({ contact, own, spent, contracted }): ClientStats => {
    const age = clientAge(contact.birthYear, currentYear)
    const parts: ScoreParts = {
      spend: maxSpent > 0 ? Math.round((50 * Math.log1p(spent)) / Math.log1p(maxSpent)) : 0,
      projects: maxProjects > 0 ? Math.round((15 * own.length) / maxProjects) : 0,
      balance:
        contact.balance >= 0
          ? 15
          : Math.round(15 * (1 - Math.min(1, maxDebt > 0 ? -contact.balance / maxDebt : 0))),
      age: agePoints(age),
    }
    const score = parts.spend + parts.projects + parts.balance + parts.age
    return {
      contact,
      spent,
      contracted,
      projectsCount: own.length,
      balance: contact.balance,
      age,
      keywords: keywordProfile(new Set(own.map((p) => p.id)), projects, stock),
      parts,
      score,
      tier: tierForScore(score),
    }
  })

  return stats.sort((a, b) => b.score - a.score || b.spent - a.spent || a.contact.name.localeCompare(b.contact.name))
}

/** A slice of the ranking: one city, one source, one channel, one keyword. */
export type SegmentFilter = {
  city?: string
  source?: ContactSource | ""
  channel?: SalesChannel | ""
  keyword?: string
}

export function matchesSegment(stats: ClientStats, filter: SegmentFilter): boolean {
  if (filter.city && stats.contact.city.trim().toLowerCase() !== filter.city.trim().toLowerCase()) return false
  if (filter.source && stats.contact.source !== filter.source) return false
  if (filter.channel && stats.contact.channel !== filter.channel) return false
  if (filter.keyword && !stats.keywords.includes(filter.keyword)) return false
  return true
}
