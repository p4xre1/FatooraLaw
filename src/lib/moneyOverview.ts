import type {
  AdCampaign, AuditEvent, Contact, Contract, DeliveryOrder, Expense, Project, StockItem, SubscriptionTool,
} from "../store/types"
import { dashboardData } from "./dashboardData"
import { adAllocations, orderEconomics, orderRevenue } from "./deliveryAnalytics"
import { expenseBreakdown } from "./expenseCalc"
import { roundMoney } from "./expenseCalc"

/**
 * Every money figure the application reads, in one place.
 *
 * Reports used to show the project/expense side (dashboardData) while the
 * order side lived on Livraisons and the ad side inside the campaign
 * table. This consolidation reads them all — budgets and collections,
 * approved expenses and their recoverable VAT, order revenue, product /
 * delivery / packaging / ad costs and profit, campaign spend, client
 * balances, the stock's value at purchase price, signed contracts, and
 * the planned monthly subscriptions — and derives one honest position:
 * in, out, what remains, and what is still owed to us.
 *
 * Nothing is estimated: a figure with no records behind it is 0, the
 * subscriptions stay labelled "planned per month" instead of being
 * folded into totals they do not belong to, and the stock value counts
 * only the articles whose purchase price is known (and says how many
 * are not counted).
 *
 * The score is built like the client ranking — visible parts, no black
 * box: collections 40 (collected vs contracted), order profitability 30
 * (15 at break-even), cost coverage 30 (15 when in == out). A part with
 * no data behind it drops out and the rest rescale to 100.
 */

export type MoneyScorePart = {
  key: "collection" | "margin" | "coverage"
  points: number
  max: number
  /** The ratio behind the points (a rate, a margin), for display. */
  ratio: number | null
}

export type MoneyOverview = {
  /** False when not a single money record exists anywhere. */
  hasData: boolean
  // In
  inProjects: number
  inOrders: number
  totalIn: number
  // Contracted (promised, not yet necessarily collected)
  contractedProjects: number
  ordersRevenue: number
  contractedTotal: number
  // Out
  outPurchases: number
  outProducts: number
  outFulfilment: number
  /** Campaign spend, as recorded — what the ads actually cost. */
  outAds: number
  totalOut: number
  // Position
  net: number
  ordersProfit: number
  receivables: number
  toCollect: number
  stockValue: number
  /** Articles whose purchase price is unknown, hence outside stockValue. */
  stockUnknown: number
  contractsSigned: number
  vatRecoverable: number
  /** Planned, monthly — shown, never folded into the totals above. */
  subscriptionsMonthly: number
  score: { value: number | null; parts: MoneyScorePart[] }
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export function moneyOverview(input: {
  projects: readonly Project[]
  expenses: readonly Expense[]
  contacts: readonly Contact[]
  audit: readonly AuditEvent[]
  orders: readonly DeliveryOrder[]
  campaigns: readonly AdCampaign[]
  stock: readonly StockItem[]
  tools: readonly SubscriptionTool[]
  contracts: readonly Contract[]
  today: string
}): MoneyOverview {
  const dash = dashboardData(
    {
      projects: input.projects as Project[],
      expenses: input.expenses as Expense[],
      contacts: input.contacts as Contact[],
      audit: input.audit as AuditEvent[],
    },
    8,
    input.today,
  )

  // The order side, with the same "refused/cancelled never became
  // business" rule the per-client totals use.
  const allocations = adAllocations(input.orders, input.campaigns)
  const bearing = input.orders.filter(
    (order) => order.verificationStatus !== "refused" && order.deliveryStatus !== "cancelled",
  )
  const economics = bearing.map((order) => orderEconomics(order, allocations.get(order.id) ?? 0))
  const sum = (values: number[]) => roundMoney(values.reduce((a, b) => a + b, 0))

  const inProjects = dash.collected
  const inOrders = sum(economics.map((e) => e.collected))
  const ordersRevenue = sum(economics.map((e) => e.revenue))
  const outProducts = sum(economics.map((e) => e.productCost))
  const outFulfilment = sum(economics.map((e) => e.fulfilmentCost))
  const outAds = sum(input.campaigns.map((c) => c.spend))
  const outPurchases = dash.approvedExpenses
  const totalIn = roundMoney(inProjects + inOrders)
  const totalOut = roundMoney(outPurchases + outProducts + outFulfilment + outAds)
  const contractedProjects = dash.budget
  const contractedTotal = roundMoney(contractedProjects + ordersRevenue)

  const vatRecoverable = sum(
    input.expenses
      .filter((expense) => expense.status === "approved")
      .map((expense) => expenseBreakdown(expense).taxAmount ?? 0),
  )
  const stockValue = sum(input.stock.map((item) => (item.costPrice ? item.qty * item.costPrice : 0)))

  /* ------------------------------- the score ------------------------------ */
  const parts: MoneyScorePart[] = []
  const collectionRatio = contractedTotal > 0 ? totalIn / contractedTotal : null
  if (collectionRatio !== null) {
    parts.push({ key: "collection", points: Math.round(40 * clamp01(collectionRatio)), max: 40, ratio: collectionRatio })
  }
  const ordersProfit = sum(economics.map((e) => e.profit))
  if (inOrders > 0) {
    const margin = ordersProfit / inOrders
    parts.push({ key: "margin", points: Math.round(Math.min(30, Math.max(0, 15 + margin * 50))), max: 30, ratio: margin })
  }
  if (totalIn > 0) {
    const coverage = (totalIn - totalOut) / totalIn
    parts.push({ key: "coverage", points: Math.round(30 * clamp01(coverage + 0.5)), max: 30, ratio: coverage })
  }
  const maxAvailable = parts.reduce((total, part) => total + part.max, 0)
  const score = maxAvailable
    ? Math.round((parts.reduce((total, part) => total + part.points, 0) / maxAvailable) * 100)
    : null

  return {
    hasData:
      dash.hasRecords || input.orders.length > 0 || input.campaigns.length > 0 || input.stock.length > 0 || input.contracts.length > 0,
    inProjects,
    inOrders,
    totalIn,
    contractedProjects,
    ordersRevenue,
    contractedTotal,
    outPurchases,
    outProducts,
    outFulfilment,
    outAds,
    totalOut,
    net: roundMoney(totalIn - totalOut),
    ordersProfit,
    receivables: dash.receivables,
    toCollect: sum(
      input.orders
        .filter((order) => order.verificationStatus === "verified")
        .map((order) => Math.max(0, orderRevenue(order) - order.amountPaid)),
    ),
    stockValue,
    stockUnknown: input.stock.filter((item) => !item.costPrice).length,
    contractsSigned: sum(input.contracts.filter((c) => c.status === "signed").map((c) => c.value)),
    vatRecoverable,
    subscriptionsMonthly: sum(
      input.tools.filter((tool) => !tool.expiry || tool.expiry >= input.today).map((tool) => tool.cost),
    ),
    score: { value: score, parts },
  }
}
