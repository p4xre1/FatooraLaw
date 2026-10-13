import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it } from "vitest"
import Contacts from "../src/modules/Contacts"
import { useMizan } from "../src/store/useMizan"

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
