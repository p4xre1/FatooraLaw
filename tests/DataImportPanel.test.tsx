import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import DataImportPanel from "../src/components/DataImportPanel"
import { useMizan } from "../src/store/useMizan"
import { useLanguageStore } from "../src/lib/language/store"

const csv = "Name,Type,ICE,Phone,Email,City,Balance\nImported Alice,client,,0123456789,alice@example.com,Tanger,-19.50"

function file(text = csv, name = "contacts.csv") {
  const value = new File([text], name, { type: "text/csv" })
  Object.defineProperty(value, "text", { value: async () => text, configurable: true })
  return value
}
async function upload(value = file()) {
  await act(async () => { fireEvent.change(screen.getByLabelText("Choose CSV file"), { target: { files: [value] } }) })
}
function chooseDataset(label: string) {
  fireEvent.change(screen.getByLabelText("Type of data"), { target: { value: label } })
}

beforeEach(() => {
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("A", "a@example.com", "owner", "data-import-a")
  useMizan.setState({ contacts: [{ id: "old", name: "Existing", type: "client", phone: "", email: "", city: "", ice: "", balance: 0 }] })
  useLanguageStore.getState().setLanguage("en")
})

it("offers every record type and the template of the chosen one", () => {
  render(<DataImportPanel />)
  const picker = screen.getByLabelText("Type of data") as HTMLSelectElement
  expect([...picker.options].map((option) => option.value)).toEqual([
    "contacts", "projects", "expenses", "stock", "orders", "campaigns", "contracts", "team", "tools",
  ])
  expect(screen.getByRole("button", { name: /Download template · Clients & suppliers/ })).toBeDefined()
  chooseDataset("stock")
  expect(screen.getByRole("button", { name: /Download template · Stock articles/ })).toBeDefined()
  expect(screen.getByText(/Name\*, SKU, Qty/)).toBeDefined()
})

it("previews contacts without importing until confirmation", async () => {
  render(<DataImportPanel />)
  await upload()
  expect(screen.getByText("Imported Alice")).toBeDefined()
  expect(useMizan.getState().contacts).toHaveLength(1)
  fireEvent.click(screen.getByRole("button", { name: "Confirm import" }))
  expect(useMizan.getState().contacts).toHaveLength(2)
  expect(useMizan.getState().contacts.some((c) => c.id === "old")).toBe(true)
  expect(screen.getByRole("status").textContent).toContain("Imported 1 records")
  await upload()
  expect(screen.getByRole("status").textContent).toContain("1 exact duplicates skipped")
  expect(screen.queryByRole("button", { name: "Confirm import" })).toBeNull()
})

it("imports a different record type without touching the others", async () => {
  render(<DataImportPanel />)
  chooseDataset("tools")
  await upload(file("Name,Monthly cost,Start,Expiry\nAdobe CC,299,2026-01-01,2026-12-31", "tools.csv"))
  expect(screen.getByText("Adobe CC")).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "Confirm import" }))
  expect(useMizan.getState().tools).toMatchObject([{ name: "Adobe CC", cost: 299, expiry: "2026-12-31" }])
  expect(useMizan.getState().contacts).toHaveLength(1)
})

it("creates the clients an orders file mentions, in the same confirmation", async () => {
  render(<DataImportPanel />)
  chooseDataset("orders")
  await upload(file("Client,Phone,City,Product,Qty,Unit price,Delivery\nNadia,0600112233,Tétouan,Table,1,500,livré", "orders.csv"))
  expect(screen.getByText("1 new clients will be created from these orders.")).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "Confirm import" }))
  const state = useMizan.getState()
  expect(state.orders).toHaveLength(1)
  expect(state.contacts).toHaveLength(2)
  expect(state.contacts.some((contact) => contact.id === state.orders[0].clientId)).toBe(true)
})

it("drops the preview when the record type changes", async () => {
  render(<DataImportPanel />)
  await upload()
  expect(screen.getByText("Imported Alice")).toBeDefined()
  chooseDataset("projects")
  expect(screen.queryByText("Imported Alice")).toBeNull()
  expect(screen.queryByRole("button", { name: "Confirm import" })).toBeNull()
})

