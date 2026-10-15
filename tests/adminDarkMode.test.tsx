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
