import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type {
  AuditEvent, Contact, Contract, Expense, ModuleKey, Project, Settings, Severity, StockItem, TeamMember, Role, SubscriptionTool,
} from "./types"
import { uid } from "./seed"
import { emptyBusinessData } from "./defaults"

import { MAX_QUANTITY, requireAmount, requireBalance, isTaxRate } from "../lib/businessValidation"
import { sanitizeKeywords } from "../lib/keywords"
import { validDateRange, calendarDay, dateFromDay } from "../lib/calendarDates"
import { validateLogoDataURL } from "../lib/logoValidation"
import { businessStorage } from "../lib/localSaveStatus"

/** Guard stored strings against XSS / injection before they enter state. */
export function sanitize(input: string): string {
  let out = ""
  for (const ch of String(input).replace(/[<>]/g, "")) {
    const code = ch.charCodeAt(0)
    if (code >= 32 && code !== 127) out += ch
  }
  return out.trim().slice(0, 400)
}

export type Auth = { id: string; name: string; email: string; role: Role } | null

type State = {
  auth: Auth
  settings: Settings
  projects: Project[]
  contacts: Contact[]
  expenses: Expense[]
  stock: StockItem[]
  contracts: Contract[]
  team: TeamMember[]
  tools: SubscriptionTool[]
  audit: AuditEvent[]

  signIn: (name: string, email: string, role: Role, userId: string) => void
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

  addTool: (tool: Omit<SubscriptionTool, "id">) => void
  removeTool: (id: string) => void

  updateSettings: (patch: Partial<Settings>) => void
}

type LocalData = Pick<State, "settings" | "projects" | "contacts" | "expenses" | "stock" | "contracts" | "team" | "tools" | "audit">

function initialData(): LocalData {
  return emptyBusinessData()
}

export function businessSnapshot(state: State): LocalData {
  const { settings, projects, contacts, expenses, stock, contracts, team, tools, audit } = state
  return { settings, projects, contacts, expenses, stock, contracts, team, tools, audit }
}

const SIGNED_OUT_STORAGE = "mizan.store.v2.signed-out"
export const accountStorageKey = (userId: string) => `mizan.store.v2.${encodeURIComponent(userId)}`

