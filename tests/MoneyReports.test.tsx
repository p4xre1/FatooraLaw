import { render, screen } from "@testing-library/react"
import { beforeEach, expect, it } from "vitest"
import Reports from "../src/modules/Reports"
import { useMizan } from "../src/store/useMizan"
import type { AdCampaign, Contact, Contract, DeliveryOrder, Expense, Project, StockItem, SubscriptionTool } from "../src/store/types"

/**
 * Rapports shows every money figure in the app three ways: a diagram of
 * in vs out, a financial score with its parts in the open, and an
 * infographic of where the money goes.
 */

beforeEach(() => {
  localStorage.clear()
  useMizan.getState().signOut()
  useMizan.getState().signIn("Karim Benjelloun", "karim@atlas.ma", "owner", "money-user")
  const project: Project = {
    id: "pj-x", name: "Villa", clientId: "c1", budget: 10_000, paid: 6_000, cost: 0,
    status: "active", progress: 50, start: "2026-01-05", end: "2026-12-01", milestones: [], equipmentIds: [],
  }
  const expense: Expense = {
    id: "e1", date: "2026-10-01", vendorId: "sp1", category: "Matériaux", method: "cash",
    amount: 1000, status: "approved", receipt: true, note: "", taxRate: 20,
  }
  const contact: Contact = { id: "c1", type: "client", name: "Salma Bennani", ice: "", phone: "", email: "", city: "Tanger", balance: 2000 }
  const campaign: AdCampaign = { id: "camp1", name: "Meta", platform: "facebook", spend: 100, startedAt: "2026-10-01", endedAt: "" }
  const order: DeliveryOrder = {
    id: "o1", clientId: "c1", campaignId: "camp1", createdAt: "2026-10-01T09:00:00.000Z",
    items: [{ stockId: "st1", label: "Crème", qty: 1, unitPrice: 500, unitCost: 200 }],
    deliveryCost: 30, packagingCost: 10, otherFees: 10, amountPaid: 500,
    verificationStatus: "verified", deliveryStatus: "delivered", callAttempts: 1,
    firstCallAt: null, verifiedAt: "2026-10-01T12:00:00.000Z", paidAt: null, shippedAt: null,
    deliveredAt: "2026-10-02T09:00:00.000Z", stockDeducted: true, notes: "",
  }
  const stock: StockItem[] = [
    { id: "st1", name: "Crème", sku: "C1", qty: 10, minQty: 2, unit: "pièce", assignedProjectId: null, type: "material", costPrice: 50 },
  ]
  const tools: SubscriptionTool[] = [{ id: "t1", name: "Sage", cost: 99, start: "2026-01-01", expiry: "2027-01-01" }]
  const contracts: Contract[] = [{ id: "k1", type: "service", title: "Signé", clientId: "c1", value: 5000, date: "2026-09-01", status: "signed" }]
  useMizan.setState({ projects: [project], expenses: [expense], contacts: [contact], orders: [order], campaigns: [campaign], stock, tools, contracts })
})

it("renders the diagram, the score and the infographic from the same records", () => {
  render(<Reports />)

  expect(screen.getByText("L'argent — la vue complète")).toBeTruthy()
  expect(screen.getByText("Diagramme — l'argent qui entre, l'argent qui sort")).toBeTruthy()
  expect(screen.getAllByText("Score financier").length).toBeGreaterThan(0)
  // The score's parts are shown, not hidden: 6 500 collected of 10 500 contracted.
  expect(screen.getByText("Encaissement (encaissé vs contracté)")).toBeTruthy()
  expect(screen.getByText("25/40")).toBeTruthy()

  expect(screen.getByText("Infographie — où va l'argent")).toBeTruthy()
  expect(screen.getByText("Valeur du stock (au prix d'achat)")).toBeTruthy()
  expect(screen.getByText("TVA récupérable (dépenses approuvées)")).toBeTruthy()
  expect(screen.getByText("Contrats signés")).toBeTruthy()
})
