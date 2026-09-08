import {
  LayoutDashboard, FolderKanban, Users, ShoppingCart, Boxes, Scale,
  BarChart3, ShieldCheck, ScrollText, Settings, CalendarDays, ShieldAlert, Wrench,
  ReceiptText,
} from "lucide-react"
import type { ModuleKey } from "../store/types"

export const NAV: { key: ModuleKey; label: string; icon: typeof LayoutDashboard; group: string }[] = [
  { key: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, group: "Pilotage" },
  { key: "projects", label: "Projets", icon: FolderKanban, group: "Opérations" },
  { key: "contacts", label: "Clients & Fournisseurs", icon: Users, group: "Opérations" },
  { key: "procurement", label: "Achats & Dépenses", icon: ShoppingCart, group: "Opérations" },
  { key: "inventory", label: "Stock & Matériel", icon: Boxes, group: "Opérations" },
  { key: "calendar", label: "Calendrier", icon: CalendarDays, group: "Suivi & Échéances" },
  { key: "risk", label: "Gestion des Risques", icon: ShieldAlert, group: "Suivi & Échéances" },
  { key: "tools", label: "Abonnements & Outils", icon: Wrench, group: "Suivi & Échéances" },
  { key: "legal", label: "Coffre juridique", icon: Scale, group: "Conformité" },
  { key: "reports", label: "Rapports & Fiscalité", icon: BarChart3, group: "Conformité" },
  { key: "team", label: "Équipe & Rôles", icon: ShieldCheck, group: "Administration" },
  { key: "audit", label: "Journal d'audit", icon: ScrollText, group: "Administration" },
  { key: "settings", label: "Paramètres", icon: Settings, group: "Administration" },
]

export function Logo({ size = 32, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span className="grid place-items-center rounded-[9px] bg-brand text-white shadow-sm" style={{ width: size, height: size }}>
        <ReceiptText strokeWidth={2.4} style={{ width: size * 0.55, height: size * 0.55 }} aria-hidden="true" />
      </span>
      <span className={`text-[18px] font-extrabold tracking-tight leading-none ${light ? "text-white" : "text-ink"}`}>
        Fatorati
      </span>
    </span>
  )
}
