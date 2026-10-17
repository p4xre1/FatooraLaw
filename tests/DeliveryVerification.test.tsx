import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import Delivery from "../src/modules/Delivery"
import Verification from "../src/modules/Verification"
import Reports from "../src/modules/Reports"
import { useMizan } from "../src/store/useMizan"
import type { AdCampaign, Contact, DeliveryOrder, StockItem } from "../src/store/types"

/**
 * The two new pages at work: an order's costs on Livraisons, the call →
 * verify → paid walk on Vérification clients (with the stock leaving on
 * delivery and coming back on return), a lead created with its client,
 * and the audience the verified buyers describe in Rapports.
 */

const CLIENT: Contact = {
  id: "c1", type: "client", name: "Salma Bennani", ice: "", phone: "0661112233",
  email: "", city: "Tanger", balance: 0, birthYear: 1996, source: "facebook", channel: "whatsapp",
}
const CAMPAIGN: AdCampaign = { id: "camp1", name: "Meta Octobre", platform: "facebook", spend: 200, startedAt: "2026-10-01", endedAt: "" }
const ITEM: StockItem = {
  id: "s1", name: "Crème solaire", sku: "CRE-01", qty: 10, minQty: 2, unit: "pièce",
  assignedProjectId: null, type: "material", keywords: ["beauté"], costPrice: 40,
}

function seedOrder(patch: Partial<DeliveryOrder> = {}): DeliveryOrder {
  return {
    id: "o1", clientId: "c1", campaignId: "camp1", createdAt: "2026-10-01T09:00:00.000Z",
    items: [{ stockId: "s1", label: "Crème solaire", qty: 2, unitPrice: 150, unitCost: 40 }],
    deliveryCost: 30, packagingCost: 5, otherFees: 5, amountPaid: 0,
    verificationStatus: "new", deliveryStatus: "pending", callAttempts: 0,
    firstCallAt: null, verifiedAt: null, paidAt: null, shippedAt: null, deliveredAt: null,
    stockDeducted: false, notes: "", ...patch,
  }
}

beforeEach(() => {
  localStorage.clear()
  useMizan.getState().signOut()
  useMizan.getState().signIn("Karim Benjelloun", "karim@atlas.ma", "owner", "delivery-user")
  useMizan.setState({ contacts: [{ ...CLIENT }], stock: [{ ...ITEM }], campaigns: [{ ...CAMPAIGN }], orders: [], projects: [], verificationTeam: { name: "", members: [] }, verificationCalls: [] })
})

