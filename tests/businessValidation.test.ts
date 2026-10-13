import { beforeEach, expect, it } from "vitest"
import { useMizan } from "../src/store/useMizan"
import { seedContacts, seedContracts, seedExpenses, seedProjects, seedStock } from "../src/store/seed"

beforeEach(() => {
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("Tester", "tester@example.com", "owner", "validation-account")
  useMizan.setState({ projects: structuredClone(seedProjects), contacts: structuredClone(seedContacts), stock: structuredClone(seedStock) })
})

it.each([-1, NaN, Infinity, Number.MAX_VALUE])("rejects an invalid expense amount (%s) before changing records", (amount) => {
  const count = useMizan.getState().expenses.length
  expect(() => useMizan.getState().addExpense({ ...seedExpenses[0], amount })).toThrow()
  expect(useMizan.getState().expenses).toHaveLength(count)
})

it("rejects invalid project budgets and invalid partial financial updates", () => {
  expect(() => useMizan.getState().addProject({ ...seedProjects[0], budget: -10 })).toThrow()
  const project = useMizan.getState().projects[0]
  expect(() => useMizan.getState().updateProject(project.id, { paid: NaN })).toThrow()
  expect(useMizan.getState().projects[0].paid).toBe(project.paid)
})

it("rejects invalid stock levels and non-finite adjustments", () => {
  expect(() => useMizan.getState().addStock({ ...seedStock[0], qty: -1 })).toThrow()
  expect(() => useMizan.getState().addStock({ ...seedStock[0], minQty: Infinity })).toThrow()
  const item = useMizan.getState().stock[0]
  expect(() => useMizan.getState().adjustStock(item.id, Infinity)).toThrow()
  expect(useMizan.getState().stock[0].qty).toBe(item.qty)
})

it("rejects a negative contract value", () => {
  expect(() => useMizan.getState().addContract({ ...seedContracts[0], value: -1 })).toThrow()
})

it.each([-1, 100.01, NaN, Infinity])("rejects an invalid tax rate (%s)", (taxRate) => {
  const previous = useMizan.getState().settings.taxRate
  expect(() => useMizan.getState().updateSettings({ taxRate })).toThrow()
  expect(useMizan.getState().settings.taxRate).toBe(previous)
})

it("allows legitimate negative balances but rejects non-finite balances atomically", () => {
  useMizan.getState().addContact({ ...seedContacts[0], balance: -25 })
  expect(useMizan.getState().contacts[0].balance).toBe(-25)
  const count = useMizan.getState().contacts.length
  expect(() => useMizan.getState().importContacts([
    { ...seedContacts[0], name: "Valid row", balance: 0 },
    { ...seedContacts[0], name: "Invalid row", balance: NaN },
  ])).toThrow()
  expect(useMizan.getState().contacts).toHaveLength(count)
})

it("accepts zero and bounded decimal amounts without replacing them with fallback values", () => {
  useMizan.getState().addExpense({ ...seedExpenses[0], amount: 0 })
  expect(useMizan.getState().expenses[0].amount).toBe(0)
  useMizan.getState().addProject({ ...seedProjects[0], budget: 19.5, cost: 2.25, paid: 0 })
  expect(useMizan.getState().projects[0]).toMatchObject({ budget: 19.5, cost: 2.25, paid: 0 })
  useMizan.getState().updateSettings({ taxRate: 0 })
  expect(useMizan.getState().settings.taxRate).toBe(0)
  useMizan.getState().updateSettings({ taxRate: 100 })
  expect(useMizan.getState().settings.taxRate).toBe(100)
})

it("rejects invalid contact updates before applying even the valid part of a patch", () => {
  const contact = useMizan.getState().contacts[0]
  expect(() => useMizan.getState().updateContact(contact.id, { name: "Should not apply", balance: Infinity })).toThrow()
  expect(useMizan.getState().contacts[0]).toEqual(contact)
  useMizan.getState().updateContact(contact.id, { balance: -19.5 })
  expect(useMizan.getState().contacts[0].balance).toBe(-19.5)
})

it("prevents a finite but oversized stock adjustment and a fractional or excessive progress value", () => {
  const item = useMizan.getState().stock[0]
  expect(() => useMizan.getState().adjustStock(item.id, 100_000_000_000)).toThrow()
  expect(useMizan.getState().stock[0].qty).toBe(item.qty)
  const project = useMizan.getState().projects[0]
  for (const progress of [-1, 100.1, 1.5, NaN]) {
    expect(() => useMizan.getState().updateProject(project.id, { progress })).toThrow()
    expect(useMizan.getState().projects[0].progress).toBe(project.progress)
  }
})


it("preserves legitimate multiline document notes when saving validated settings", () => {
  const headerNote = "First line\nSecond line " + "x".repeat(500)
  useMizan.getState().updateSettings({ headerNote, footerNote: "Legal note\nContact information", taxRate: 20 })
  expect(useMizan.getState().settings.headerNote).toBe(headerNote)
  expect(useMizan.getState().settings.footerNote).toBe("Legal note\nContact information")
})
