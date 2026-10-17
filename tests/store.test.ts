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
  const clientId = useMizan.getState().addContact({ ...seedContacts[0], name: "A private client" })
  useMizan.getState().addCalendarEvent({ title: "A private deadline", date: "2026-10-20", kind: "deadline", note: "" })
  useMizan.getState().setVerificationTeamName("A verification team")
  const agentId = useMizan.getState().addVerificationAgent("A caller")
  useMizan.getState().addDeliveryOrder({
    clientId, campaignId: null, createdAt: "2026-10-20T08:00:00.000Z",
    items: [{ stockId: null, label: "Service", qty: 1, unitPrice: 100, unitCost: 0 }],
    deliveryCost: 0, packagingCost: 0, otherFees: 0, amountPaid: 0, verificationStatus: "new", deliveryStatus: "pending",
    callAttempts: 0, firstCallAt: null, verifiedAt: null, paidAt: null, shippedAt: null, deliveredAt: null, notes: "",
  })
  useMizan.getState().recordVerificationCall(useMizan.getState().orders[0].id, "no_answer", agentId)
  useMizan.getState().signIn("B", "b@example.com", "owner", accountB)
  expect(useMizan.getState().contacts.some((c) => c.name === "A private client")).toBe(false)
  expect(useMizan.getState().calendarEvents.some((event) => event.title === "A private deadline")).toBe(false)
  expect(useMizan.getState().verificationTeam.name).toBe("")
  expect(useMizan.getState().verificationCalls).toHaveLength(0)
  useMizan.getState().addContact({ ...seedContacts[0], name: "B private client" })
  useMizan.getState().signOut()
  expect(useMizan.getState().contacts.some((c) => c.name === "B private client")).toBe(false)
  useMizan.getState().signIn("A", "a@example.com", "owner", accountA)
  expect(useMizan.getState().contacts.some((c) => c.name === "A private client")).toBe(true)
  expect(useMizan.getState().contacts.some((c) => c.name === "B private client")).toBe(false)
  expect(useMizan.getState().calendarEvents.some((event) => event.title === "A private deadline")).toBe(true)
  expect(useMizan.getState().verificationTeam).toMatchObject({ name: "A verification team", members: [{ id: agentId, name: "A caller" }] })
  expect(useMizan.getState().verificationCalls).toMatchObject([{ clientName: "A private client", agentName: "A caller", outcome: "no_answer" }])
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
