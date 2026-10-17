import { describe, expect, it } from "vitest"
import { topVerificationPerformer, verificationPerformance } from "../src/lib/verificationAnalytics"
import type { VerificationAgent, VerificationCall } from "../src/store/types"

const agents: VerificationAgent[] = [
  { id: "a1", name: "Sara" },
  { id: "a2", name: "Youssef" },
  { id: "a3", name: "New caller" },
]
const calls: VerificationCall[] = [
  { id: "c1", orderId: "o1", clientId: "p1", clientName: "Amina", agentId: "a1", agentName: "Sara", outcome: "called", calledAt: "2026-10-01T09:00:00.000Z" },
  { id: "c2", orderId: "o1", clientId: "p1", clientName: "Amina", agentId: "a1", agentName: "Sara", outcome: "no_answer", calledAt: "2026-10-01T10:00:00.000Z" },
  { id: "c3", orderId: "o1", clientId: "p1", clientName: "Amina", agentId: "a1", agentName: "Sara", outcome: "verified", calledAt: "2026-10-02T10:00:00.000Z" },
  { id: "c4", orderId: "o2", clientId: "p2", clientName: "Nadia", agentId: "a2", agentName: "Youssef", outcome: "refused", calledAt: "2026-10-02T11:00:00.000Z" },
  { id: "c5", orderId: "o3", clientId: "p3", clientName: "Imane", agentId: null, agentName: null, outcome: "no_answer", calledAt: "2026-10-02T12:00:00.000Z" },
]

describe("verification team performance", () => {
  it("counts outcomes per member and computes verified calls divided by all calls", () => {
    const rows = verificationPerformance(agents, calls)
    expect(rows.find((row) => row.agentId === "a1")).toMatchObject({ calls: 3, called: 1, noAnswer: 1, verified: 1, refused: 0, rate: 1 / 3 })
    expect(rows.find((row) => row.agentId === "a2")).toMatchObject({ calls: 1, refused: 1, rate: 0 })
    expect(rows.find((row) => row.agentId === "a3")).toMatchObject({ calls: 0, rate: null })
    expect(rows.find((row) => row.agentId === null)).toMatchObject({ name: null, calls: 1, noAnswer: 1, rate: 0 })
  })

  it("chooses the highest individual rate and excludes unassigned calls from the leaderboard", () => {
    const rows = verificationPerformance(agents, calls)
    expect(topVerificationPerformer(rows)).toMatchObject({ agentId: "a1", name: "Sara", rate: 1 / 3 })
    expect(topVerificationPerformer(verificationPerformance(agents, []))).toBeNull()
  })

  it("retains historical callers in the table after they are removed from the active roster", () => {
    const rows = verificationPerformance([], calls)
    expect(rows.find((row) => row.agentId === "a1")?.name).toBe("Sara")
    expect(rows.find((row) => row.agentId === "a2")?.name).toBe("Youssef")
  })
})
