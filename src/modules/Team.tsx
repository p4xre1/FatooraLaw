import { useState } from "react"
import { UserPlus, Mail, ShieldCheck, Users } from "lucide-react"
import type { Role, TeamMember, ModuleKey } from "../store/types"
import { useMizan } from "../store/useMizan"
import { roleLabels, roleTints } from "../lib/mizan"
import { perms } from "../store/seed"
import { NAV } from "../components/nav"
import { Card, SectionTitle, Btn, Modal, Field, Input, Select, Toggle } from "../components/kit"

const MODULES: { key: ModuleKey; label: string }[] = NAV.map((n) => ({ key: n.key, label: n.label }))

export default function Team() {
  const { team, inviteMember, toggleMemberActive, setPermission, setMemberRole } = useMizan()
  const [inviting, setInviting] = useState(false)

  return (
    <div className="mz-view space-y-5">
      <SectionTitle title="Équipe & rôles" sub={`${team.filter((m) => m.active).length} membres actifs · permissions par module`} action={<Btn onClick={() => setInviting(true)}><UserPlus className="h-4 w-4" /> Inviter un membre</Btn>} />

      <div className="space-y-4">
        {team.map((m) => (
          <Card key={m.id} className={`p-5 ${m.active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-navy text-[13px] font-bold text-white">{m.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-bold text-ink">{m.name}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${roleTints[m.role]}`}><ShieldCheck className="h-3 w-3" /> {roleLabels[m.role]}</span>
                  {!m.active && <span className="rounded-full bg-serious-50 px-2 py-0.5 text-[11px] font-semibold text-serious ring-1 ring-inset ring-serious/20">Désactivé</span>}
                </div>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-muted"><Mail className="h-3.5 w-3.5" /> {m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={m.role} onChange={(e) => setMemberRole(m.id, e.target.value as Role)} className="w-auto py-1.5 text-[12px]" disabled={m.role === "owner"}>
                  {(Object.keys(roleLabels) as Role[]).map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                </Select>
                <Btn variant={m.active ? "outline" : "emerald"} size="sm" onClick={() => toggleMemberActive(m.id)} disabled={m.role === "owner"}>
                  {m.active ? "Désactiver" : "Réactiver"}
                </Btn>
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Accès par module</p>
              <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {MODULES.map((mod) => (
                  <label key={mod.key} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className={m.permissions[mod.key] ? "font-medium text-ink" : "text-muted"}>{mod.label}</span>
                    <Toggle checked={!!m.permissions[mod.key]} onChange={(v) => setPermission(m.id, mod.key, v)} />
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

const rolePresets: Record<Role, ModuleKey[]> = {
  owner: MODULES.map((m) => m.key),
  accountant: ["dashboard", "procurement", "reports", "contacts"],
  supervisor: ["dashboard", "projects", "inventory"],
  assistant: ["dashboard", "contacts"],
}

function Invite({ onClose, onInvite }: { onClose: () => void; onInvite: (m: Omit<TeamMember, "id">) => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("assistant")
  return (
    <Modal title="Inviter un membre" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nom complet"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" hint="Une invitation sera envoyée à cette adresse."><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@entreprise.ma" /></Field>
        <Field label="Rôle"><Select value={role} onChange={(e) => setRole(e.target.value as Role)}>{(["accountant", "supervisor", "assistant"] as Role[]).map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</Select></Field>
        <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-[12px] font-medium text-brand-700"><ShieldCheck className="h-4 w-4" /> Permissions par défaut appliquées selon le rôle.</div>
        <Btn className="w-full" disabled={!name.trim() || !email.trim()} onClick={() => onInvite({ name, email, role, active: true, permissions: perms(rolePresets[role]) })}>
          <UserPlus className="h-4 w-4" /> Envoyer l'invitation
        </Btn>
      </div>
    </Modal>
  )
}
