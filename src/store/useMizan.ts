import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  AuditEvent, Contact, Contract, Expense, ModuleKey, Project, Settings, Severity, StockItem, TeamMember, Role,
} from "./types"
import {
  seedAudit, seedContacts, seedContracts, seedExpenses, seedProjects, seedSettings, seedStock, seedTeam, uid,
} from "./seed"

/** Guard stored strings against XSS / injection before they enter state. */
export function sanitize(input: string): string {
  let out = ""
  for (const ch of String(input).replace(/[<>]/g, "")) {
    const code = ch.charCodeAt(0)
    if (code >= 32 && code !== 127) out += ch
  }
  return out.trim().slice(0, 400)
}

type Auth = { name: string; email: string; role: Role } | null

type State = {
  auth: Auth
  settings: Settings
  projects: Project[]
  contacts: Contact[]
  expenses: Expense[]
  stock: StockItem[]
  contracts: Contract[]
  team: TeamMember[]
  audit: AuditEvent[]

  signIn: (name: string, email: string, role?: Role) => void
  signOut: () => void

  log: (action: string, target: string, module: ModuleKey, severity?: Severity) => void

  addProject: (p: Omit<Project, "id">) => void
  updateProject: (id: string, patch: Partial<Project>) => void
  toggleMilestone: (projectId: string, milestoneId: string) => void

  addContact: (c: Omit<Contact, "id">) => void
  updateContact: (id: string, patch: Partial<Contact>) => void
  removeContact: (id: string) => void
  importContacts: (rows: Omit<Contact, "id">[]) => void

  addExpense: (e: Omit<Expense, "id">) => void
  setExpenseStatus: (id: string, status: Expense["status"]) => void
  removeExpense: (id: string) => void

  adjustStock: (id: string, delta: number) => void
  assignStock: (id: string, projectId: string | null) => void
  addStock: (s: Omit<StockItem, "id">) => void

  addContract: (c: Omit<Contract, "id">) => void
  setContractStatus: (id: string, status: Contract["status"]) => void

  inviteMember: (m: Omit<TeamMember, "id">) => void
  toggleMemberActive: (id: string) => void
  setPermission: (id: string, module: ModuleKey, value: boolean) => void
  setMemberRole: (id: string, role: Role) => void

  updateSettings: (patch: Partial<Settings>) => void
}

