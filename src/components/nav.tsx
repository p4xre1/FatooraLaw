import {
  LayoutDashboard, FolderKanban, Users, ShoppingCart, Boxes, Scale, FileText,
  BarChart3, ShieldCheck, ScrollText, Settings, CalendarDays, ShieldAlert, Wrench, Truck, UserCheck,
} from "lucide-react"
import type { ModuleKey } from "../store/types"
import { Brand } from "./Brand"

/**
 * The module catalogue: order, icon and legacy group.
 *
 * `label` is gone from here on purpose. Module names are translatable copy and
 * now live in `src/i18n/shared.ts`, so the page title, the navigation rail, the
 * team permission grid and the audit log all read the same thirteen names in
 * whichever language is on screen. What stays is what is not copy: the order
 * `App.tsx` picks a first allowed module in, the icons, and the group each
 * module belonged to before the rail was regrouped.
 */
export const NAV: { key: ModuleKey; icon: typeof LayoutDashboard; group: string }[] = [
  { key: "dashboard", icon: LayoutDashboard, group: "Pilotage" },
  { key: "projects", icon: FolderKanban, group: "Opérations" },
  { key: "invoices", icon: FileText, group: "Opérations" },
  { key: "contacts", icon: Users, group: "Opérations" },
  { key: "procurement", icon: ShoppingCart, group: "Opérations" },
  { key: "inventory", icon: Boxes, group: "Opérations" },
  { key: "delivery", icon: Truck, group: "Opérations" },
  { key: "verification", icon: UserCheck, group: "Opérations" },
  { key: "calendar", icon: CalendarDays, group: "Suivi & Échéances" },
  { key: "risk", icon: ShieldAlert, group: "Suivi & Échéances" },
  { key: "tools", icon: Wrench, group: "Suivi & Échéances" },
  { key: "legal", icon: Scale, group: "Conformité" },
  { key: "reports", icon: BarChart3, group: "Conformité" },
  { key: "team", icon: ShieldCheck, group: "Administration" },
  { key: "audit", icon: ScrollText, group: "Administration" },
  { key: "settings", icon: Settings, group: "Administration" },
]

/**
 * The wordmark as the dashboard uses it.
 *
 * `size` keeps its old meaning for every call site — a 32 px brand height — but
 * the mark is now the real artwork (`scripts/brand-assets.py`) instead of a
 * receipt glyph in a blue tile with the name set in text. The lock-up's
 * wordmark is ~0.43 of its height, so the height is scaled up to keep the name
 * the same optical size as the 18 px text it replaces.
 *
 * `light` picks the white artwork for the dark navy surfaces (the sidebar and
 * the auth brand panel). The component is a plain <img>: no colour class, no
 * inline style, no state.
 */
export function Logo({ size = 32, light = false, alt = "Fatorati" }: { size?: number; light?: boolean; alt?: string }) {
  return <Brand height={Math.round(size * 1.06)} tone={light ? "white" : "blue"} alt={alt} className="select-none" />
}
