import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import ContactImportPanel from "../src/components/ContactImportPanel"
import { useMizan } from "../src/store/useMizan"
import { useLanguageStore } from "../src/lib/language/store"
const csv = "Name,Type,ICE,Phone,Email,City,Balance\nImported Alice,client,,0123456789,alice@example.com,Tanger,-19.50"
function file(text = csv) {
  const value = new File([text], "contacts.csv", { type: "text/csv" })
  Object.defineProperty(value, "text", { value: async () => text, configurable: true })
  return value
}
async function upload(value = file()) {
  await act(async () => { fireEvent.change(screen.getByLabelText("Choose contacts CSV"), { target: { files: [value] } }) })
}
beforeEach(() => {
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("A", "a@example.com", "owner", "contact-import-a")
  useMizan.setState({ contacts: [{ id: "old", name: "Existing", type: "client", phone: "", email: "", city: "", ice: "", balance: 0 }] })
  useLanguageStore.getState().setLanguage("en")
})
it("shows instructions and previews without importing until confirmation", async () => {
  render(<ContactImportPanel />)
  expect(screen.getByRole("button", { name: "Download contact template" })).toBeDefined()
  await upload()
  expect(screen.getByText("Imported Alice")).toBeDefined()
  expect(useMizan.getState().contacts).toHaveLength(1)
  fireEvent.click(screen.getByRole("button", { name: "Confirm contact import" }))
  expect(useMizan.getState().contacts).toHaveLength(2)
  expect(useMizan.getState().contacts.some((c) => c.id === "old")).toBe(true)
  expect(screen.getByRole("status").textContent).toContain("Added 1 contacts")
  await upload()
  expect(screen.getByRole("status").textContent).toContain("1 exact duplicates skipped")
  expect(screen.queryByRole("button", { name: "Confirm contact import" })).toBeNull()
})
it("cancels a preview without changing contacts", async () => {
  render(<ContactImportPanel />)
  await upload()
  fireEvent.click(screen.getByRole("button", { name: "Cancel import" }))
  expect(screen.queryByText("Imported Alice")).toBeNull()
  expect(useMizan.getState().contacts).toHaveLength(1)
})
it("validates the entire file before offering confirmation", async () => {
  render(<ContactImportPanel />)
  await upload(file(csv + "\nBad,supplier,,,,,oops"))
  expect(screen.getByRole("alert").textContent).toContain("Row 3")
  expect(screen.queryByRole("button", { name: "Confirm contact import" })).toBeNull()
  expect(useMizan.getState().contacts).toHaveLength(1)
})
it("does not read a file larger than 2 MB", async () => {
  render(<ContactImportPanel />)
  const value = file()
  const read = vi.fn()
  Object.defineProperty(value, "text", { value: read })
  Object.defineProperty(value, "size", { value: 2 * 1024 * 1024 + 1 })
  await upload(value)
  expect(read).not.toHaveBeenCalled()
  expect(screen.getByRole("alert").textContent).toContain("2 MB")
})
it("discards an in-flight file when switching accounts", async () => {
  render(<ContactImportPanel />)
  let finish!: (value: string) => void
  const value = new File([""], "contacts.csv", { type: "text/csv" })
  Object.defineProperty(value, "text", { value: () => new Promise<string>((resolve) => { finish = resolve }) })
  await upload(value)
  act(() => useMizan.getState().signIn("B", "b@example.com", "owner", "contact-import-b"))
  await act(async () => { finish(csv) })
  expect(screen.queryByText("Imported Alice")).toBeNull()
  expect(useMizan.getState().contacts.some((c) => c.name === "Imported Alice")).toBe(false)
})
it("cancels an in-flight read when leaving Settings", async () => {
  const view = render(<ContactImportPanel />)
  let finish!: (value: string) => void
  const value = new File([""], "contacts.csv", { type: "text/csv" })
  Object.defineProperty(value, "text", { value: () => new Promise<string>((resolve) => { finish = resolve }) })
  await upload(value)
  view.unmount()
  await act(async () => { finish(csv) })
  expect(useMizan.getState().contacts).toHaveLength(1)
})
it("rejects XLSX files with instructions to choose CSV instead", async () => {
  render(<ContactImportPanel />)
  await upload(new File(["not csv"], "contacts.xlsx"))
  expect(screen.getByRole("alert").textContent).toContain("CSV")
  expect(useMizan.getState().contacts).toHaveLength(1)
})
it("shows a storage failure warning instead of claiming contacts were saved", async () => {
  render(<ContactImportPanel />)
  await upload()
  const original = Storage.prototype.setItem
  const broken = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key.includes("mizan.store.v2")) throw new DOMException("Full", "QuotaExceededError")
    return original.call(this, key, value)
  })
  fireEvent.click(screen.getByRole("button", { name: "Confirm contact import" }))
  broken.mockRestore()
  expect(useMizan.getState().contacts.some((c) => c.name === "Imported Alice")).toBe(true)
  expect(screen.queryByRole("status")).toBeNull()
  expect(screen.getByRole("alert").textContent).toContain("could not save")
})