export const useMizan = create<State>()(
  persist(
    (set, get) => ({
      auth: null,
      settings: seedSettings,
      projects: seedProjects,
      contacts: seedContacts,
      expenses: seedExpenses,
      stock: seedStock,
      contracts: seedContracts,
      team: seedTeam,
      audit: seedAudit,

      signIn: (name, email, role = "owner") => {
        set({ auth: { name: sanitize(name), email: sanitize(email), role } })
        get().log("s'est connecté", "Session authentifiée", "settings", "info")
      },
      signOut: () => {
        get().log("s'est déconnecté", "Fin de session", "settings", "info")
        set({ auth: null })
      },

      log: (action, target, module, severity = "info") =>
        set((s) => ({
          audit: [
            { id: uid(), ts: Date.now(), actor: s.auth?.name ?? "Système", action, target, module, severity },
            ...s.audit,
          ].slice(0, 500),
        })),

      addProject: (p) => {
        const proj: Project = { ...p, id: uid(), name: sanitize(p.name) }
        set((s) => ({ projects: [proj, ...s.projects] }))
        get().log("a créé le projet", proj.name, "projects", "info")
      },
      updateProject: (id, patch) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      toggleMilestone: (pid, mid) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === pid
              ? { ...p, milestones: p.milestones.map((m) => (m.id === mid ? { ...m, done: !m.done } : m)) }
              : p,
          ),
        })),

      addContact: (c) => {
        const ct: Contact = { ...c, id: uid(), name: sanitize(c.name), email: sanitize(c.email), city: sanitize(c.city) }
        set((s) => ({ contacts: [ct, ...s.contacts] }))
        get().log("a ajouté", `${ct.type === "client" ? "Client" : "Fournisseur"} · ${ct.name}`, "contacts", "info")
      },
      updateContact: (id, patch) =>
        set((s) => ({ contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeContact: (id) => {
        const c = get().contacts.find((x) => x.id === id)
        set((s) => ({ contacts: s.contacts.filter((x) => x.id !== id) }))
        if (c) get().log("a supprimé", `Contact · ${c.name}`, "contacts", "critical")
      },
      importContacts: (rows) => {
        const items = rows.map((r) => ({ ...r, id: uid(), name: sanitize(r.name) }))
        set((s) => ({ contacts: [...items, ...s.contacts] }))
        get().log("a importé", `${items.length} contacts (CSV)`, "contacts", "warning")
      },

      addExpense: (e) => {
        const ex: Expense = { ...e, id: uid(), note: sanitize(e.note) }
        set((s) => ({ expenses: [ex, ...s.expenses] }))
        get().log("a enregistré une dépense", `${ex.note} (${ex.amount} MAD)`, "procurement", "info")
      },
      setExpenseStatus: (id, status) => {
        set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, status } : e)) }))
        const e = get().expenses.find((x) => x.id === id)
        if (e && status === "approved") get().log("a approuvé la dépense", `${e.note} (${e.amount} MAD)`, "procurement", "warning")
      },
      removeExpense: (id) => {
        const e = get().expenses.find((x) => x.id === id)
        set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) }))
        if (e) get().log("a supprimé une dépense", `${e.note} (${e.amount} MAD)`, "procurement", "critical")
      },

      adjustStock: (id, delta) => {
        set((s) => ({ stock: s.stock.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)) }))
        const i = get().stock.find((x) => x.id === id)
        if (i) get().log("a ajusté le stock", `${i.name} → ${i.qty} ${i.unit}`, "inventory", "info")
      },
      assignStock: (id, projectId) => {
        set((s) => ({ stock: s.stock.map((i) => (i.id === id ? { ...i, assignedProjectId: projectId } : i)) }))
        const i = get().stock.find((x) => x.id === id)
        if (i) get().log("a affecté le matériel", i.name, "inventory", "info")
      },
      addStock: (item) =>
        set((s) => ({ stock: [{ ...item, id: uid(), name: sanitize(item.name) }, ...s.stock] })),

      addContract: (c) => {
        const co: Contract = { ...c, id: uid(), title: sanitize(c.title) }
        set((s) => ({ contracts: [co, ...s.contracts] }))
        get().log("a généré un contrat", co.title, "legal", "warning")
      },
      setContractStatus: (id, status) => {
        set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? { ...c, status } : c)) }))
        const c = get().contracts.find((x) => x.id === id)
        if (c && status === "signed") get().log("a signé le contrat", c.title, "legal", "critical")
      },

      inviteMember: (m) => {
        const mem: TeamMember = { ...m, id: uid(), name: sanitize(m.name), email: sanitize(m.email) }
        set((s) => ({ team: [...s.team, mem] }))
        get().log("a invité un membre", `${mem.name} · ${mem.role}`, "team", "warning")
      },
      toggleMemberActive: (id) => {
        set((s) => ({ team: s.team.map((m) => (m.id === id ? { ...m, active: !m.active } : m)) }))
        const m = get().team.find((x) => x.id === id)
        if (m) get().log(m.active ? "a désactivé le compte" : "a réactivé le compte", m.name, "team", "critical")
      },
      setPermission: (id, module, value) =>
        set((s) => ({
          team: s.team.map((m) => (m.id === id ? { ...m, permissions: { ...m.permissions, [module]: value } } : m)),
        })),
      setMemberRole: (id, role) =>
        set((s) => ({ team: s.team.map((m) => (m.id === id ? { ...m, role } : m)) })),

      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }))
        get().log("a modifié les paramètres", "Configuration entreprise", "settings", "warning")
      },
    }),
    { name: "mizan.store.v1" },
  ),
)
