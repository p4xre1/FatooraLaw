import type { ModuleKey, Role, TeamMember } from "../store/types"
import type { Auth } from "../store/useMizan"
import { MODULE_KEYS, perms } from "../store/seed"

/**
 * The modules a role starts with.
 *
 * One table, because a member can arrive two ways — invited from the Team
 * screen or imported from a CSV in Settings — and an imported accountant must
 * not end up with different access from an invited one.
 */
export const ROLE_MODULES: Record<Role, ModuleKey[]> = {
  owner: [...MODULE_KEYS],
  accountant: ["dashboard", "procurement", "reports", "contacts", "verification"],
  supervisor: ["dashboard", "projects", "inventory", "delivery", "verification"],
  assistant: ["dashboard", "contacts"],
}

export function rolePermissions(role: Role): Record<ModuleKey, boolean> {
  return perms(ROLE_MODULES[role])
}

/** Module visibility only. Database RLS, not this function, is access control. */
export function allowedModules(auth: Auth, team: TeamMember[]): Record<ModuleKey, boolean> {
  const none = perms([])
  if (!auth) return none
  const member = team.find((m) => m.email.trim().toLowerCase() === auth.email.trim().toLowerCase())
  if (member && !member.active) return none
  if (auth.role === "owner") {
    return Object.fromEntries(Object.keys(none).map((key) => [key, true])) as Record<ModuleKey, boolean>
  }
  if (!member) return none
  return Object.fromEntries(Object.keys(none).map((key) => [key, member.permissions[key as ModuleKey] === true])) as Record<ModuleKey, boolean>
}
