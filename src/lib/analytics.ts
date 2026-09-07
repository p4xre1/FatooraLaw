import type { Contact, Expense, Project } from "../store/types"

export const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

/** Deterministic monthly revenue/expense series seeded from real totals for stable charts. */
export function monthlySeries(projects: Project[], expenses: Expense[], count = 8) {
  const now = new Date()
  const labels: string[] = []
  const revenue: number[] = []
  const expense: number[] = []

  const totalPaid = projects.reduce((s, p) => s + p.paid, 0)
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0)
  const baseR = totalPaid / count
  const baseE = totalExp / count

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(MONTHS[d.getMonth()])
    const wave = 1 + 0.35 * Math.sin((i / count) * Math.PI * 2) + (((i * 37) % 13) / 100)
    revenue.push(Math.round((baseR * wave) / 1000) * 1000)
    const ewave = 0.85 + 0.25 * Math.cos((i / count) * Math.PI * 2) + (((i * 19) % 11) / 100)
    expense.push(Math.round((baseE * ewave) / 1000) * 1000)
  }
  return { labels, revenue, expense }
}

export function metrics(projects: Project[], expenses: Expense[], contacts: Contact[]) {
  const contractValue = projects.reduce((s, p) => s + p.budget, 0)
  const collected = projects.reduce((s, p) => s + p.paid, 0)
  const cost = projects.reduce((s, p) => s + p.cost, 0)
  const margin = contractValue - cost
  const marginPct = contractValue ? (margin / contractValue) * 100 : 0
  const approvedExpenses = expenses.filter((e) => e.status === "approved").reduce((s, e) => s + e.amount, 0)
  const pendingExpenses = expenses.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0)
  const treasury = collected - approvedExpenses
  const receivables = contacts.filter((c) => c.type === "client").reduce((s, c) => s + Math.max(0, c.balance), 0)
  const payables = contacts.filter((c) => c.type === "supplier").reduce((s, c) => s + Math.max(0, -c.balance), 0)
  return { contractValue, collected, cost, margin, marginPct, approvedExpenses, pendingExpenses, treasury, receivables, payables }
}

export function expenseByCategory(expenses: Expense[]) {
  const map = new Map<string, number>()
  for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "#64748b"]
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }))
}
