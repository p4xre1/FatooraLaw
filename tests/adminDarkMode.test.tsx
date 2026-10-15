import { fireEvent, render } from "@testing-library/react"
import { Outlet, Route, Routes, MemoryRouter } from "react-router"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, expect, it } from "vitest"
import AdminLayout from "../src/admin/AdminLayout"
import { applyThemeClass, THEME_STORAGE_KEY, useThemeStore, type ThemeMode } from "../src/lib/theme"
import type { AdminAccess } from "../src/admin/lib/adminAuth"

/**
 * The CMS console honours the same device theme preference as the dashboard:
 * dark re-bases the semantic tokens onto the #0D1117 canvas. Admin views are
 * therefore not allowed to hardcode light-only surfaces (bg-white, raw gray
 * and -50 tints, …) — they would glow in dark mode and the audit below keeps
 * them out.
 */

const access: AdminAccess = { status: "authenticated", user: null, isContentAdmin: true, isPlatformAdmin: false }

function adminSourceFiles(dir = "src/admin"): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...adminSourceFiles(full))
    else if (entry.endsWith(".tsx")) out.push(full)
  }
  return out
}

const LIGHT_ONLY = ["bg-white", "bg-gray-50", "bg-gray-100", "text-gray-500", "text-gray-600", "text-gray-400", "bg-amber-50", "bg-blue-50", "from-amber-50", "from-blue-50", "to-white", "to-indigo-50"]

it("no admin view hardcodes a light-only surface", () => {
  const offenders: string[] = []
  for (const file of adminSourceFiles()) {
    const source = readFileSync(file, "utf8")
    for (const token of LIGHT_ONLY) {
      if (source.includes(token)) offenders.push(`${file}: ${token}`)
    }
  }
  expect(offenders, offenders.join("\n")).toEqual([])
})

beforeEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY)
  useThemeStore.setState({ mode: "light" })
  applyThemeClass(false)
  localStorage.clear()
})
afterEach(() => {
  applyThemeClass(false)
  useThemeStore.setState({ mode: "light" })
})

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route element={<Outlet context={access} />}>
          <Route path="admin" element={<AdminLayout />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

it("applies the dark class on the CMS when the theme mode is dark", () => {
  useThemeStore.setState({ mode: "dark" })
  renderLayout()
  expect(document.documentElement.classList.contains("dark")).toBe(true)
  expect(document.documentElement.style.colorScheme).toBe("dark")
})

it("the header toggle flips the theme and the class follows", () => {
  const view = renderLayout()
  expect(document.documentElement.classList.contains("dark")).toBe(false)
  fireEvent.click(view.getByRole("button", { name: "الوضع الداكن" }))
  expect(useThemeStore.getState().mode satisfies ThemeMode).toBe("dark")
  expect(document.documentElement.classList.contains("dark")).toBe(true)
  fireEvent.click(view.getByRole("button", { name: "الوضع الفاتح" }))
  expect(useThemeStore.getState().mode).toBe("light")
  expect(document.documentElement.classList.contains("dark")).toBe(false)
})

it("removes the class when the CMS unmounts (back to the marketing pages)", () => {
  useThemeStore.setState({ mode: "dark" })
  const view = renderLayout()
  expect(document.documentElement.classList.contains("dark")).toBe(true)
  view.unmount()
  expect(document.documentElement.classList.contains("dark")).toBe(false)
})

/* ----------------------------- the CMS shell ------------------------------ */

it("organises the destinations into role-filtered groups in a left sidebar", () => {
  const view = renderLayout()
  // The shell lays the sidebar on the physical left even though the console
  // is RTL (row-reverse), and the single nav instance holds every group.
  expect(view.container.querySelector(".flex-row-reverse")).not.toBeNull()
  const nav = view.getByRole("navigation", { name: "التنقل الرئيسي" })
  const text = nav.textContent
  // A content admin gets the content groups; the platform-only ones
  // (overview, billing, security) are absent from the DOM entirely.
  for (const label of ["المحتوى", "البريد والدعم", "النظام والسلامة"]) {
    expect(text, label).toContain(label)
  }
  expect(text).toContain("المدونة")
  expect(text).toContain("المراقبة")
  expect(text).not.toContain("عام")
  expect(text).not.toContain("المبيعات والنمو")
  expect(text).not.toContain("الاشتراكات")
  expect(text).not.toContain("الأمان")
  view.unmount()

  const platform: AdminAccess = { status: "authenticated", user: null, isContentAdmin: true, isPlatformAdmin: true }
  const platformView = render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route element={<Outlet context={platform} />}>
          <Route path="admin" element={<AdminLayout />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  const platformText = platformView.getByRole("navigation", { name: "التنقل الرئيسي" }).textContent
  expect(platformText).toContain("الاشتراكات")
  expect(platformText).toContain("الأمان")
  platformView.unmount()
})

it("exactly one theme toggle and one sign-out control exist (one sidebar instance)", () => {
  const view = renderLayout()
  expect(view.getAllByRole("button", { name: "الوضع الداكن" })).toHaveLength(1)
  expect(view.getAllByRole("button", { name: "تسجيل الخروج" })).toHaveLength(1)
})

it("opens the drawer from the mobile bar and closes it from the backdrop", () => {
  const view = renderLayout()
  const aside = view.container.querySelector("aside")!
  expect(aside.className).toContain("-translate-x-full")
  fireEvent.click(view.getByRole("button", { name: "فتح القائمة" }))
  expect(aside.className).toContain("translate-x-0")
  // The aside X and the backdrop both close; either path works.
  expect(view.getAllByRole("button", { name: "إغلاق القائمة" }).length).toBeGreaterThanOrEqual(2)
  fireEvent.click(view.getAllByRole("button", { name: "إغلاق القائمة" })[0])
  expect(aside.className).toContain("-translate-x-full")
})