export const useMizan = create<State>()(
  persist(
    (set, get) => ({
      auth: null,
      ...initialData(),

      signIn: (name, email, role, userId) => {
        const previous = get().auth
        if (previous?.id !== userId) {
          // localStorage hydration is synchronous. Its merge resets missing
          // data to empty defaults, so a new account cannot inherit another account or demo records.
          useMizan.persist.setOptions({ name: SIGNED_OUT_STORAGE })
          set({ auth: null, ...initialData() })
          useMizan.persist.setOptions({ name: accountStorageKey(userId) })
          void useMizan.persist.rehydrate()
        }
        set({ auth: { id: userId, name: sanitize(name), email: sanitize(email), role } })
        if (previous?.id !== userId) get().log("s'est connecté", "Session authentifiée", "settings", "info")
      },
      signOut: () => {
        if (get().auth) get().log("s'est déconnecté", "Fin de session", "settings", "info")
        // Keep the account's saved records, but remove them from memory and
        // stop writing into that account's storage after logout.
        useMizan.persist.setOptions({ name: SIGNED_OUT_STORAGE })
        set({ auth: null, ...initialData() })
      },

      log: (action, target, module, severity = "info") =>
        set((s) => ({
          audit: [
            { id: uid(), ts: Date.now(), actor: s.auth?.name ?? "Système", action, target, module, severity },
            ...s.audit,
          ].slice(0, 500),
        })),

      addProject: (p) => {
        requireAmount(p.budget, "Le budget")
        requireAmount(p.paid, "Le montant encaissé")
        requireAmount(p.cost, "Le coût")
        if (!isTaxRate(p.progress) || !Number.isInteger(p.progress)) throw new Error("L'avancement doit être un entier entre 0 et 100.")
        const proj: Project = { ...p, id: uid(), name: sanitize(p.name) }
        set((s) => ({ projects: [proj, ...s.projects] }))
        get().log("a créé le projet", proj.name, "projects", "info")
      },
      updateProject: (id, patch) => {
        const current = get().projects.find((p) => p.id === id)
        if (!current) return
        const updated = { ...current, ...patch, id: current.id }
        requireAmount(updated.budget, "Le budget")
        requireAmount(updated.paid, "Le montant encaissé")
        requireAmount(updated.cost, "Le coût")
        if (!isTaxRate(updated.progress) || !Number.isInteger(updated.progress)) throw new Error("L'avancement doit être un entier entre 0 et 100.")
        updated.name = sanitize(updated.name)
        set((s) => ({ projects: s.projects.map((p) => p.id === id ? updated : p) }))
      },
      toggleMilestone: (pid, mid) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === pid
              ? { ...p, milestones: p.milestones.map((m) => (m.id === mid ? { ...m, done: !m.done } : m)) }
              : p,
          ),
        })),

      addContact: (c) => {
        requireBalance(c.balance)
        const ct: Contact = { ...c, id: uid(), name: sanitize(c.name), ice: sanitize(c.ice), phone: sanitize(c.phone), email: sanitize(c.email), city: sanitize(c.city) }
        set((s) => ({ contacts: [ct, ...s.contacts] }))
        get().log("a ajouté", `${ct.type === "client" ? "Client" : "Fournisseur"} · ${ct.name}`, "contacts", "info")
      },
      updateContact: (id, patch) => {
        const current = get().contacts.find((c) => c.id === id)
        if (!current) return
        const updated = { ...current, ...patch, id: current.id }
        requireBalance(updated.balance)
        for (const field of ["name", "ice", "phone", "email", "city"] as const) updated[field] = sanitize(updated[field])
        set((s) => ({ contacts: s.contacts.map((c) => c.id === id ? updated : c) }))
      },
      removeContact: (id) => {
        const c = get().contacts.find((x) => x.id === id)
        set((s) => ({ contacts: s.contacts.filter((x) => x.id !== id) }))
        if (c) get().log("a supprimé", `Contact · ${c.name}`, "contacts", "critical")
      },
      importContacts: (rows) => {
        rows.forEach((row) => requireBalance(row.balance)) // validate every row before mutating any state
        const items = rows.map((r) => ({ ...r, id: uid(), name: sanitize(r.name), ice: sanitize(r.ice), phone: sanitize(r.phone), email: sanitize(r.email), city: sanitize(r.city) }))
        set((s) => ({ contacts: [...items, ...s.contacts] }))
        get().log("a importé", `${items.length} contacts (CSV)`, "contacts", "warning")
      },

      addExpense: (e) => {
        requireAmount(e.amount, "Le montant")
        if (e.taxRate !== undefined && !isTaxRate(e.taxRate)) throw new Error("Le taux de TVA doit être compris entre 0 et 100 %.")
        const items = e.items?.length
          ? e.items.map((item) => {
              requireAmount(item.qty, "La quantité", MAX_QUANTITY)
              requireAmount(item.unitPrice, "Le prix unitaire")
              const words = sanitizeKeywords(item.keywords)
              return { label: sanitize(item.label), qty: item.qty, unitPrice: item.unitPrice, ...(words.length ? { keywords: words } : {}) }
            })
          : undefined
        if (e.receiptImage) validateLogoDataURL(e.receiptImage)
        const ex: Expense = { ...e, id: uid(), note: sanitize(e.note), items, receiptImage: e.receiptImage ?? null }
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
        requireBalance(delta)
        const current = get().stock.find((i) => i.id === id)
        if (!current) return
        const quantity = Math.max(0, current.qty + delta)
        requireAmount(quantity, "La quantité", MAX_QUANTITY)
        set((s) => ({ stock: s.stock.map((i) => i.id === id ? { ...i, qty: quantity } : i) }))
        const i = get().stock.find((x) => x.id === id)
        if (i) get().log("a ajusté le stock", `${i.name} → ${i.qty} ${i.unit}`, "inventory", "info")
      },
      assignStock: (id, projectId) => {
        set((s) => ({ stock: s.stock.map((i) => (i.id === id ? { ...i, assignedProjectId: projectId } : i)) }))
        const i = get().stock.find((x) => x.id === id)
        if (i) get().log("a affecté le matériel", i.name, "inventory", "info")
      },
      addStock: (item) => {
        requireAmount(item.qty, "La quantité", MAX_QUANTITY)
        requireAmount(item.minQty, "Le seuil minimum", MAX_QUANTITY)
        set((s) => ({ stock: [{ ...item, id: uid(), name: sanitize(item.name), sku: sanitize(item.sku), unit: sanitize(item.unit), keywords: sanitizeKeywords(item.keywords).length ? sanitizeKeywords(item.keywords) : undefined }, ...s.stock] }))
      },

      addContract: (c) => {
        requireAmount(c.value, "La valeur")
        const co: Contract = { ...c, id: uid(), title: sanitize(c.title) }
        set((s) => ({ contracts: [co, ...s.contracts] }))
        get().log("a généré un contrat", co.title, "legal", "warning")
      },
      setContractStatus: (id, status) => {
        set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? { ...c, status } : c)) }))
        const c = get().contracts.find((x) => x.id === id)
        if (c && status === "signed") get().log("a marqué le contrat comme signé", c.title, "legal", "warning")
        if (c && status === "sent") get().log("a marqué le contrat comme envoyé", c.title, "legal", "info")
      },

      inviteMember: (m) => {
        const mem: TeamMember = { ...m, id: uid(), name: sanitize(m.name), email: sanitize(m.email) }
        set((s) => ({ team: [...s.team, mem] }))
        get().log("a invité un membre", `${mem.name} · ${mem.role}`, "team", "warning")
      },
      toggleMemberActive: (id) => {
        set((s) => ({ team: s.team.map((m) => (m.id === id ? { ...m, active: !m.active } : m)) }))
        const m = get().team.find((x) => x.id === id)
        if (m) get().log(m.active ? "a réactivé le compte" : "a désactivé le compte", m.name, "team", "critical")
      },
      setPermission: (id, module, value) =>
        set((s) => ({
          team: s.team.map((m) => (m.id === id ? { ...m, permissions: { ...m.permissions, [module]: value } } : m)),
        })),
      setMemberRole: (id, role) =>
        set((s) => ({ team: s.team.map((m) => (m.id === id ? { ...m, role } : m)) })),

      addTool: (tool) => {
        requireAmount(tool.cost, "Le coût mensuel")
        if (!validDateRange(tool.start, tool.expiry)) throw new Error("Les dates sont invalides ou l'expiration précède la date de début.")
        const name = sanitize(tool.name)
        if (!name) throw new Error("Le nom de l'outil est requis.")
        const record = { ...tool, name, id: uid(), start: tool.start ? dateFromDay(calendarDay(tool.start)!) : "", expiry: tool.expiry ? dateFromDay(calendarDay(tool.expiry)!) : "" }
        set((s) => ({ tools: [record, ...s.tools] }))
        get().log("a ajouté un abonnement", record.name, "tools", "info")
      },
      removeTool: (id) => {
        const tool = get().tools.find((t) => t.id === id)
        if (!tool) return
        set((s) => ({ tools: s.tools.filter((t) => t.id !== id) }))
        get().log("a supprimé un abonnement", tool.name, "tools", "warning")
      },

      updateSettings: (patch) => {
        if ("taxRate" in patch && !isTaxRate(patch.taxRate)) throw new Error("Le taux de TVA doit être compris entre 0 et 100 %.")
        if ("logo" in patch) validateLogoDataURL(patch.logo)
        if ("currency" in patch && !["MAD", "EUR", "USD"].includes(patch.currency ?? "")) throw new Error("Devise invalide.")
        // Preserve document text/newlines; React escapes display text. Numeric/logo
        // validation is not a reason to silently truncate or rewrite existing notes.
        set((s) => ({ settings: { ...s.settings, ...patch } }))
        get().log("a modifié les paramètres", "Configuration entreprise", "settings", "warning")
      },
    }),
    {
      name: SIGNED_OUT_STORAGE,
      skipHydration: true,
      storage: createJSONStorage(() => businessStorage),
      partialize: businessSnapshot,
      merge: (persisted, current) => {
        const defaults = initialData()
        const saved = persisted as Partial<LocalData> | undefined
        // Never hydrate auth or action functions, even from tampered storage.
        return {
          ...current, ...defaults, auth: null,
          settings: saved?.settings ? { ...defaults.settings, ...saved.settings } : defaults.settings,
          projects: Array.isArray(saved?.projects) ? saved.projects : defaults.projects,
          contacts: Array.isArray(saved?.contacts) ? saved.contacts : defaults.contacts,
          expenses: Array.isArray(saved?.expenses) ? saved.expenses : defaults.expenses,
          stock: Array.isArray(saved?.stock) ? saved.stock : defaults.stock,
          contracts: Array.isArray(saved?.contracts) ? saved.contracts : defaults.contracts,
          tools: Array.isArray(saved?.tools) ? saved.tools : defaults.tools,
          team: Array.isArray(saved?.team) ? saved.team : defaults.team,
          audit: Array.isArray(saved?.audit) ? saved.audit : defaults.audit,
        }
      },
    },
  ),
)
