import { useEffect, useRef, useState } from "react"
import {
  Search, PanelLeftClose, PanelLeftOpen, Plus, ChevronDown, LogOut, Languages,
  FolderPlus, ReceiptText, FileSignature, HardDrive, FileText,
} from "lucide-react"
import type { ModuleKey } from "../store/types"
import { NAV, Logo } from "./nav"
import { BrandIcon } from "./Brand"
import { modulePath } from "../lib/routes"
import { LOCALES, LOCALE_IDS } from "../lib/locales"
import { translations } from "../i18n"
import { useTranslation, type Language } from "../lib/language/store"
import { useMizan } from "../store/useMizan"

/**
 * The left menu — structure, spacing and behaviour.
 *
 * Colour contract: every colour in this file comes from the `sidebar-*` tokens
 * (the left menu's own palette in `src/index.css`), plus `white` for text on
 * the brand blue and `navy/50` for the mobile scrim. No other component reads
 * those tokens, so the rail can be restyled — white surface, the artwork's own
 * blue on the selected row — without dragging the rest of the dashboard along.
 * The blue is the brand's, taken from `BRAND_BLUE`/`BRAND_NAVY` in
 * `scripts/brand-assets.py`, not the generic `brand` token.
 *
 * Size contract: one row geometry for the whole menu — 44 px touch target below
 * `lg`, 40 px on desktop, 14 px labels, 18 px icons, 10 px radius — and one
 * smaller step for the popovers (36 px rows, 13 px labels). Section labels are
 * 11 px. Nothing in the rail picks its own height or type size.
 *
 * Direction contract: every offset is a logical property (`start-*`, `end-*`,
 * `ps-*`, `pe-*`, `ms-*`, `me-*`) so the rail mirrors correctly when `dir` is
 * `rtl`. The one physical transform left — the mobile drawer slide — carries an
 * explicit `rtl:` counterpart.
 */

/**
 * There is no `/invoices` route yet (see docs/FEATURES_AND_TOOLS.md §11: no
 * invoicing module exists). Flip this when it ships and both the "Factures"
 * item and the primary button retarget themselves; nothing else changes.
 * While it is off the primary button opens the same three quick actions the
 * top bar already offers, so it is never a dead control.
 */
const INVOICE_ROUTE_ENABLED = false

/**
 * Sidebar-scoped preference. Same `mizan.*` convention as the dashboard's.
 *
 * Language is *not* here: it is the app-wide preference in
 * `lib/language/store.ts`, so the rail, the auth screens and every translated
 * module follow one choice instead of three separate keys that had to be kept
 * in step by hand.
 */
const MORE_KEY = "mizan.sidebar.more"

/** Modules behind the collapsible "Plus d'outils" row. */
const MORE_MODULES: ModuleKey[] = ["risk", "legal", "tools"]
/** Modules that live in the account popover rather than in the rail. */
const ACCOUNT_MODULES: ModuleKey[] = ["team", "audit"]

const NAV_BY_KEY = new Map(NAV.map((entry) => [entry.key, entry]))

/**
 * Every published name of each module, so the rail can be searched in a language
 * other than the one on screen: a visitor who switched the UI to English can
 * still type "dépenses" and reach Achats & Dépenses. Matching only the visible
 * label would make the search feel broken to anyone who thinks in the other one.
 */
const LABELS_IN_EVERY_LANGUAGE = new Map<ModuleKey, string[]>(
  NAV.map((entry) => [entry.key, LOCALE_IDS.map((id) => translations[id].shared.modules[entry.key])]),
)

/* --------------------------- persisted prefs ---------------------------- */

function readMoreOpen(): boolean {
  try {
    return localStorage.getItem(MORE_KEY) === "open"
  } catch {
    return false
  }
}

/* ------------------------------ primitives ------------------------------ */

/**
 * One row geometry for the whole menu: 44 px touch target below `lg`, 40 px on
 * desktop, a single 14 px label size, 10 px radius. Module rows, the group
 * toggle, Paramètres and the account block all use it, so the rail reads as one
 * grid instead of five slightly different ones.
 */
const ITEM = "flex w-full items-center gap-3 rounded-[10px] px-3 h-11 lg:h-10 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active"
/** Rows inside the popovers: one deliberate step down (36 px, 13 px label). */
const POPOVER_ITEM = "flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-start text-[13px] font-medium text-sidebar-ink transition-colors hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active focus-visible:ring-inset"
/** The selected row is the brand blue; hover darkens it to the mark's fold blue. */
const ITEM_TONE = (on: boolean) => on
  ? "bg-sidebar-active text-white shadow-sm hover:bg-sidebar-active-deep"
  : "text-sidebar-ink hover:bg-sidebar-hover"
