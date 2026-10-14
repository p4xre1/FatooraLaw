import {
  LayoutDashboard, FolderKanban, Users, ShoppingCart, Boxes, Scale,
  BarChart3, ShieldCheck, ScrollText, Settings, CalendarDays, ShieldAlert, Wrench,
  ReceiptText,
} from "lucide-react"
import type { ModuleKey } from "../store/types"

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
  { key: "contacts", icon: Users, group: "Opérations" },
  { key: "procurement", icon: ShoppingCart, group: "Opérations" },
  { key: "inventory", icon: Boxes, group: "Opérations" },
  { key: "calendar", icon: CalendarDays, group: "Suivi & Échéances" },
  { key: "risk", icon: ShieldAlert, group: "Suivi & Échéances" },
  { key: "tools", icon: Wrench, group: "Suivi & Échéances" },
  { key: "legal", icon: Scale, group: "Conformité" },
  { key: "reports", icon: BarChart3, group: "Conformité" },
  { key: "team", icon: ShieldCheck, group: "Administration" },
  { key: "audit", icon: ScrollText, group: "Administration" },
  { key: "settings", icon: Settings, group: "Administration" },
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
