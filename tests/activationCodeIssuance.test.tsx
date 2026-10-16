// @vitest-environment jsdom
import { createHash } from "node:crypto"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Outlet, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AdminAccess } from "../src/admin/lib/adminAuth"

/**
 * Issuing activation codes from the CMS — the configured (production) path.
 *
 * The server side of this flow is covered against real SQL in
 * `tests/activationKeysSql.test.ts`; these tests cover the browser half: the
 * readiness probe that names the missing prerequisite, the digest handed to
 * `issue_activation_key`, and the fact that the generator is reachable from the
 * subscriptions screen an owner actually opens (it used to live only on
 * /admin/subscription-editor, behind the platform-admin gate).
 */

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  platformAdminRow: vi.fn(),
  assurance: vi.fn(),
  factors: vi.fn(),
  keysProbe: vi.fn(),
  ledger: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("../src/lib/supabase", () => {
  // The probe reads `.select(...).limit(1)`, the ledger `.select(...).order(...).limit(200)`.
  const from = (table: string) => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => mock.platformAdminRow() }),
      limit: async () => (table === "activation_keys" ? mock.keysProbe() : mock.ledger()),
      order: () => ({ limit: async () => mock.ledger() }),
    }),
    update: () => ({ eq: async () => ({ error: null }) }),
  })
  return {
    isSupabaseConfigured: true,
    supabaseConfigProblem: null,
    supabaseConfigWarning: null,
    supabase: {
      auth: {
        getUser: mock.getUser,
        mfa: {
          getAuthenticatorAssuranceLevel: mock.assurance,
          listFactors: mock.factors,
          enroll: vi.fn(),
          challengeAndVerify: vi.fn(),
        },
      },
      rpc: mock.rpc,
      from,
    },
  }
})

// Keep the real label maps and types; only the three reads are stubbed, so the
// subscriptions screen renders without a server.
vi.mock("../src/admin/platform/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/admin/platform/client")>()),
  listPlans: async () => [],
  listSubscriptions: async () => [],
  listPurchaseRequests: async () => [],
}))

import ActivationConsole, { issuanceErrorMessage } from "../src/admin/subscriptions/ActivationConsole"
import PlatformAdminRoute from "../src/admin/PlatformAdminRoute"
import SubscriptionEditor from "../src/admin/subscriptions/SubscriptionEditor"
import SubscriptionsView from "../src/admin/platform/SubscriptionsView"
import { useSubscriptions } from "../src/store/useSubscriptions"

const ADMIN_ID = "22222222-2222-4222-8222-222222222222"
const platformAdmin: AdminAccess = { status: "authenticated", user: null, isContentAdmin: true, isPlatformAdmin: true }
const contentAdmin: AdminAccess = { status: "authenticated", user: null, isContentAdmin: true, isPlatformAdmin: false }

/** Every prerequisite met: platform admin, AAL2 session, server objects installed. */
function readyServer() {
  mock.getUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
  mock.platformAdminRow.mockResolvedValue({ data: { user_id: ADMIN_ID }, error: null })
  mock.assurance.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: null }, error: null })
  mock.factors.mockResolvedValue({ data: { totp: [{ id: "f1", status: "verified" }] }, error: null })
  mock.keysProbe.mockResolvedValue({ data: [], error: null })
  mock.ledger.mockResolvedValue({ data: [], error: null })
  mock.rpc.mockResolvedValue({ data: "3d6c1e0a-0000-4000-8000-000000000000", error: null })
}

beforeEach(() => {
  localStorage.clear()
  useSubscriptions.setState({ records: [] })
  Object.values(mock).forEach((fn) => fn.mockReset())
  readyServer()
})

async function fillClientName(name = "Karim Benjelloun") {
  fireEvent.change(await screen.findByLabelText(/اسم العميل/), { target: { value: name } })
}

const generateButton = () => screen.getByRole("button", { name: "إنشاء رمز التفعيل" }) as HTMLButtonElement

