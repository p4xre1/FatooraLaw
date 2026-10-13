import { beforeEach, expect, it } from "vitest"
import { accountStorageKey, useMizan } from "../src/store/useMizan"
import { seedContacts, seedTeam } from "../src/store/seed"

const accountA = "account-a"
const accountB = "account-b"
beforeEach(() => {
  useMizan.getState().signOut()
  localStorage.clear()
})

it("isolates each account's local records and restores them only for that account", () => {
  useMizan.getState().signIn("A", "a@example.com", "owner", accountA)
  useMizan.getState().addContact({ ...seedContacts[0], name: "A private client" })
  useMizan.getState().signIn("B", "b@example.com", "owner", accountB)
  expect(useMizan.getState().contacts.some((c) => c.name === "A private client")).toBe(false)
  useMizan.getState().addContact({ ...seedContacts[0], name: "B private client" })
  useMizan.getState().signOut()
  expect(useMizan.getState().contacts.some((c) => c.name === "B private client")).toBe(false)
  useMizan.getState().signIn("A", "a@example.com", "owner", accountA)
  expect(useMizan.getState().contacts.some((c) => c.name === "A private client")).toBe(true)
  expect(useMizan.getState().contacts.some((c) => c.name === "B private client")).toBe(false)
})

it("never persists or hydrates authentication", async () => {
  useMizan.getState().signIn("A", "a@example.com", "owner", accountA)
  const saved = JSON.parse(localStorage.getItem(accountStorageKey(accountA))!)
  expect(saved.state.auth).toBeUndefined()
  saved.state.auth = { id: accountB, name: "Fake", email: "fake@example.com", role: "owner" }
  localStorage.setItem(accountStorageKey(accountA), JSON.stringify(saved))
  await useMizan.persist.rehydrate()
  expect(useMizan.getState().auth).toBeNull()
})

it("preserves but does not silently reassign the legacy global store", () => {
  const legacy = JSON.stringify({ state: { contacts: [{ ...seedContacts[0], name: "Unassigned legacy client" }], auth: { email: "a@example.com" } } })
  localStorage.setItem("mizan.store.v1", legacy)
  useMizan.getState().signIn("A", "a@example.com", "owner", accountA)
  expect(useMizan.getState().contacts.some((c) => c.name === "Unassigned legacy client")).toBe(false)
  expect(localStorage.getItem("mizan.store.v1")).toBe(legacy)
})

it("does not leak the previous account's data if the next account's storage is corrupted", () => {
  useMizan.getState().signIn("A", "a@example.com", "owner", accountA)
  useMizan.getState().addContact({ ...seedContacts[0], name: "Private A" })
  localStorage.setItem(accountStorageKey(accountB), "not json")
  useMizan.getState().signIn("B", "b@example.com", "owner", accountB)
  expect(useMizan.getState().contacts.some((c) => c.name === "Private A")).toBe(false)
})

it("records team activation and deactivation in the correct direction", () => {
  useMizan.getState().signIn("A", "a@example.com", "owner", accountA)
  useMizan.setState({ team: structuredClone(seedTeam) })
  const member = useMizan.getState().team.find((m) => m.active && m.role !== "owner")!
  useMizan.getState().toggleMemberActive(member.id)
  expect(useMizan.getState().audit[0].action).toBe("a désactivé le compte")
  useMizan.getState().toggleMemberActive(member.id)
  expect(useMizan.getState().audit[0].action).toBe("a réactivé le compte")
})