describe("on Livraisons", () => {
  it("shows the order with every cost, and the campaign's cost per verified client", () => {
    useMizan.setState({
      orders: [seedOrder({
        verificationStatus: "verified", firstCallAt: "2026-10-01T10:00:00.000Z", verifiedAt: "2026-10-01T12:00:00.000Z", amountPaid: 300,
      })],
    })
    render(<Delivery />)

    expect(screen.getByText("Salma Bennani")).toBeTruthy()
    expect(screen.getByText("Coût / client vérifié")).toBeTruthy()
    // 200 MAD of ads, one verified client: she cost 200 to win.
    const [order] = useMizan.getState().orders
    expect(order.verificationStatus).toBe("verified")

    // Delivering takes the two sold pieces out of the stock; a return puts them back.
    fireEvent.change(screen.getByLabelText("Livraison: Salma Bennani"), { target: { value: "delivered" } })
    expect(useMizan.getState().stock[0].qty).toBe(8)
    fireEvent.change(screen.getByLabelText("Livraison: Salma Bennani"), { target: { value: "returned" } })
    expect(useMizan.getState().stock[0].qty).toBe(10)
  })

  it("creates an order from stock: the product cost comes with the article", () => {
    render(<Delivery />)
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle commande/ }))
    fireEvent.change(screen.getByLabelText("Produit 1"), { target: { value: "s1" } })
    expect((screen.getByLabelText("Désignation 1") as HTMLInputElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Désignation 1"), { target: { value: "Article inventé" } })
    fireEvent.change(screen.getByLabelText("Prix de vente 1"), { target: { value: "150" } })
    fireEvent.change(screen.getByLabelText("Coût de livraison"), { target: { value: "30" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la commande" }))

    const [order] = useMizan.getState().orders
    expect(order).toMatchObject({ clientId: "c1", deliveryCost: 30, verificationStatus: "new" })
    expect(order.items[0]).toMatchObject({ stockId: "s1", label: "Crème solaire", qty: 1, unitPrice: 150, unitCost: 40 })
  })
})

describe("on Vérification clients", () => {
  it("walks a lead from call to verified to paid, stamping each stage", () => {
    useMizan.setState({ orders: [seedOrder()] })
    render(<Verification />)

    fireEvent.click(screen.getByRole("button", { name: "Appelé" }))
    let [order] = useMizan.getState().orders
    expect(order).toMatchObject({ verificationStatus: "calling", callAttempts: 1 })
    expect(order.firstCallAt).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Vérifier" }))
    ;[order] = useMizan.getState().orders
    expect(order.verificationStatus).toBe("verified")
    expect(order.verifiedAt).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Marquer payé" }))
    ;[order] = useMizan.getState().orders
    expect(order.amountPaid).toBe(300)
    expect(order.paidAt).toBeTruthy()

    expect(useMizan.getState().verificationCalls.map((call) => call.outcome)).toEqual(["verified", "called"])
    expect(screen.getAllByText("Appelé").length).toBeGreaterThan(1)

    // And the cost table knows what she cost: 80 products + 40 fulfilment + 200 ads.
    expect(screen.getByText("Ce que chaque client nous a coûté")).toBeTruthy()
  })

  it("sets up a verification team and attributes every outcome to the selected caller", () => {
    useMizan.setState({ orders: [seedOrder()] })
    render(<Verification />)

    fireEvent.change(screen.getByLabelText("Nom de la société ou de l'équipe"), { target: { value: "North Verification" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le nom" }))
    fireEvent.change(screen.getByLabelText("Nom du membre"), { target: { value: "Sara" } })
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un membre" }))

    expect(useMizan.getState().verificationTeam).toMatchObject({ name: "North Verification", members: [{ name: "Sara" }] })
    expect((screen.getByLabelText("Attribuer les prochains appels à", { exact: false }) as HTMLSelectElement).value).not.toBe("")
    fireEvent.click(screen.getByRole("button", { name: "Sans réponse" }))
    fireEvent.click(screen.getByRole("button", { name: "Vérifier" }))

    expect(useMizan.getState().orders[0]).toMatchObject({ verificationStatus: "verified", callAttempts: 2 })
    expect(useMizan.getState().verificationCalls.map((call) => ({ agentName: call.agentName, outcome: call.outcome, clientName: call.clientName }))).toEqual([
      { agentName: "Sara", outcome: "verified", clientName: "Salma Bennani" },
      { agentName: "Sara", outcome: "no_answer", clientName: "Salma Bennani" },
    ])
    expect(screen.getAllByText("50%").length).toBeGreaterThan(0)
    expect(screen.getByText("Historique des appels par client")).toBeDefined()
    expect(screen.getAllByText("Sans réponse").length).toBeGreaterThan(1)
    expect((screen.getByLabelText("Nom de la société ou de l'équipe") as HTMLInputElement).value).toBe("North Verification")
  })

  it("creates a lead together with its new client", () => {
    render(<Verification />)
    fireEvent.click(screen.getByRole("button", { name: /Nouveau lead/ }))
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: "__new" } })
    fireEvent.change(screen.getByLabelText("Nom du client"), { target: { value: "Nadia Alaoui" } })
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: "Agadir" } })
    fireEvent.change(screen.getByLabelText("Désignation 1"), { target: { value: "Huile d'argan" } })
    fireEvent.change(screen.getByLabelText("Prix de vente 1"), { target: { value: "200" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la commande" }))

    const state = useMizan.getState()
    const created = state.contacts.find((c) => c.name === "Nadia Alaoui")
    expect(created).toMatchObject({ type: "client", city: "Agadir" })
    expect(state.orders[0].clientId).toBe(created?.id)
    expect(state.orders[0].items[0]).toMatchObject({ label: "Huile d'argan", stockId: null })
  })
})

describe("the audience in Rapports", () => {
  it("describes the verified buyers and what they cost to win", () => {
    useMizan.setState({
      orders: [seedOrder({
        verificationStatus: "verified", firstCallAt: "2026-10-01T10:00:00.000Z", verifiedAt: "2026-10-01T12:00:00.000Z", amountPaid: 300,
      })],
    })
    render(<Reports />)
    expect(screen.getByText("Audience cible & acquisition")).toBeTruthy()
    expect(screen.getByText("Meta Octobre")).toBeTruthy()
    expect(screen.getAllByText("Tanger").length).toBeGreaterThan(0)
    expect(screen.getByText("beauté")).toBeTruthy()
  })
})
