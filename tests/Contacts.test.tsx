import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it } from "vitest"
import Contacts from "../src/modules/Contacts"
import { useMizan } from "../src/store/useMizan"
import { useLanguageStore } from "../src/lib/language/store"

const csv = "Nom,Type,ICE,Téléphone,Email,Ville,Solde\nPrivate imported client,client,,,,Tanger,-19.50"
function pendingFile() {
  let resolve!: (text: string) => void
  const result = new Promise<string>((done) => { resolve = done })
  const file = new File([""], "contacts.csv", { type: "text/csv" })
  Object.defineProperty(file, "text", { value: () => result })
  return { file, resolve }
}
function upload(container: HTMLElement, file: File) {
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } })
}
beforeEach(() => {
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("A", "a@gmail.com", "owner", "import-a")
})

it("does not attach an in-flight account A import to account B after a session changes", async () => {
  const view = render(<Contacts />)
  const work = pendingFile()
  upload(view.container, work.file)
  act(() => useMizan.getState().signIn("B", "b@gmail.com", "owner", "import-b"))
  await act(async () => { work.resolve(csv) })
  expect(useMizan.getState().contacts.some((c) => c.name === "Private imported client")).toBe(false)
})

it("cancels a pending CSV import when leaving its page", async () => {
  const view = render(<Contacts />)
  const work = pendingFile()
  upload(view.container, work.file)
  view.unmount()
  await act(async () => { work.resolve(csv) })
  expect(useMizan.getState().contacts.some((c) => c.name === "Private imported client")).toBe(false)
})

it("imports a real signed balance but rejects an invalid multi-row file atomically", async () => {
  const view = render(<Contacts />)
  const valid = pendingFile()
  upload(view.container, valid.file)
  await act(async () => { valid.resolve(csv) })
  expect(useMizan.getState().contacts[0]).toMatchObject({ name: "Private imported client", balance: -19.5 })
  const count = useMizan.getState().contacts.length
  const invalid = pendingFile()
  upload(view.container, invalid.file)
  await act(async () => { invalid.resolve(csv + "\nInvalid amount,client,,,,Rabat,1000000000000") })
  expect(useMizan.getState().contacts).toHaveLength(count)
  expect(screen.getByRole("alert").textContent).toContain("solde")
})


it("renders contact actions, table labels and the form in English", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  act(() => useMizan.setState({ contacts: [{ id: "contact-1", name: "Example Client", type: "client", ice: "ICE-1", phone: "+212600000000", email: "client@example.ma", city: "Tangier", balance: 120 }] }))
  render(<Contacts />)
  expect(screen.getByText("Clients & Suppliers")).toBeDefined()
  expect(screen.getByRole("button", { name: "Import CSV" })).toBeDefined()
  expect(screen.getByRole("button", { name: "Export" })).toBeDefined()
  expect(screen.getByLabelText("Search contacts")).toBeDefined()
  expect(screen.getByText("Balance")).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "Add" }))
  expect(screen.getByText("New contact")).toBeDefined()
  expect(screen.getByLabelText("Name / Company")).toBeDefined()
  expect(screen.getByRole("option", { name: "Supplier" })).toBeDefined()
})

it("includes verified delivery profit and unpaid order debit in the client balance and ledger", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  act(() => useMizan.setState({
    contacts: [{ id: "client-debt", name: "Salma Bennani", type: "client", ice: "ICE-1", phone: "", email: "", city: "Tangier", balance: 20 }],
    projects: [], contracts: [], stock: [], campaigns: [],
    orders: [{
      id: "order-debt", clientId: "client-debt", campaignId: null, createdAt: "2026-10-17T09:00:00.000Z",
      items: [{ stockId: null, label: "Huile d'argan", qty: 1, unitPrice: 200, unitCost: 20 }],
      deliveryCost: 10, packagingCost: 0, otherFees: 0, amountPaid: 80, verificationStatus: "verified", deliveryStatus: "pending",
      callAttempts: 0, firstCallAt: null, verifiedAt: "2026-10-17T09:05:00.000Z", paidAt: null, shippedAt: null, deliveredAt: null,
      stockDeducted: false, notes: "",
    }],
  }))
  render(<Contacts />)

  expect(screen.getByText(/140/)).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "Salma Bennani" }))
  expect(screen.getByText("Profit from confirmed orders")).toBeDefined()
  expect(screen.getByText("Unpaid order debit")).toBeDefined()
  expect(screen.getByText(/Huile d'argan/)).toBeDefined()
  expect(useMizan.getState().contacts[0].balance).toBe(20)
})

it("translates the contact form into Arabic and applies RTL", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  act(() => useMizan.setState({ contacts: [{ id: "contact-1", name: "Example Client", type: "client", ice: "ICE-1", phone: "+212600000000", email: "client@example.ma", city: "Tangier", balance: 120 }] }))
  render(<Contacts />)
  expect(screen.getByText("العملاء والموردون")).toBeDefined()
  expect(screen.getByRole("button", { name: "استيراد CSV" })).toBeDefined()
  expect(screen.getByLabelText("البحث في جهات الاتصال")).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "إضافة" }))
  expect(screen.getByText("جهة اتصال جديدة")).toBeDefined()
  expect(screen.getByLabelText("الاسم / اسم الشركة")).toBeDefined()
  expect(screen.getByRole("option", { name: "مورد" })).toBeDefined()
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})
