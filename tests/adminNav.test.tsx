import { render, screen, within } from "@testing-library/react"
import { MemoryRouter, Outlet, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it } from "vitest"
import AdminLayout from "../src/admin/AdminLayout"
import PlatformAdminRoute from "../src/admin/PlatformAdminRoute"
import { applyThemeClass, THEME_STORAGE_KEY, useThemeStore } from "../src/lib/theme"
import type { AdminAccess } from "../src/admin/lib/adminAuth"

/**
 * The CMS sidebar, from the point of view of a content-only editor.
 *
 * This is a regression test for a specific, reported failure: the activation-code
 * generator could not be found anywhere in the CMS. It was not missing — it
 * lives at `/admin/subscription-editor` — but every platform link was filtered
 * out of the sidebar for an account that is not in `platform_admins`, so the
 * whole «المبيعات والنمو» group simply was not there. An owner with no
 * «رموز التفعيل» entry has no way to tell "you lack the role" from "this
 * product has no such page".
 *
 * The rule these tests pin: **a platform destination is always listed.** For an
 * account without the role it is marked locked and the page it opens explains
 * what is required, instead of being invisible.
 */

const contentOnly: AdminAccess = { status: "authenticated", user: null, isContentAdmin: true, isPlatformAdmin: false }
const platform: AdminAccess = { status: "authenticated", user: null, isContentAdmin: true, isPlatformAdmin: true }
const platformOnly: AdminAccess = { status: "authenticated", user: null, isContentAdmin: false, isPlatformAdmin: true }

beforeEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY)
  useThemeStore.setState({ mode: "light" })
  applyThemeClass(false)
  localStorage.clear()
})

/** The real route tree, so a link is checked against the page it actually opens. */
function renderConsole(access: AdminAccess, path = "/admin/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Outlet context={access} />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route element={<PlatformAdminRoute />}>
              <Route path="subscription-editor" element={<p>لوحة إصدار الرموز</p>} />
              <Route path="dashboard" element={<p>نظرة عامة</p>} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const nav = () => screen.getByRole("navigation", { name: "التنقل الرئيسي" })

describe("an account without the platform role", () => {
  it("still sees the activation-code destination, which is the whole complaint", () => {
    renderConsole(contentOnly)
    const link = within(nav()).getByRole("link", { name: /رموز التفعيل/ })
    expect(link.getAttribute("href")).toBe("/admin/subscription-editor")
  })

  it("marks it locked, so the entry is honest rather than a dead end", () => {
    renderConsole(contentOnly)
    const link = within(nav()).getByRole("link", { name: /رموز التفعيل/ })
    expect(within(link).getByLabelText("يتطلب دور مشغّل المنصة")).toBeDefined()

    // A content destination carries no such mark.
    const blogs = within(nav()).queryByRole("link", { name: /المدونة/ })
    if (blogs) expect(within(blogs).queryByLabelText("يتطلب دور مشغّل المنصة")).toBeNull()
  })

  it("says how to get the role, and names the pages that need it", () => {
    renderConsole(contentOnly)
    expect(within(nav()).getByText(/تتطلب دور «مشغّل المنصة»/)).toBeDefined()
    const notice = within(nav()).getByText(/platform_admins/, { selector: "span" })
    expect(notice.closest("p")?.textContent).toContain("رموز التفعيل")
  })

  it("gets an explanation on the destination, not a silent bounce", () => {
    renderConsole(contentOnly, "/admin/subscription-editor")
    const main = screen.getByRole("main")
    expect(within(main).getByRole("heading", { name: "هذه الصفحة لمشغّل المنصة" })).toBeDefined()
    expect(within(main).getAllByText(/platform_admins/).length).toBeGreaterThan(0)
    // It names where to ask an existing operator, rather than leaving the
    // account stuck with no route forward.
    expect(within(main).getByText(/إدارة الوصول/)).toBeDefined()
  })

  it("explains the two roles, because the column name misleads", () => {
    renderConsole(contentOnly, "/admin/subscription-editor")
    const main = screen.getByRole("main")
    // The question this answers is exactly "I set is_admin, why am I an editor?"
    expect(within(main).getByRole("heading", { name: /لماذا يظهر «محرِّر محتوى»/ })).toBeDefined()
    expect(within(main).getAllByText("profiles.is_admin").length).toBeGreaterThan(0)
    // Both roles named, so the table cannot be read as one role phrased twice.
    expect(within(main).getByText("محرِّر محتوى")).toBeDefined()
    expect(within(main).getAllByText("مشغّل منصة").length).toBeGreaterThan(0)
  })

  it("hands over the exact statement, and can copy it", async () => {
    renderConsole(contentOnly, "/admin/subscription-editor")
    const main = screen.getByRole("main")
    const block = main.querySelector("pre")
    expect(block?.textContent).toBe(
      "insert into public.platform_admins (user_id)\nselect id from auth.users where email = 'YOUR-EMAIL'\non conflict do nothing;",
    )

    // With no signed-in address it says to substitute one, rather than handing
    // over a statement that silently grants nothing.
    expect(within(main).getByText(/استبدل YOUR-EMAIL/)).toBeDefined()
    expect(within(main).getByRole("button", { name: /نسخ الأمر/ })).toBeDefined()
  })

  it("names both requirements for issuing codes, not just the role", () => {
    renderConsole(contentOnly, "/admin/subscription-editor")
    const main = screen.getByRole("main")
    expect(within(main).getByRole("heading", { name: /خطوتان لا خطوة واحدة/ })).toBeDefined()
    // AAL2 is the second one, and it is not a role.
    expect(within(main).getByText(/AAL2/)).toBeDefined()
  })
})

describe("an account with the platform role", () => {
  it("sees the same destination unlocked, and no notice", () => {
    renderConsole(platform)
    const link = within(nav()).getByRole("link", { name: /رموز التفعيل/ })
    expect(within(link).queryByLabelText("يتطلب دور مشغّل المنصة")).toBeNull()
    expect(within(nav()).queryByText(/platform_admins/, { exact: false })).toBeNull()
  })

  it("reaches the console itself", () => {
    renderConsole(platform, "/admin/subscription-editor")
    expect(screen.getByText("لوحة إصدار الرموز")).toBeDefined()
  })

  it("sees the destination even when it holds no content role", () => {
    renderConsole(platformOnly)
    expect(within(nav()).getByRole("link", { name: /رموز التفعيل/ })).toBeDefined()
  })
})
