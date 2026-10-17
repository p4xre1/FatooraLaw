import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import Invoices from "../src/modules/Invoices"
import { pendingInvoiceKey, requestInvoiceFromOrder, readPendingInvoicePrefill } from "../src/lib/invoiceHandoff"
import { useMizan } from "../src/store/useMizan"
import type { Contact, DeliveryOrder } from "../src/store/types"

const CLIENT: Contact = {
  id: "invoice-client", type: "client", name: "Salma Bennani", ice: "ICE-4455", phone: "", email: "", city: "Tanger", balance: 0,
}
const ORDER: DeliveryOrder = {
  id: "invoice-order", clientId: CLIENT.id, campaignId: null, createdAt: "2026-10-16T09:00:00.000Z",
  items: [{ stockId: null, label: "Crème solaire", qty: 2, unitPrice: 150, unitCost: 40 }],
  deliveryCost: 0, packagingCost: 0, otherFees: 0, amountPaid: 50,
  verificationStatus: "verified", deliveryStatus: "pending", callAttempts: 1,
  firstCallAt: null, verifiedAt: "2026-10-16T10:00:00.000Z", paidAt: null, shippedAt: null, deliveredAt: null,
  stockDeducted: false, notes: "",
}
const ACCOUNT_ID = "invoice-account"
const INVOICE_KEY = `fatorati.invoices.v1.${ACCOUNT_ID}`

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, "", "/")
  const settings = useMizan.getState().settings
  useMizan.setState({
    auth: { id: ACCOUNT_ID, name: "Invoice User", email: "invoice@example.test", role: "owner" },
    settings: { ...settings, company: "Atlas Atelier", currency: "EUR", taxRate: 20, logo: null },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, "", "/")
})

function openVerifiedOrderInvoice() {
  expect(requestInvoiceFromOrder({ ...ORDER, verificationStatus: "new" }, CLIENT, 20, ACCOUNT_ID)).toBe(false)
  expect(requestInvoiceFromOrder(ORDER, CLIENT, 20, ACCOUNT_ID)).toBe(true)
  expect(window.location.pathname).toBe("/invoices")
}

it("prefills the editable invoice with verified order and client details, and scopes the handoff by account", () => {
  openVerifiedOrderInvoice()

  expect(readPendingInvoicePrefill(ACCOUNT_ID)).toMatchObject({
    orderId: ORDER.id,
    issuedOn: "2026-10-16",
    taxRate: 20,
    amountPaid: 50,
    client: { name: "Salma Bennani", address: "Tanger", ice: "ICE-4455" },
    items: [{ description: "Crème solaire", quantity: 2, unitPriceTtc: 150 }],
  })
  expect(readPendingInvoicePrefill("another-account")).toBeNull()

  render(<Invoices />)
  expect((screen.getByLabelText("Client / raison sociale") as HTMLInputElement).value).toBe("Salma Bennani")
  expect((screen.getByLabelText("Adresse du client") as HTMLInputElement).value).toBe("Tanger")
  expect((screen.getByLabelText("ICE du client") as HTMLInputElement).value).toBe("ICE-4455")
  expect((screen.getByLabelText("Date d’émission") as HTMLInputElement).value).toBe("2026-10-16")
  expect((screen.getByLabelText("Description") as HTMLInputElement).value).toBe("Crème solaire")
  expect((screen.getByLabelText("Montant déjà encaissé") as HTMLInputElement).value).toBe("50")
  expect(screen.getByText("Salma Bennani")).toBeDefined()
  expect(document.getElementById("invoice-preview")?.textContent).toContain("€")
  expect(screen.getByText("Reste dû").closest("div")?.textContent).toMatch(/250/)
  expect(localStorage.getItem(pendingInvoiceKey(ACCOUNT_ID))).toBeNull()
})

it("lets the user add, edit, and remove invoice lines and recalculates the print preview totals", () => {
  openVerifiedOrderInvoice()
  render(<Invoices />)

  fireEvent.change(screen.getByLabelText("Montant déjà encaissé"), { target: { value: "60" } })
  fireEvent.click(screen.getByRole("button", { name: /Ajouter une ligne/ }))
  const descriptions = screen.getAllByLabelText("Description") as HTMLInputElement[]
  fireEvent.change(descriptions[1], { target: { value: "Service complémentaire" } })
  fireEvent.change(screen.getAllByLabelText("Quantité")[1], { target: { value: "3" } })
  fireEvent.change(screen.getAllByLabelText("Prix unitaire HT")[1], { target: { value: "100" } })
  fireEvent.change(screen.getAllByLabelText("TVA")[1], { target: { value: "10" } })
  fireEvent.click(screen.getAllByRole("button", { name: "Supprimer la ligne" })[0])

  expect(screen.getAllByLabelText("Description")).toHaveLength(1)
  expect(screen.getByText("Service complémentaire")).toBeDefined()
  expect(screen.getByText("Total TTC").closest("div")?.textContent).toMatch(/330/)
  expect(screen.getByText("Déjà encaissé").closest("div")?.textContent).toMatch(/60/)
  expect(screen.getByText("Reste dû").closest("div")?.textContent).toMatch(/270/)
})

it("exports the edited invoice through the browser's print-to-PDF preview", () => {
  openVerifiedOrderInvoice()
  render(<Invoices />)
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Edited order line" } })
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined)

  fireEvent.click(screen.getByRole("button", { name: "Exporter en PDF" }))

  expect(print).toHaveBeenCalledOnce()
  expect(document.getElementById("invoice-preview")).toBeTruthy()
  expect(screen.getByText("Edited order line")).toBeDefined()
  expect(screen.getByText("Total TTC")).toBeDefined()
  expect(screen.getByText("Déjà encaissé")).toBeDefined()
  expect(screen.getByText("Reste dû")).toBeDefined()
})

it("opens older saved invoices without a paid-amount field using a zero-paid fallback", () => {
  localStorage.setItem(INVOICE_KEY, JSON.stringify({
    invoice: { number: "FAC-2025-008", client: "Legacy client" },
    templates: [],
    savedInvoices: [{
      id: "legacy-invoice", savedAt: "2025-11-01T10:00:00.000Z", number: "FAC-2025-008", date: "2025-11-01", due: "", tp: "",
      client: "Legacy client", clientAddress: "Rabat", clientIce: "ICE-OLD", lines: [{ description: "Old service", quantity: 1, unitPrice: 100, vat: 20 }],
      payment: "Virement", color: "#176b62", logo: null, notes: "",
    }],
  }))
  render(<Invoices />)

  fireEvent.click(screen.getByRole("button", { name: "Ouvrir" }))
  expect((screen.getByLabelText("Montant déjà encaissé") as HTMLInputElement).value).toBe("0")
  expect(screen.getByText("Reste dû").closest("div")?.textContent).toMatch(/120/)
})
