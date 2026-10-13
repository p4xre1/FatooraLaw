import { expect, it } from "vitest"
import { allowedModules } from "../src/lib/permissions"
import { seedTeam } from "../src/store/seed"

it("fails closed for unknown non-owner members and inactive members", () => {
  expect(Object.values(allowedModules({ id: "a", name: "Unknown", email: "unknown@example.com", role: "assistant" }, seedTeam)).some(Boolean)).toBe(false)
  expect(Object.values(allowedModules({ id: "b", name: "Inactive", email: "nadia@atlas.ma", role: "assistant" }, seedTeam)).some(Boolean)).toBe(false)
  expect(Object.values(allowedModules(null, seedTeam)).some(Boolean)).toBe(false)
})

it("matches emails case-insensitively and keeps missing permissions denied", () => {
  const allowed = allowedModules({ id: "a", name: "Salma", email: "SALMA@ATLAS.MA", role: "accountant" }, seedTeam)
  expect(allowed.reports).toBe(true)
  expect(allowed.team).toBe(false)
  expect(allowed.projects).toBe(false)
})

it("lets a workspace owner see all modules", () => {
  expect(Object.values(allowedModules({ id: "a", name: "Owner", email: "owner@example.com", role: "owner" }, seedTeam)).every(Boolean)).toBe(true)
})
