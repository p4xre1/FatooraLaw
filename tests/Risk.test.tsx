import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import Risk from "../src/modules/Risk"
import { useLanguageStore } from "../src/lib/language/store"
import { useMizan } from "../src/store/useMizan"
import type { Contact, DeliveryOrder, StockItem } from "../src/store/types"

const CLIENT: Contact = {
  id: "risk-client", type: "client", name: "Nadia Alaoui", ice: "", phone: "", email: "", city: "Tanger", balance: 0,
}
const STOCK: StockItem = {
  id: "risk-stock", name: "Huile d'argan", sku: "ARG-01", qty: 0, minQty: 3, unit: "bouteilles",
  assignedProjectId: null, type: "material",
}
const ORDER: DeliveryOrder = {
  id: "risk-order", clientId: CLIENT.id, campaignId: null, createdAt: "2026-10-01T09:00:00.000Z",
  items: [{ stockId: null, label: "Huile d'argan", qty: 1, unitPrice: 200, unitCost: 80 }],
  deliveryCost: 0, packagingCost: 0, otherFees: 0, amountPaid: 50,
  verificationStatus: "verified", deliveryStatus: "pending", callAttempts: 1,
  firstCallAt: null, verifiedAt: "2026-10-02T09:00:00.000Z", paidAt: null, shippedAt: null, deliveredAt: null,
  stockDeducted: false, notes: "",
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 17, 12))
  localStorage.clear()
  act(() => useLanguageStore.getState().setLanguage("fr"))
  useMizan.setState({
    calendarEvents: [], stock: [], orders: [], campaigns: [], contacts: [], projects: [], tools: [],
  })
})

afterEach(() => vi.useRealTimers())

it("shows an honest empty state instead of fabricated legal and tax risks", () => {
  render(<Risk />)

  expect(screen.getByText("Gestion des Risques")).toBeDefined()
  expect(screen.getByRole("note").textContent).toContain("n'identifient aucune obligation juridique ou fiscale")
  expect(screen.getByText("Aucune alerte opérationnelle ne correspond aux dossiers et filtres sélectionnés.")).toBeDefined()
  expect(screen.queryByText("Déclaration TVA — T3 2026")).toBeNull()
  expect(screen.getByLabelText("Rechercher des alertes opérationnelles")).toBeDefined()
})

it("renders alerts from saved calendar, stock, and unpaid-order records and supports search and filters", () => {
  useMizan.setState({
    calendarEvents: [{ id: "meeting", title: "Préparer le dossier comptable", date: "2026-10-20", kind: "deadline", note: "Apporter les reçus" }],
    stock: [{ ...STOCK }], contacts: [{ ...CLIENT }], orders: [{ ...ORDER }],
  })
  render(<Risk />)

  expect(screen.getByText("Préparer le dossier comptable")).toBeDefined()
  expect(screen.getByText("Huile d'argan")).toBeDefined()
  expect(screen.getByText(/Il reste 150/)).toBeDefined()
  expect(screen.getByText("Échéance du calendrier")).toBeDefined()
  expect(screen.getByText("Stock")).toBeDefined()
  expect(screen.getByText("Créance client")).toBeDefined()

  fireEvent.change(screen.getByLabelText("Rechercher des alertes opérationnelles"), { target: { value: "Huile d'argan" } })
  expect(screen.getByText("Huile d'argan")).toBeDefined()
  expect(screen.queryByText("Préparer le dossier comptable")).toBeNull()

  fireEvent.change(screen.getByLabelText("Rechercher des alertes opérationnelles"), { target: { value: "" } })
  fireEvent.click(screen.getByRole("button", { name: "Urgent" }))
  expect(screen.getByText("Huile d'argan")).toBeDefined()
  expect(screen.queryByText("Préparer le dossier comptable")).toBeNull()
})

it("localizes the record-derived alert labels and copy in English", () => {
  useMizan.setState({ calendarEvents: [{ id: "deadline-en", title: "Client documents", date: "2026-10-20", kind: "deadline", note: "" }] })
  act(() => useLanguageStore.getState().setLanguage("en"))
  render(<Risk />)

  expect(screen.getByText("Risk Management")).toBeDefined()
  expect(screen.getByRole("note").textContent).toContain("do not identify legal or tax obligations")
  expect(screen.getByText("Client documents")).toBeDefined()
  expect(screen.getByText("Calendar deadline")).toBeDefined()
  expect(screen.getByText("Your calendar deadline is in 3 day(s).")).toBeDefined()
  expect(screen.getByLabelText("Search operational alerts")).toBeDefined()
})

it("localizes record-derived alert copy into Arabic and sets the document RTL", () => {
  useMizan.setState({ calendarEvents: [{ id: "deadline-ar", title: "موعد مراجعة الفواتير", date: "2026-10-20", kind: "deadline", note: "" }] })
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<Risk />)

  expect(screen.getByText("إدارة المخاطر")).toBeDefined()
  expect(screen.getByRole("note").textContent).toContain("لا تحدد الالتزامات القانونية أو الضريبية")
  expect(screen.getByText("موعد مراجعة الفواتير")).toBeDefined()
  expect(screen.getByText("موعد في التقويم")).toBeDefined()
  expect(screen.getByLabelText("البحث في التنبيهات التشغيلية")).toBeDefined()
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})
