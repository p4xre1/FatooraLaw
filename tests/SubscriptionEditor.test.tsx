import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import SubscriptionEditor from "../src/admin/subscriptions/SubscriptionEditor"
import { useSubscriptions } from "../src/store/useSubscriptions"
import { usePlanCatalog } from "../src/store/usePlanCatalog"
import { PLANS } from "../src/lib/plans"

/**
 * The owner's console end to end: build a code for a named client, see it in
 * the registry with its dates, freeze it, and change a price — with every
 * effect landing in the same stores the app reads.
 */

beforeEach(() => {
  localStorage.clear()
  useSubscriptions.setState({ records: [] })
  usePlanCatalog.getState().reset()
})

async function mintCode(plan: "PRO" | "BOOST" = "PRO") {
  const before = useSubscriptions.getState().records.length
  fireEvent.change(screen.getByLabelText(/اسم العميل/), { target: { value: "Karim Benjelloun" } })
  fireEvent.change(screen.getByLabelText(/الهاتف/), { target: { value: "0612345678" } })
  fireEvent.click(screen.getByRole("button", { name: plan }))
  fireEvent.click(screen.getByRole("button", { name: "إنشاء رمز التفعيل" }))
  await waitFor(() => expect(useSubscriptions.getState().records).toHaveLength(before + 1))
  // New records are prepended, so the freshest is always first.
  return useSubscriptions.getState().records[0]
}

describe("the code builder", () => {
  it("mints a unique per-client code and files it under the client", async () => {
    render(<SubscriptionEditor />)
    const record = await mintCode()

    expect(record.code).toMatch(/^PRO-1M-[0-9A-Z]{4}-[0-9A-Z]{8}$/)
    expect(record.serial).toHaveLength(4)
    expect(record.clientName).toBe("Karim Benjelloun")
    expect(record.source).toBe("whatsapp")
    // It is on screen (so the owner can copy it) and in the registry below.
    expect((await screen.findAllByText(record.code)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Karim Benjelloun/).length).toBeGreaterThan(0)
    expect(screen.getByText("بانتظار التفعيل")).toBeTruthy()

    // A second client never gets the same code.
    const second = await mintCode("BOOST")
    expect(second.code).toMatch(/^BOOST-1M-/)
    expect(second.code).not.toBe(record.code)
    await waitFor(() => expect(screen.getAllByText("بانتظار التفعيل")).toHaveLength(2))
  })

  it("offers to send the code on WhatsApp to the client's number", async () => {
    render(<SubscriptionEditor />)
    const record = await mintCode()
    const send = await screen.findByRole("link", { name: /WhatsApp/ })
    expect(send.getAttribute("href")).toContain("wa.me/212612345678")
    expect(decodeURIComponent(send.getAttribute("href")!)).toContain(record.code)
  })

  it("refuses to mint a code for nobody", () => {
    render(<SubscriptionEditor />)
    const button = screen.getByRole("button", { name: "إنشاء رمز التفعيل" }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})

describe("the owner's hand on a record", () => {
  it("freezes, resumes, stops, and forgets", async () => {
    render(<SubscriptionEditor />)
    await mintCode()

    fireEvent.click(screen.getByRole("button", { name: /تجميد/ }))
    expect(screen.getByText("مجمّد")).toBeTruthy()
    expect(useSubscriptions.getState().records[0].status).toBe("frozen")

    fireEvent.click(screen.getByRole("button", { name: /استئناف/ }))
    expect(screen.getByText("بانتظار التفعيل")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /إيقاف/ }))
    expect(screen.getByText("موقوف")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /إعادة تفعيل/ }))
    expect(useSubscriptions.getState().records[0].status).toBe("active")

    fireEvent.click(screen.getByRole("button", { name: "حذف السجل" }))
    expect(useSubscriptions.getState().records).toHaveLength(0)
  })

  it("shows each record its start, its end and where the client came from", async () => {
    const day = 86_400_000
    const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
    const now = Date.now()
    useSubscriptions.getState().issue({
      code: "PRO-1M-K7Q2-BF6VSEZJ", serial: "K7Q2", plan: "pro", period: "1M",
      clientName: "Karim Benjelloun", company: "Atlas BTP", contact: "0612345678",
      source: "instagram", note: "", issuedAt: iso(now - 5 * day),
    })
    useSubscriptions.getState().markRedeemed({ plan: "pro", period: "1M", startedAt: iso(now - 5 * day), expiresAt: iso(now + 25 * day), serial: "K7Q2", redeemedAt: iso(now - 5 * day) })

    render(<SubscriptionEditor />)
    expect(screen.getAllByText(/Karim Benjelloun/).length).toBeGreaterThan(0)
    // The source name also lives in the builder's dropdown — it must be here too.
    expect(screen.getAllByText("إنستغرام").length).toBeGreaterThan(1)
    expect(screen.getByText("نشط")).toBeTruthy()
  })
})

describe("prices and paragraphs", () => {
  it("writes a new price into the catalog the app reads", () => {
    render(<SubscriptionEditor />)
    // Both sold plans have a "شهرياً" input; PRO's is the first.
    fireEvent.change(screen.getAllByLabelText("شهرياً (MAD)")[0], { target: { value: "149" } })
    expect(usePlanCatalog.getState().catalog.prices.pro.monthly).toBe(149)
    expect(usePlanCatalog.getState().catalog.prices.boost.monthly).toBe(PLANS.boost.monthlyPrice)
    expect(screen.getByText(/تم الحفظ/)).toBeTruthy()
  })

  it("edits a paragraph per language and resets to the shipped catalog", () => {
    render(<SubscriptionEditor />)
    fireEvent.click(screen.getByRole("tab", { name: "Français" }))
    fireEvent.change(screen.getAllByLabelText(/جملة القيمة/)[1], { target: { value: "La valeur du patron." } })
    expect(usePlanCatalog.getState().catalog.copy.pro?.fr?.value).toBe("La valeur du patron.")
    // Arabic was not touched.
    expect(usePlanCatalog.getState().catalog.copy.pro?.ar).toBeUndefined()

    fireEvent.click(screen.getByRole("button", { name: /استعادة الافتراضي/ }))
    expect(usePlanCatalog.getState().catalog.prices.pro.monthly).toBe(PLANS.pro.monthlyPrice)
    expect(usePlanCatalog.getState().catalog.copy).toEqual({})
  })
})
