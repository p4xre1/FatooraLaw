import type {
  AuditEvent, Contact, Contract, Expense, Project, Settings, StockItem, TeamMember, ModuleKey,
} from "./types"

export const uid = () => Math.random().toString(36).slice(2, 10)
const day = 86_400_000
const now = Date.now()

const allModules: ModuleKey[] = [
  "dashboard", "projects", "contacts", "procurement", "inventory", "legal", "reports", "calendar", "risk", "tools", "team", "audit", "settings",
]
export function perms(keys: ModuleKey[]): Record<ModuleKey, boolean> {
  return allModules.reduce((acc, m) => ({ ...acc, [m]: keys.includes(m) }), {} as Record<ModuleKey, boolean>)
}

export const seedSettings: Settings = {
  company: "Atlas Bâtiment & Services SARL",
  ice: "002418773000047",
  taxId: "IF-40218822",
  rc: "RC-Casablanca 118420",
  address: "12 Rue Ibn Batouta, Quartier Industriel",
  city: "Casablanca",
  currency: "MAD",
  taxRate: 20,
  logo: null,
  headerNote: "Atlas Bâtiment & Services — Travaux tous corps d'état",
  footerNote: "Merci de votre confiance · Paiement à 30 jours · TVA 20%",
}

export const seedContacts: Contact[] = [
  { id: "ct1", type: "client", name: "Groupe Immobilier Atlas", ice: "001928374000055", phone: "+212 522-441-207", email: "contact@atlas-immo.ma", city: "Casablanca", balance: 84000 },
  { id: "ct2", type: "client", name: "Résidence Les Jardins", ice: "001827364000011", phone: "+212 537-882-101", email: "gestion@lesjardins.ma", city: "Rabat", balance: 32500 },
  { id: "ct3", type: "client", name: "Youssef El Amrani", ice: "—", phone: "+212 661-204-118", email: "y.amrani@gmail.com", city: "Casablanca", balance: 0 },
  { id: "ct4", type: "client", name: "Hôtel Les Oliviers", ice: "004182773000090", phone: "+212 524-388-114", email: "dg@lesoliviers.ma", city: "Marrakech", balance: 156000 },
  { id: "sp1", type: "supplier", name: "Aciers du Nord", ice: "000112233000021", phone: "+212 539-402-118", email: "ventes@aciers-nord.ma", city: "Nador", balance: -47800 },
  { id: "sp2", type: "supplier", name: "LafargeHolcim Maroc", ice: "000998877000033", phone: "+212 522-999-000", email: "pro@lafarge.ma", city: "Casablanca", balance: -28900 },
  { id: "sp3", type: "supplier", name: "Quincaillerie Tazi", ice: "003344556000012", phone: "+212 535-661-908", email: "tazi.quincaillerie@gmail.com", city: "Fès", balance: -6400 },
]

export const seedProjects: Project[] = [
  {
    id: "pj1", name: "Villa R+2 — Californie", clientId: "ct1", budget: 1_850_000, paid: 1_100_000, cost: 1_240_000,
    status: "active", progress: 62, start: iso(-120), end: iso(60),
    milestones: [
      { id: "m1", label: "Gros œuvre", done: true },
      { id: "m2", label: "Second œuvre", done: true },
      { id: "m3", label: "Finitions", done: false },
      { id: "m4", label: "Livraison", done: false },
    ],
    equipmentIds: ["st5", "st6"],
  },
  {
    id: "pj2", name: "Réhabilitation façade — Les Jardins", clientId: "ct2", budget: 420_000, paid: 210_000, cost: 268_000,
    status: "active", progress: 45, start: iso(-40), end: iso(35),
    milestones: [
      { id: "m1", label: "Échafaudage", done: true },
      { id: "m2", label: "Ravalement", done: false },
      { id: "m3", label: "Peinture", done: false },
    ],
    equipmentIds: ["st6"],
  },
  {
    id: "pj3", name: "Aménagement suites — Les Oliviers", clientId: "ct4", budget: 980_000, paid: 300_000, cost: 540_000,
    status: "active", progress: 33, start: iso(-25), end: iso(90),
    milestones: [
      { id: "m1", label: "Démolition", done: true },
      { id: "m2", label: "Plomberie & élec", done: false },
      { id: "m3", label: "Menuiserie", done: false },
      { id: "m4", label: "Décoration", done: false },
    ],
    equipmentIds: [],
  },
  {
    id: "pj4", name: "Extension bureau — El Amrani", clientId: "ct3", budget: 260_000, paid: 260_000, cost: 191_000,
    status: "done", progress: 100, start: iso(-210), end: iso(-30),
    milestones: [{ id: "m1", label: "Réalisé", done: true }],
    equipmentIds: [],
  },
]

