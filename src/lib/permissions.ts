import type { ModuleKey, TeamMember } from "../store/types"
import type { Auth } from "../store/useMizan"
import { perms } from "../store/seed"

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