describe("issuing a server-backed activation key", () => {
  it("sends only the digest of the key it shows once", async () => {
    render(<ActivationConsole />)
    await waitFor(() => expect(generateButton().disabled).toBe(true)) // no client name yet
    await fillClientName()
    fireEvent.change(screen.getByLabelText(/الهاتف/), { target: { value: "0612345678" } })
    fireEvent.change(screen.getByLabelText(/الشركة/), { target: { value: "Atlas BTP" } })
    await waitFor(() => expect(generateButton().disabled).toBe(false))
    fireEvent.click(generateButton())

    await waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(1))
    const [fn, args] = mock.rpc.mock.calls[0] as [string, Record<string, string>]
    expect(fn).toBe("issue_activation_key")
    expect(args.p_plan).toBe("pro")
    expect(args.p_period).toBe("1M")
    expect(args.p_issued_to).toBe("Karim Benjelloun · Atlas BTP · 0612345678")

    // The key on screen is the opaque server key, and what reached the database
    // is exactly the digest the redemption RPC recomputes from it.
    const shown = await screen.findByText(/^PRO-1M-[A-Z2-9]{20}$/)
    const normalized = shown.textContent!.trim().toUpperCase().replace(/[\s._-]+/g, "")
    expect(args.p_key_hash).toBe(createHash("sha256").update(normalized).digest("hex"))

    // The local ledger never keeps the plaintext bearer key.
    await waitFor(() => expect(useSubscriptions.getState().records).toHaveLength(1))
    expect(useSubscriptions.getState().records[0].code).toBe("[key shown once]")
  })

  it("names the MFA step instead of failing after the click", async () => {
    mock.assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null })
    mock.factors.mockResolvedValue({ data: { totp: [] }, error: null })
    render(<ActivationConsole />)
    await fillClientName()

    await waitFor(() => expect(screen.getByLabelText("جاهزية إنشاء رموز التفعيل").textContent).toContain("AAL2"))
    expect(generateButton().disabled).toBe(true)
    expect(screen.getByText(/لا يمكن إنشاء رمز الآن/)).toBeTruthy()
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it("points at the two migration files when the server objects are missing", async () => {
    mock.keysProbe.mockResolvedValue({
      data: null,
      error: { message: "Could not find the table 'public.activation_keys' in the schema cache" },
    })
    render(<ActivationConsole />)
    await fillClientName()

    const banner = await waitFor(() => screen.getByLabelText("جاهزية إنشاء رموز التفعيل"))
    expect(banner.textContent).toContain("20261017_single_use_activation_codes.sql")
    expect(banner.textContent).toContain("20261018_activation_key_security.sql")
    expect(generateButton().disabled).toBe(true)
  })

  it("says the role is missing when the account is not a platform operator", async () => {
    mock.platformAdminRow.mockResolvedValue({ data: null, error: null })
    render(<ActivationConsole />)
    await fillClientName()

    await waitFor(() => expect(screen.getByLabelText("جاهزية إنشاء رموز التفعيل").textContent).toContain("platform_admins"))
    expect(generateButton().disabled).toBe(true)
  })

  it("still allows the attempt when the probe itself cannot answer", async () => {
    mock.getUser.mockRejectedValue(new Error("offline"))
    render(<ActivationConsole />)
    await fillClientName()

    await waitFor(() => expect(screen.getByLabelText("جاهزية إنشاء رموز التفعيل").textContent).toContain("تعذّر فحص الجاهزية"))
    expect(generateButton().disabled).toBe(false)
  })

  it("translates the server's refusals into the reason, not the raw code", () => {
    expect(issuanceErrorMessage(new Error("platform_admin_mfa_required"))).toContain("AAL2")
    expect(issuanceErrorMessage(new Error("Could not find the function public.issue_activation_key(text, text, text, text) in the schema cache")))
      .toContain("20261018_activation_key_security.sql")
    expect(issuanceErrorMessage(new Error('duplicate key value violates unique constraint "activation_keys_key_hash_key"')))
      .toContain("موجود مسبقاً")
    expect(issuanceErrorMessage(new Error(""))).toContain("تعذر إنشاء الرمز")
  })
})

describe("where the generator can be reached in the CMS", () => {
  it("is on the subscriptions screen an owner opens for plans", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/subscriptions"]}>
        <Routes>
          <Route element={<Outlet context={platformAdmin} />}>
            <Route path="/admin/subscriptions" element={<SubscriptionsView />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole("heading", { name: "رموز التفعيل" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "إنشاء رمز التفعيل" })).toBeTruthy()
    expect(screen.getByLabelText(/اسم العميل/)).toBeTruthy()
  })

  it("stays on the codes-and-prices console, with the local ledger", async () => {
    render(<SubscriptionEditor />)
    expect(await screen.findByRole("button", { name: "إنشاء رمز التفعيل" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: /سجل الاشتراكات/ })).toBeTruthy()
  })

  it("explains the platform role instead of silently bouncing a content editor", () => {
    const view = render(
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={contentAdmin} />}>
            <Route path="/" element={<PlatformAdminRoute />}>
              <Route index element={<p>the platform page</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(view.queryByText("the platform page")).toBeNull()
    expect(view.getByText("هذه الصفحة لمشغّل المنصة")).toBeTruthy()
    expect(view.getByText(/إدارة الوصول/)).toBeTruthy()

    view.unmount()
    const allowed = render(
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={platformAdmin} />}>
            <Route path="/" element={<PlatformAdminRoute />}>
              <Route index element={<p>the platform page</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(allowed.getByText("the platform page")).toBeTruthy()
  })
})