export const seedExpenses: Expense[] = [
  { id: "ex1", date: iso(-2), vendorId: "sp1", category: "Matériaux", method: "transfer", amount: 47800, status: "approved", receipt: true, note: "Ferraillage HA — 6T" },
  { id: "ex2", date: iso(-3), vendorId: "sp2", category: "Matériaux", method: "check", amount: 28900, status: "approved", receipt: true, note: "Ciment CPJ45 — 220 sacs" },
  { id: "ex3", date: iso(-1), vendorId: "sp3", category: "Quincaillerie", method: "cash", amount: 6400, status: "pending", receipt: false, note: "Visserie & consommables" },
  { id: "ex4", date: iso(-5), vendorId: "sp1", category: "Matériaux", method: "transfer", amount: 19200, status: "pending", receipt: true, note: "Profilés acier" },
  { id: "ex5", date: iso(-8), vendorId: "sp2", category: "Location", method: "transfer", amount: 12500, status: "approved", receipt: true, note: "Location bétonnière" },
  { id: "ex6", date: iso(-0), vendorId: "sp3", category: "Carburant", method: "cash", amount: 2100, status: "pending", receipt: false, note: "Gasoil chantier" },
]

export const seedStock: StockItem[] = [
  { id: "st1", name: "Ciment CPJ 45", sku: "CIM-045", qty: 40, minQty: 60, unit: "sac", assignedProjectId: null, type: "material" },
  { id: "st2", name: "Fer à béton HA 12", sku: "FER-012", qty: 320, minQty: 150, unit: "barre", assignedProjectId: "pj1", type: "material" },
  { id: "st3", name: "Carreaux 60x60", sku: "CAR-6060", qty: 18, minQty: 40, unit: "m²", assignedProjectId: null, type: "material" },
  { id: "st4", name: "Peinture façade blanc", sku: "PEI-FBL", qty: 12, minQty: 10, unit: "pot", assignedProjectId: "pj2", type: "material" },
  { id: "st5", name: "Grue mobile 25T", sku: "EQ-GRU25", qty: 1, minQty: 1, unit: "unité", assignedProjectId: "pj1", type: "equipment" },
  { id: "st6", name: "Échafaudage 200m²", sku: "EQ-ECH200", qty: 2, minQty: 1, unit: "lot", assignedProjectId: "pj1", type: "equipment" },
]

export const seedContracts: Contract[] = [
  { id: "co1", type: "construction", title: "Marché travaux — Villa Californie", clientId: "ct1", value: 1_850_000, date: iso(-120), status: "signed" },
  { id: "co2", type: "service", title: "Contrat entretien annuel", clientId: "ct2", value: 96_000, date: iso(-15), status: "sent" },
  { id: "co3", type: "rental", title: "Location grue 25T — 3 mois", clientId: "ct4", value: 54_000, date: iso(-6), status: "draft" },
]

export const seedTeam: TeamMember[] = [
  { id: "u1", name: "Karim Benjelloun", email: "karim@atlas.ma", role: "owner", active: true, permissions: perms(["dashboard", "projects", "contacts", "procurement", "inventory", "legal", "reports", "calendar", "risk", "tools", "team", "audit", "settings"]) },
  { id: "u2", name: "Salma Idrissi", email: "salma@atlas.ma", role: "accountant", active: true, permissions: perms(["dashboard", "procurement", "reports", "contacts"]) },
  { id: "u3", name: "Hamza Fassi", email: "hamza@atlas.ma", role: "supervisor", active: true, permissions: perms(["dashboard", "projects", "inventory"]) },
  { id: "u4", name: "Nadia Alaoui", email: "nadia@atlas.ma", role: "assistant", active: false, permissions: perms(["dashboard", "contacts"]) },
]

export const seedAudit: AuditEvent[] = [
  { id: uid(), ts: now - 1 * 3600_000, actor: "Karim Benjelloun", action: "a signé le contrat", target: "Marché travaux — Villa Californie", module: "legal", severity: "critical" },
  { id: uid(), ts: now - 3 * 3600_000, actor: "Salma Idrissi", action: "a approuvé la dépense", target: "Ferraillage HA — 6T (47 800 MAD)", module: "procurement", severity: "warning" },
  { id: uid(), ts: now - 5 * 3600_000, actor: "Hamza Fassi", action: "a mis à jour le jalon", target: "Second œuvre — Villa Californie", module: "projects", severity: "info" },
  { id: uid(), ts: now - 20 * 3600_000, actor: "Karim Benjelloun", action: "s'est connecté", target: "Session authentifiée", module: "settings", severity: "info" },
  { id: uid(), ts: now - 26 * 3600_000, actor: "Salma Idrissi", action: "a supprimé une dépense", target: "Note de frais #EX-0091", module: "procurement", severity: "critical" },
  { id: uid(), ts: now - 50 * 3600_000, actor: "Nadia Alaoui", action: "a exporté", target: "Clients (CSV)", module: "contacts", severity: "warning" },
]

function iso(offsetDays: number) {
  return new Date(now + offsetDays * day).toISOString().slice(0, 10)
}
