import type { VerificationAgent, VerificationCall } from "../store/types"

export type VerificationAgentPerformance = {
  agentId: string | null
  name: string | null
  calls: number
  called: number
  noAnswer: number
  verified: number
  refused: number
  /** verified attempts divided by this agent's recorded call attempts. */
  rate: number | null
}

/** Counts only call records with an explicit outcome; never guesses old calls. */
export function verificationPerformance(
  agents: readonly VerificationAgent[],
  calls: readonly VerificationCall[],
): VerificationAgentPerformance[] {
  const rows = new Map<string, VerificationAgentPerformance>()
  const unassignedKey = "__unassigned__"
  const rowFor = (agentId: string | null, name: string | null) => {
    const key = agentId === null ? unassignedKey : `agent:${agentId}`
    let row = rows.get(key)
    if (!row) {
      row = { agentId, name, calls: 0, called: 0, noAnswer: 0, verified: 0, refused: 0, rate: null }
      rows.set(key, row)
    } else if (!row.name && name) {
      row.name = name
    }
    return row
  }

  for (const agent of agents) rowFor(agent.id, agent.name)
  for (const call of calls) {
    const row = rowFor(call.agentId, call.agentName)
    row.calls += 1
    if (call.outcome === "called") row.called += 1
    else if (call.outcome === "no_answer") row.noAnswer += 1
    else if (call.outcome === "verified") row.verified += 1
    else if (call.outcome === "refused") row.refused += 1
  }
  for (const row of rows.values()) {
    row.rate = row.calls > 0 ? row.verified / row.calls : null
  }

  return [...rows.values()].sort((a, b) => {
    if (a.agentId === null && b.agentId !== null) return 1
    if (a.agentId !== null && b.agentId === null) return -1
    return (b.rate ?? -1) - (a.rate ?? -1) || b.verified - a.verified || b.calls - a.calls || (a.name ?? "").localeCompare(b.name ?? "")
  })
}

export function topVerificationPerformer(rows: readonly VerificationAgentPerformance[]): VerificationAgentPerformance | null {
  return rows
    .filter((row) => row.agentId !== null && row.calls > 0 && row.rate !== null)
    .slice()
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.verified - a.verified || b.calls - a.calls || (a.name ?? "").localeCompare(b.name ?? ""))[0] ?? null
}
