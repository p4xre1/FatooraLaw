// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The AAL2 setup panel, against the enroll response GoTrue actually sends.
 *
 * The QR arrives as raw SVG markup and must reach the <img> as a data URL every
 * browser decodes; the setup key must reach Google Authenticator whole — a
 * half-copied key is exactly what the app reports as "the key value is too
 * short", so the panel copies it in one click and refuses to display a key the
 * app would reject.
 */

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  platformAdminRow: vi.fn(),
  assurance: vi.fn(),
  factors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  keysProbe: vi.fn(),
  ledger: vi.fn(),
}))

vi.mock("../src/lib/supabase", () => {
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
          enroll: mock.enroll,
          unenroll: mock.unenroll,
          challengeAndVerify: mock.challengeAndVerify,
        },
      },
      from,
    },
  }
})

vi.mock("../src/admin/platform/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/admin/platform/client")>()),
  listPlans: async () => [],
  listSubscriptions: async () => [],
  listPurchaseRequests: async () => [],
}))

import ActivationConsole from "../src/admin/subscriptions/ActivationConsole"
import { useSubscriptions } from "../src/store/useSubscriptions"

const ADMIN_ID = "22222222-2222-4222-8222-222222222222"
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="3"><rect fill="#000000"/></svg>'
const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" // 32 base32 chars — what GoTrue sends
const URI = `otpauth://totp/Fatorati%20CMS:admin%40x.com?secret=${SECRET}&issuer=Fatorati`

/** AAL2 not yet reached, no factors on the account — the "set up" starting point. */
function newEnrollmentSession() {
  mock.getUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null })
  mock.platformAdminRow.mockResolvedValue({ data: { user_id: ADMIN_ID }, error: null })
  mock.assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null })
  mock.factors.mockResolvedValue({ data: { totp: [] }, error: null })
  mock.keysProbe.mockResolvedValue({ data: [], error: null })
  mock.ledger.mockResolvedValue({ data: [], error: null })
  mock.enroll.mockResolvedValue({
    data: { id: "factor-1", type: "totp", friendly_name: "Fatorati CMS", totp: { qr_code: SVG, secret: SECRET, uri: URI } },
    error: null,
  })
}

beforeEach(() => {
  localStorage.clear()
  useSubscriptions.setState({ records: [] })
  Object.values(mock).forEach((fn) => fn.mockReset())
  newEnrollmentSession()
})

const setupButton = () => screen.getByRole("button", { name: "إعداد تطبيق المصادقة" }) as HTMLButtonElement

describe("handing the factor to Google Authenticator", () => {
  it("renders the QR as a real image and the full setup key, with one-click copy", async () => {
    render(<ActivationConsole />)
    fireEvent.click(await waitFor(() => setupButton()))

    // The QR: raw SVG markup from GoTrue, delivered as a base64 data URL.
    const qr = (await screen.findByAltText("رمز QR للمصادقة متعددة العوامل")) as HTMLImageElement
    expect(qr.src.startsWith("data:image/svg+xml;base64,")).toBe(true)
    expect(Buffer.from(qr.src.split(",")[1]!, "base64").toString("utf8")).toBe(SVG)

    // The key, in readable groups of four…
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP")).toBeTruthy()

    // …and a copy button that puts the WHOLE ungrouped key on the clipboard.
    // A partial copy of the wrapped text is what Google Authenticator answers
    // with "the key value is too short".
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    fireEvent.click(screen.getByRole("button", { name: /نسخ المفتاح/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRET))
    expect(writeText).toHaveBeenCalledTimes(1)

    // The direct deep link for phones: no typing at all.
    const link = screen.getByRole("link", { name: /إضافة مباشرة/ }) as HTMLAnchorElement
    expect(link.getAttribute("href")).toBe(URI)
  })

  it("refuses to show a setup key the app would reject as too short", async () => {
    // Broken server response: key and URI both carry a truncated secret. Never
    // show it — Google Authenticator answers "the key value is too short".
    const shortUri = "otpauth://totp/Fatorati%20CMS:admin%40x.com?secret=SHORT&issuer=Fatorati"
    mock.enroll.mockResolvedValue({
      data: { id: "factor-1", type: "totp", totp: { qr_code: SVG, secret: "SHORT", uri: shortUri } },
      error: null,
    })
    render(<ActivationConsole />)
    fireEvent.click(await waitFor(() => setupButton()))

    expect(await screen.findByText(/مفتاح إعداد غير صالح/)).toBeTruthy()
    expect(screen.queryByText(/SHOR/)).toBeNull()
    expect(screen.queryByAltText("رمز QR للمصادقة متعددة العوامل")).toBeNull()
  })

  it("recovers the key from the otpauth URI when the secret field is missing", async () => {
    mock.enroll.mockResolvedValue({
      data: { id: "factor-1", type: "totp", totp: { qr_code: SVG, secret: "", uri: URI } },
      error: null,
    })
    render(<ActivationConsole />)
    fireEvent.click(await waitFor(() => setupButton()))
    expect(await screen.findByText("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP")).toBeTruthy()
  })

  it("drops a leftover unverified factor so setup can start over", async () => {
    // A reload after "إعداد تطبيق المصادقة" leaves a pending factor whose key no
    // longer exists anywhere: the panel clears it instead of showing a code box
    // with nothing to enter.
    mock.factors.mockResolvedValue({ data: { totp: [{ id: "f-stale", status: "unverified" }] }, error: null })
    render(<ActivationConsole />)

    await waitFor(() => expect(mock.unenroll).toHaveBeenCalledWith({ factorId: "f-stale" }))
    expect(screen.queryByLabelText("رمز تطبيق المصادقة")).toBeNull()
    expect(setupButton()).toBeTruthy()
    // Clicking setup right away also clears any fresh leftover before enrolling.
    fireEvent.click(setupButton())
    await waitFor(() => expect(mock.enroll).toHaveBeenCalledTimes(1))
  })
})