const GROUP_LABEL = "px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-sidebar-faint"
/** Every popover in the rail: a white card cut out of the rail by a hairline. */
const POPOVER = "absolute z-20 overflow-hidden rounded-xl border border-sidebar-line bg-sidebar p-1 shadow-lg"
/** Square icon control — the collapse toggle. */
const ICON_BUTTON = "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sidebar-faint transition-colors hover:bg-sidebar-hover hover:text-sidebar-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active"
/** Section separator: the rail is one column of labelled blocks, not a list. */
const SECTION = "mt-4 border-t border-sidebar-line pt-3 first:mt-0 first:border-t-0 first:pt-0"

export default function Sidebar({
  active, onNavigate, collapsed, setCollapsed, allowed, mobileOpen, setMobileOpen, onLogout,
}: {
  active: ModuleKey
  onNavigate: (m: ModuleKey) => void
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  allowed: Record<ModuleKey, boolean>
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
  /**
   * The shell's single sign-out path (`App.signOutAndGoHome`, shared with the
   * top bar and the no-access screen). Required on purpose: sign-out clears the
   * dev-session marker and the Supabase session, and a second implementation
   * living in this file would be free to drift from it.
   */
  onLogout: () => void
}) {
  const auth = useMizan((s) => s.auth)
  const [q, setQ] = useState("")
  const [moreOpen, setMoreOpen] = useState<boolean>(readMoreOpen)
  const [quickOpen, setQuickOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  /** Route the "Plus d'outils" row has already auto-expanded for. */
  const [autoOpenedFor, setAutoOpenedFor] = useState<ModuleKey | null>(null)

  const quickRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)

  // The app-wide language preference; `useTranslation()` also writes dir/lang
  // to <html>, so the rest of the document follows the rail.
  const { language, setLanguage, dir, t: copy } = useTranslation()
  const t = copy.sidebar

  /* Preferences ---------------------------------------------------------- */

  useEffect(() => {
    try {
      localStorage.setItem(MORE_KEY, moreOpen ? "open" : "closed")
    } catch {
      /* Optional preference. */
    }
  }, [moreOpen])

  // Navigating straight to /risk, /legal or /tools must reveal the item that is
  // highlighted, so the row expands once per such arrival. The visitor can then
  // collapse it again and it stays collapsed until the next arrival.
  useEffect(() => {
    if (MORE_MODULES.includes(active) && autoOpenedFor !== active) {
      setMoreOpen(true)
      setAutoOpenedFor(active)
    }
  }, [active, autoOpenedFor])

  /* Popovers ------------------------------------------------------------- */

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) setQuickOpen(false)
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      setQuickOpen(false)
      setAccountOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  /* Items ---------------------------------------------------------------- */

  const label = (key: ModuleKey) => copy.shared.modules[key] ?? key

  /** A rail row: a real module, or the invoice placeholder when it ships. */
  type Item = { id: string; href: string; icon: typeof Search; label: string; on: boolean; moduleKey: ModuleKey | null }

  const query = q.trim().toLowerCase()
  const matches = (key: ModuleKey, text: string) =>
    !query ||
    text.toLowerCase().includes(query) ||
    (LABELS_IN_EVERY_LANGUAGE.get(key) ?? []).some((name) => name.toLowerCase().includes(query))

  /** Permission-filtered rows. The pinned footer uses this directly: it is
   *  pinned, so a search that matches nothing must not remove Paramètres. */
  const rows = (keys: ModuleKey[]): Item[] => keys
    .filter((key) => allowed[key])
    .map((key) => {
      const entry = NAV_BY_KEY.get(key)!
      const text = label(key)
      return { id: key, href: modulePath(key), icon: entry.icon, label: text, on: active === key, moduleKey: key }
    })

  /** Rows inside the searchable rail: permission-filtered, then query-filtered. */
  const buildItems = (keys: ModuleKey[]): Item[] =>
    rows(keys).filter((item) => matches(item.moduleKey!, item.label))

  const invoiceItem: Item | null = INVOICE_ROUTE_ENABLED && (!query || t.invoices.toLowerCase().includes(query))
    ? { id: "invoices", href: "/invoices", icon: FileText, label: t.invoices, on: false, moduleKey: null }
    : null

  // 13 rows total — plain computation is cheaper and less error-prone than
  // tracking memo dependencies across four derived lists.
  const daily = invoiceItem
    ? [...buildItems(["dashboard"]), invoiceItem, ...buildItems(["contacts", "procurement", "calendar"])]
    : buildItems(["dashboard", "contacts", "procurement", "calendar"])
  const management = buildItems(["projects", "inventory", "reports"])
  const more = buildItems(MORE_MODULES)
  const accountItems = ACCOUNT_MODULES
    .filter((key) => allowed[key])
    .map((key) => ({ key, icon: NAV_BY_KEY.get(key)!.icon, label: label(key) }))
  const settingsItem = rows(["settings"])[0] ?? null

  const quickActions = [
    { icon: FolderPlus, label: t.newProject, to: "projects" as ModuleKey },
    { icon: ReceiptText, label: t.newExpense, to: "procurement" as ModuleKey },
    { icon: FileSignature, label: t.newContract, to: "legal" as ModuleKey },
  ].filter((action) => allowed[action.to])

  const searching = query.length > 0
  // Searching implies intent: never hide a match inside the collapsed group.
  const moreExpanded = collapsed ? false : moreOpen || (searching && more.length > 0)
  const moreCount = more.length
  const noResults = daily.length === 0 && management.length === 0 && more.length === 0

  function go(key: ModuleKey) {
    onNavigate(key)
    setMobileOpen(false)
    setQuickOpen(false)
    setAccountOpen(false)
  }

  function chooseLang(next: Language) {
    setLanguage(next)
    // The rail stays open so the visitor can see the labels change.
  }

  function signOut() {
    setAccountOpen(false)
    setMobileOpen(false)
    onLogout()
  }

  const initials = auth?.name.split(" ").slice(0, 2).map((word) => word[0]).join("") ?? "U"

  /* Renderers ------------------------------------------------------------ */

  function renderGroup(id: string, title: string, items: Item[]) {
    if (!items.length) return null
    return (
      <div key={id} className={SECTION}>
        {!collapsed && <p className={GROUP_LABEL}>{title}</p>}
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                aria-current={item.on ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                onClick={(event) => {
                  // Real hrefs keep middle-click, "open in new tab" and
                  // copy-link working; in-app routing still avoids a reload.
                  if (!item.moduleKey) return
                  event.preventDefault()
                  go(item.moduleKey)
                }}
                className={`${ITEM} ${ITEM_TONE(item.on)} ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </a>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        dir={dir}
        lang={language}
        aria-label="Fatorati"
        className={`fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e border-sidebar-line bg-sidebar text-sidebar-ink transition-all duration-200 lg:sticky lg:top-0 lg:start-auto lg:z-20 lg:h-screen ${collapsed ? "lg:w-[76px]" : "lg:w-64"} ${mobileOpen ? "" : "max-lg:-translate-x-full max-lg:rtl:translate-x-full"}`}
      >
        {/* ---- Brand ---- */}
        {/* The rail is white, so the mark is the blue artwork — and its header
            band is exactly one top bar tall, hairline included, so the rail's
            first divider lines up with the bar's. */}
        <div className={`flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-line px-3 ${collapsed ? "lg:justify-center lg:px-0" : "justify-between"}`}>
          {collapsed ? (
            <BrandIcon className="mx-auto lg:mx-0" size={32} tone="onBlue" />
          ) : (
            <Logo />
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t.expand : t.collapse}
            title={collapsed ? t.expand : t.collapse}
            className={`hidden lg:grid ${ICON_BUTTON}`}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        {/* ---- Primary action ---- */}
        <div className={`shrink-0 px-3 pb-2 pt-3 ${collapsed ? "lg:px-2" : ""}`} ref={quickRef}>
          {INVOICE_ROUTE_ENABLED ? (
            <a
              href="/invoices"
              aria-label={collapsed ? t.newInvoice : undefined}
              title={collapsed ? t.newInvoice : undefined}
              className={`${ITEM} justify-center bg-sidebar-active font-semibold text-white hover:bg-sidebar-active-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active ${collapsed ? "lg:h-10 lg:w-10 lg:px-0" : ""}`}
            >
              {collapsed ? <Plus className="h-[18px] w-[18px]" aria-hidden="true" /> : (
                <>
                  <Plus className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className="truncate">{t.newInvoice}</span>
                </>
              )}
            </a>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (collapsed) {
                    // Icon-only rail: fall back to the first allowed action.
                    if (quickActions[0]) go(quickActions[0].to)
                    return
                  }
                  setQuickOpen((open) => !open)
                }}
                aria-expanded={collapsed ? undefined : quickOpen}
                aria-controls={collapsed ? undefined : "sidebar-quick-actions"}
                aria-label={collapsed ? (quickActions[0]?.label ?? t.quickActions) : t.quickActions}
                title={collapsed ? (quickActions[0]?.label ?? t.quickActions) : undefined}
                className={`${ITEM} justify-center bg-sidebar-active font-semibold text-white hover:bg-sidebar-active-deep ${collapsed ? "lg:h-10 lg:w-full lg:px-0" : ""}`}
              >
                {collapsed ? <Plus className="h-[18px] w-[18px]" aria-hidden="true" /> : (
                  <>
                    <Plus className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate text-start">{t.quickActions}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${quickOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </>
                )}
              </button>

              {quickOpen && !collapsed && (
                <div
                  id="sidebar-quick-actions"
                  className={`${POPOVER} top-full start-0 mt-1.5 w-full min-w-[228px]`}
                  style={{ animation: "mz-pop .15s ease-out" }}
                >
                  {quickActions.map((action) => (
                    <button key={action.to} type="button" onClick={() => go(action.to)} className={POPOVER_ITEM}>
                      <action.icon className="h-4 w-4 shrink-0 text-sidebar-faint" aria-hidden="true" />
                      <span className="truncate">{action.label}</span>
                    </button>
                  ))}
                  {!quickActions.length && (
                    <p className="px-3 py-2 text-[12.5px] text-sidebar-faint">{t.noResults}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- Module search ---- */}
        {!collapsed && (
          <div className="shrink-0 px-3 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-faint" aria-hidden="true" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.search}
                aria-label={t.searchLabel}
                className="h-10 w-full rounded-[10px] border border-sidebar-line bg-sidebar-hover ps-9 pe-3 text-[13px] text-sidebar-ink outline-none transition-colors placeholder:text-sidebar-faint focus:border-sidebar-active focus:bg-sidebar focus:ring-2 focus:ring-sidebar-active/25"
              />
            </div>
          </div>
        )}

        {/* ---- Navigation ---- */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label={t.navLabel}>
          {renderGroup("daily", t.groups.daily, daily)}
          {renderGroup("management", t.groups.management, management)}

          {moreCount > 0 && (
            <div className={SECTION}>
              {/* The third group is titled like the other two rather than being
                  a row of its own: same label, same size, the chevron and the
                  count on the trailing edge. */}
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setMoreOpen((open) => !open)}
                  aria-expanded={moreExpanded}
                  aria-controls="sidebar-more-tools"
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-sidebar-faint transition-colors hover:text-sidebar-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active"
                >
                  <span className="truncate">{t.groups.more}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="tnum rounded-full bg-sidebar-active/10 px-1.5 text-[10.5px] font-bold leading-[17px] text-sidebar-active-deep">
                      {moreCount}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${moreExpanded ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </span>
                </button>
              )}

              {moreExpanded && (
                <ul id="sidebar-more-tools" className="space-y-0.5">
                  {more.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.href}
                        aria-current={item.on ? "page" : undefined}
                        onClick={(event) => {
                          event.preventDefault()
                          go(item.moduleKey!)
                        }}
                        className={`${ITEM} ${ITEM_TONE(item.on)} ps-6`}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {/* Collapsed rail: no group row, the three tools stay reachable. */}
              {collapsed && (
                <ul className="space-y-0.5">
                  {more.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.href}
                        aria-current={item.on ? "page" : undefined}
                        aria-label={item.label}
                        title={item.label}
                        onClick={(event) => {
                          event.preventDefault()
                          go(item.moduleKey!)
                        }}
                        className={`${ITEM} ${ITEM_TONE(item.on)} lg:justify-center lg:px-0`}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!collapsed && noResults && (
            <p className="mt-4 px-3 text-[12.5px] text-sidebar-faint">{t.noResults}</p>
          )}
        </nav>

        {/* ---- Pinned footer ---- */}
        <div className="shrink-0 space-y-1.5 border-t border-sidebar-line px-3 py-3">
          {/* Local-storage notice + the existing export action in Paramètres. */}
          {collapsed ? (
            <button
              type="button"
              onClick={() => allowed.settings && go("settings")}
              disabled={!allowed.settings}
              aria-label={allowed.settings ? `${t.localNotice} ${t.exportBackup}` : t.localNotice}
              title={allowed.settings ? `${t.localNotice} ${t.exportBackup}` : t.localNotice}
              className={`${ITEM} justify-center px-0 text-sidebar-faint hover:bg-sidebar-hover hover:text-sidebar-ink disabled:pointer-events-none disabled:opacity-60`}
            >
              <HardDrive className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            </button>
          ) : (
            <div className="rounded-[10px] bg-sidebar-hover px-3 py-2.5">
              <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-sidebar-ink">
                <HardDrive className="mt-px h-4 w-4 shrink-0 text-sidebar-faint" aria-hidden="true" />
                <span>{t.localNotice}</span>
              </p>
              {allowed.settings && (
                <button
                  type="button"
                  onClick={() => go("settings")}
                  className="ms-6 mt-1.5 text-[12px] font-semibold text-sidebar-active-deep underline decoration-sidebar-active/40 underline-offset-2 transition-colors hover:decoration-sidebar-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active"
                >
                  {t.exportBackup}
                </button>
              )}
            </div>
          )}

          {settingsItem && (
            <a
              href={settingsItem.href}
              aria-current={settingsItem.on ? "page" : undefined}
              aria-label={collapsed ? settingsItem.label : undefined}
              title={collapsed ? settingsItem.label : undefined}
              onClick={(event) => {
                event.preventDefault()
                go("settings")
              }}
              className={`${ITEM} ${ITEM_TONE(settingsItem.on)} ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
            >
              <settingsItem.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{settingsItem.label}</span>}
            </a>
          )}

          {/* ---- Account block ---- */}
          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-controls="sidebar-account-menu"
              aria-label={t.account}
              title={collapsed ? `${auth?.name ?? ""} — ${t.account}` : undefined}
              className={`${ITEM} ${ITEM_TONE(false)} ${accountOpen ? "bg-sidebar-hover" : ""} ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sidebar-active text-[11px] font-bold text-white">
                {initials}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block truncate text-[13px] font-semibold text-sidebar-ink">{auth?.name}</span>
                    <span className="block truncate text-[11.5px] text-sidebar-faint">{auth?.email}</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-sidebar-faint transition-transform ${accountOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </>
              )}
            </button>

            {accountOpen && (
              <div
                id="sidebar-account-menu"
                className={`${POPOVER} bottom-full start-0 mb-2 w-full min-w-[228px]`}
                style={{ animation: "mz-pop .15s ease-out" }}
              >
                {!collapsed && (
                  <div className="mb-1 border-b border-sidebar-line px-3 py-2.5">
                    <p className="truncate text-[13px] font-semibold text-sidebar-ink">{auth?.name}</p>
                    <p className="truncate text-[11.5px] text-sidebar-faint">{auth?.email}</p>
                  </div>
                )}

                {accountItems.map((item) => (
                  <button key={item.key} type="button" onClick={() => go(item.key)} aria-current={active === item.key ? "page" : undefined} className={POPOVER_ITEM}>
                    <item.icon className="h-4 w-4 shrink-0 text-sidebar-faint" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}

                {/* Language switch — the three locales the site publishes. */}
                <div className="mt-1 border-t border-sidebar-line px-3 pb-2 pt-2.5">
                  <p className="flex items-center gap-1.5 pb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-sidebar-faint">
                    <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.language}
                  </p>
                  <div className="flex gap-0.5 rounded-lg bg-sidebar-hover p-0.5">
                    {LOCALES.map((locale) => {
                      const on = locale.id === language
                      return (
                        <button
                          key={locale.id}
                          type="button"
                          onClick={() => chooseLang(locale.id)}
                          aria-pressed={on}
                          lang={locale.lang}
                          title={locale.label}
                          className={`h-8 flex-1 rounded-[7px] text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active ${on ? "bg-sidebar-active text-white shadow-sm" : "text-sidebar-ink hover:bg-sidebar"}`}
                        >
                          {locale.id.toUpperCase()}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={signOut}
                  className="mt-1 flex h-10 w-full items-center gap-2.5 rounded-b-xl border-t border-sidebar-line px-3 text-start text-[13px] font-medium text-sidebar-ink transition-colors hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active focus-visible:ring-inset"
                >
                  <LogOut className="h-4 w-4 shrink-0 text-sidebar-faint" aria-hidden="true" />
                  <span className="truncate">{t.signOut}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
