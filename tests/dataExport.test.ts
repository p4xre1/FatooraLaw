import { describe, expect, it } from "vitest"
import { emptyBusinessData } from "../src/store/defaults"
import { selectedCsvRows } from "../src/lib/dataExport"
import { decryptString, encryptString } from "../src/lib/security/encryption"

describe("selected data exports", () => {
  it("combines selected sections into rows and excludes inline image payloads", () => {
    const data = emptyBusinessData()
    data.projects.push({
      id: "p1", name: "Project one", clientId: "c1", budget: 500, paid: 0, cost: 50,
      status: "active", progress: 10, start: "", end: "", milestones: [], equipmentIds: [],
    })
    data.contacts.push({ id: "c1", type: "client", name: "Amina", ice: "", phone: "", email: "", city: "Tangier", balance: 0 })
    data.settings.logo = "data:image/png;base64,private-image-data"
    const rows = selectedCsvRows(data, ["projects", "contacts", "settings"])
    expect(rows.map((row) => row.section)).toEqual(["projects", "contacts", "settings"])
    expect(rows[0].name).toBe("Project one")
    expect(JSON.stringify(rows)).not.toContain("private-image-data")
  })

  it("includes saved calendar events when that section is selected", () => {
    const data = emptyBusinessData()
    data.calendarEvents.push({ id: "event-1", title: "Supplier payment", date: "2026-11-04", kind: "deadline", note: "Send the transfer" })
    const rows = selectedCsvRows(data, ["calendarEvents"])
    expect(rows).toMatchObject([{ section: "calendarEvents", record_id: "event-1", title: "Supplier payment", date: "2026-11-04", kind: "deadline" }])
  })

  it("includes verification team setup and call outcomes in selectable CSV sections", () => {
    const data = emptyBusinessData()
    data.verificationTeam = { name: "North verification", members: [{ id: "agent-1", name: "Sara" }] }
    data.verificationCalls.push({
      id: "call-1", orderId: "order-1", clientId: "client-1", clientName: "Amina", agentId: "agent-1",
      agentName: "Sara", outcome: "verified", calledAt: "2026-11-04T10:30:00.000Z",
    })
    const teamRows = selectedCsvRows(data, ["verificationTeam"])
    const callRows = selectedCsvRows(data, ["verificationCalls"])
    expect(teamRows[0]).toMatchObject({ section: "verificationTeam", name: "North verification" })
    expect(callRows[0]).toMatchObject({ section: "verificationCalls", clientName: "Amina", agentName: "Sara", outcome: "verified" })
  })

  it("encrypts full backup data with the passphrase and rejects a wrong passphrase", async () => {
    const encrypted = await encryptString("sensitive business backup", "a-long-passphrase-123")
    await expect(decryptString(encrypted, "a-long-passphrase-123")).resolves.toBe("sensitive business backup")
    await expect(decryptString(encrypted, "wrong-passphrase-123")).rejects.toBeTruthy()
  })
})
