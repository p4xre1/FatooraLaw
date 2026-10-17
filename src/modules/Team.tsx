import { useState } from "react"
import { UserPlus, Mail, ShieldCheck } from "lucide-react"
import type { Role, TeamMember, ModuleKey } from "../store/types"
import { useMizan } from "../store/useMizan"
import { roleTints } from "../lib/mizan"
import { rolePermissions } from "../lib/permissions"
import { NAV } from "../components/nav"
import { useTranslation } from "../lib/language/store"
import { Card, SectionTitle, Btn, Modal, Field, Input, Select, Toggle } from "../components/kit"

/** Module order for the permission grid, taken from the navigation order. */
const MODULE_KEYS: ModuleKey[] = NAV.map((n) => n.key)

/** The roles a new member can be given; `owner` is never assignable here. */
const ASSIGNABLE_ROLES: Role[] = ["accountant", "supervisor", "assistant"]

export default function Team() {
  const { team, inviteMember, toggleMemberActive, setPermission, setMemberRole } = useMizan()
  const { t: copy } = useTranslation()
  const t = copy.team
  const { modules, roles } = copy.shared
  const [inviting, setInviting] = useState(false)

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title={t.title} sub={t.subtitle(team.filter((m) => m.active).length)} action={<Btn onClick={() => setInviting(true)}><UserPlus className="h-4 w-4" /> {t.invite}</Btn>} />

      <div className="space-y-4">
        {team.map((m) => (
          <Card key={m.id} className={`p-5 ${m.active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-navy text-[13px] font-bold text-white">{m.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-bold text-ink">{m.name}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${roleTints[m.role]}`}><ShieldCheck className="h-3 w-3" /> {roles[m.role]}</span>
                  {!m.active && <span className="rounded-full bg-serious-50 px-2 py-0.5 text-[11px] font-semibold text-serious ring-1 ring-inset ring-serious/20">{t.deactivated}</span>}
                </div>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-muted"><Mail className="h-3.5 w-3.5" /> {m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={m.role} onChange={(e) => setMemberRole(m.id, e.target.value as Role)} className="w-auto py-1.5 text-[12px]" disabled={m.role === "owner"}>
                  {(Object.keys(roles) as Role[]).map((r) => <option key={r} value={r}>{roles[r]}</option>)}
                </Select>
                <Btn variant={m.active ? "outline" : "emerald"} size="sm" onClick={() => toggleMemberActive(m.id)} disabled={m.role === "owner"}>
                  {m.active ? t.deactivate : t.reactivate}
                </Btn>
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.accessByModule}</p>
              <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {MODULE_KEYS.map((key) => (
                  <label key={key} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className={m.permissions[key] ? "font-medium text-ink" : "text-muted"}>{modules[key]}</span>
                    <Toggle checked={!!m.permissions[key]} onChange={(v) => setPermission(m.id, key, v)} />
                  </label>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {inviting && <Invite onClose={() => setInviting(false)} onInvite={(m) => { inviteMember(m); setInviting(false) }} />}
    </div>
  )
}

function Invite({ onClose, onInvite }: { onClose: () => void; onInvite: (m: Omit<TeamMember, "id">) => void }) {
  const { t: copy } = useTranslation()
  const t = copy.team
  const { roles } = copy.shared
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("assistant")
  return (
    <Modal title={t.invite} onClose={onClose}>
      <div className="space-y-4">
        <Field label={t.fullName}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t.email} hint={t.emailHint}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPlaceholder} /></Field>
        <Field label={t.role}><Select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{roles[r]}</option>)}</Select></Field>
        <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-[12px] font-medium text-brand-700"><ShieldCheck className="h-4 w-4" /> {t.roleDefaults}</div>
        <Btn className="w-full" disabled={!name.trim() || !email.trim()} onClick={() => onInvite({ name, email, role, active: true, permissions: rolePermissions(role) })}>
          <UserPlus className="h-4 w-4" /> {t.addMember}
        </Btn>
      </div>
    </Modal>
  )
}