it("cancels a preview without changing the workspace", async () => {
  render(<DataImportPanel />)
  await upload()
  fireEvent.click(screen.getByRole("button", { name: "Cancel import" }))
  expect(screen.queryByText("Imported Alice")).toBeNull()
  expect(useMizan.getState().contacts).toHaveLength(1)
})

it("validates the entire file before offering confirmation", async () => {
  render(<DataImportPanel />)
  await upload(file(csv + "\nBad,supplier,,,,,oops"))
  expect(screen.getByRole("alert").textContent).toContain("Row 3")
  expect(screen.getByRole("alert").textContent).toContain("Balance")
  expect(screen.queryByRole("button", { name: "Confirm import" })).toBeNull()
  expect(useMizan.getState().contacts).toHaveLength(1)
})

it("names the columns a file is missing", async () => {
  render(<DataImportPanel />)
  chooseDataset("orders")
  await upload(file("Produit,Quantité\nTable,2", "orders.csv"))
  expect(screen.getByRole("alert").textContent).toContain("Client*")
})

it("does not read a file larger than 2 MB", async () => {
  render(<DataImportPanel />)
  const value = file()
  const read = vi.fn()
  Object.defineProperty(value, "text", { value: read })
  Object.defineProperty(value, "size", { value: 2 * 1024 * 1024 + 1 })
  await upload(value)
  expect(read).not.toHaveBeenCalled()
  expect(screen.getByRole("alert").textContent).toContain("2 MB")
})

it("rejects XLSX files with instructions to choose CSV instead", async () => {
  render(<DataImportPanel />)
  await upload(new File(["not csv"], "contacts.xlsx"))
  expect(screen.getByRole("alert").textContent).toContain("CSV")
  expect(useMizan.getState().contacts).toHaveLength(1)
})

it("discards an in-flight file when switching accounts", async () => {
  render(<DataImportPanel />)
  let finish!: (value: string) => void
  const value = new File([""], "contacts.csv", { type: "text/csv" })
  Object.defineProperty(value, "text", { value: () => new Promise<string>((resolve) => { finish = resolve }) })
  await upload(value)
  act(() => useMizan.getState().signIn("B", "b@example.com", "owner", "data-import-b"))
  await act(async () => { finish(csv) })
  expect(screen.queryByText("Imported Alice")).toBeNull()
  expect(useMizan.getState().contacts.some((c) => c.name === "Imported Alice")).toBe(false)
})

it("cancels an in-flight read when leaving Settings", async () => {
  const view = render(<DataImportPanel />)
  let finish!: (value: string) => void
  const value = new File([""], "contacts.csv", { type: "text/csv" })
  Object.defineProperty(value, "text", { value: () => new Promise<string>((resolve) => { finish = resolve }) })
  await upload(value)
  view.unmount()
  await act(async () => { finish(csv) })
  expect(useMizan.getState().contacts).toHaveLength(1)
})

it("shows a storage failure warning instead of claiming records were saved", async () => {
  render(<DataImportPanel />)
  await upload()
  const original = Storage.prototype.setItem
  const broken = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key.includes("mizan.store.v2")) throw new DOMException("Full", "QuotaExceededError")
    return original.call(this, key, value)
  })
  fireEvent.click(screen.getByRole("button", { name: "Confirm import" }))
  broken.mockRestore()
  expect(useMizan.getState().contacts.some((c) => c.name === "Imported Alice")).toBe(true)
  expect(screen.queryByRole("status")).toBeNull()
  expect(screen.getByRole("alert").textContent).toContain("could not save")
})

it("translates the panel, including the record types", () => {
  act(() => useLanguageStore.getState().setLanguage("fr"))
  render(<DataImportPanel />)
  expect(screen.getByText("Importer vos données (CSV)")).toBeDefined()
  expect(screen.getByLabelText("Choisir le fichier CSV")).toBeDefined()
  act(() => useLanguageStore.getState().setLanguage("ar"))
  expect(screen.getByText("استيراد بياناتك (CSV)")).toBeDefined()
})
