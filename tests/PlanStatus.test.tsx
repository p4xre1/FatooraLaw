import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PlanLock from "../src/components/PlanLock"
import { PlanActivationCard, PlanStrip } from "../src/components/PlanStatus"
import { useMizan } from "../src/store/useMizan"
import { usePlan } from "../src/store/usePlan"
import { codeFor, codeForSerial } from "../src/lib/planCodes"
import { useSubscriptions } from "../src/store/useSubscriptions"
import { usePlanCatalog } from "../src/store/usePlanCatalog"
import { translations } from "../src/i18n"

const plans = translations.fr.plans
/** Same rendering the card uses for a whole MAD amount in French. */
const MAD = (n: number) => `${n.toLocaleString("fr-MA")} MAD`

/**
 * The three surfaces a client actually meets: the dashboard strip, the code box
 * in Paramètres, and the page a locked module opens. Asserted on the French
 * copy the app boots in, and on behaviour (what unlocks, what is written)
 * rather than on markup.
 */

beforeEach(() => {
  localStorage.clear()
  useMizan.getState().signOut()
  useMizan.getState().signIn("Karim Benjelloun", "karim@atlas.ma", "owner", "user-1")
  usePlan.getState().forAccount(null)
  usePlan.getState().clear()
  useSubscriptions.setState({ records: [] })
  usePlanCatalog.getState().reset()
  localStorage.clear()
  usePlan.getState().forAccount("user-1")
})

it("shows FREE on the dashboard strip, with the way to buy", () => {
  render(<PlanStrip onNavigate={() => {}} />)
  expect(screen.getByText("FREE")).toBeDefined()
  expect(screen.getByText(/Aucun code activé/)).toBeDefined()
  const buy = screen.getByRole("link", { name: /Acheter PRO/ })
  expect(buy.getAttribute("href")).toContain("wa.me/")
})

it("turns the strip into a countdown once a code is redeemed", async () => {
  await usePlan.getState().redeem(await codeFor("pro", "1Y"))
  render(<PlanStrip />)
  expect(screen.getByText("PRO")).toBeDefined()
  expect(screen.getByText(/PRO est actif jusqu'au/)).toBeDefined()
  expect(screen.getByText(/jours restants/)).toBeDefined()
})

it("redeems a code from Paramètres and says the date it runs to", async () => {
  render(<PlanActivationCard />)
  const input = screen.getByPlaceholderText("PRO-1M-A1B2C3D4")
  fireEvent.change(input, { target: { value: (await codeFor("boost", "1M")).toLowerCase() } })
  fireEvent.click(screen.getByRole("button", { name: /Activer/ }))

  expect(await screen.findByText(/BOOST activé jusqu'au/)).toBeDefined()
  expect(usePlan.getState().activation?.plan).toBe("boost")
  // The redemption is in the audit trail, with the plan and the end date.
  expect(useMizan.getState().audit.some((event) => event.action.includes("BOOST"))).toBe(true)
})

it("explains a malformed code without writing anything", async () => {
  render(<PlanActivationCard />)
  fireEvent.change(screen.getByPlaceholderText("PRO-1M-A1B2C3D4"), { target: { value: "BONJOUR" } })
  fireEvent.click(screen.getByRole("button", { name: /Activer/ }))

  expect(await screen.findByRole("alert")).toBeDefined()
  expect(screen.getByRole("alert").textContent).toContain("PLAN-PÉRIODE")
  expect(usePlan.getState().activation).toBeNull()
  // A refused attempt is auditable too — that is the point of logging it.
  expect(useMizan.getState().audit.some((event) => event.action.includes("refusé"))).toBe(true)
})

it("explains a well-formed code whose checksum is wrong, differently", async () => {
  render(<PlanActivationCard />)
  fireEvent.change(screen.getByPlaceholderText("PRO-1M-A1B2C3D4"), { target: { value: "PRO-1M-AAAAAAAA" } })
  fireEvent.click(screen.getByRole("button", { name: /Activer/ }))

  const alert = await screen.findByRole("alert")
  expect(alert.textContent).toContain("n'est pas valide")
  expect(usePlan.getState().activation).toBeNull()
})

it("names the plan a locked module needs and lists what it would add", () => {
  render(<PlanLock module="risk" onNavigate={vi.fn()} />)
  // Risques is BOOST-only: the page says so, and the BOOST card carries the buy link.
  expect(screen.getByText(/Plan BOOST requis/)).toBeDefined()
  expect(screen.getByText(/« Gestion des Risques » fait partie du plan BOOST/)).toBeDefined()
  const buyLinks = screen.getAllByRole("link", { name: /Acheter (PRO|BOOST)/ })
  expect(buyLinks).toHaveLength(2)
  expect(buyLinks.every((link) => link.getAttribute("href")?.includes("wa.me/"))).toBe(true)
})

it("sends a client who already has a code to Paramètres", () => {
  const onNavigate = vi.fn()
  render(<PlanLock module="procurement" onNavigate={onNavigate} />)
  fireEvent.click(screen.getByRole("button", { name: "Paramètres" }))
  expect(onNavigate).toHaveBeenCalledWith("settings")
})

describe("the black plan cards", () => {
  it("sells value, not features: every card carries its value sentence", () => {
    render(<PlanLock module="risk" onNavigate={vi.fn()} />)
    expect(screen.getByText(plans.value.free)).toBeTruthy()
    expect(screen.getByText(plans.value.pro)).toBeTruthy()
    expect(screen.getByText(plans.value.boost)).toBeTruthy()
  })

  it("marks the choice and the value: most chosen, best value", () => {
    render(<PlanLock module="risk" onNavigate={vi.fn()} />)
    expect(screen.getByText(plans.popular)).toBeTruthy()
    expect(screen.getByText(plans.bestValue)).toBeTruthy()
  })

  it("defaults to the year and shows what the year saves", () => {
    render(<PlanLock module="tools" onNavigate={vi.fn()} />)
    // 12 × 79 − 790 = 158 MAD saved on PRO, computed not invented.
    expect(screen.getByText(plans.saveYear(MAD(158)))).toBeTruthy()
    expect(screen.getAllByText(plans.twoMonthsFree).length).toBeGreaterThan(0)
    // The monthly toggle still prices by the month.
    fireEvent.click(screen.getByRole("button", { name: plans.period["1M"] }))
    expect(screen.getAllByText(plans.perMonth).length).toBeGreaterThan(0)
  })

  it("prints the three promises it actually keeps", () => {
    render(<PlanLock module="risk" onNavigate={vi.fn()} />)
    expect(screen.getByText(plans.trust.immediate)).toBeTruthy()
    expect(screen.getByText(plans.trust.noCard)).toBeTruthy()
    expect(screen.getByText(plans.trust.support)).toBeTruthy()
  })

  it("quotes the CMS price once the owner edits it", () => {
    usePlanCatalog.getState().setPrice("pro", "monthly", 149)
    render(<PlanLock module="risk" onNavigate={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: plans.period["1M"] }))
    expect(screen.getByText(MAD(149))).toBeTruthy()
  })
})

describe("frozen and stopped in the app", () => {
  const today = new Date().toISOString().slice(0, 10)
  const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

  const issue = (serial: string, plan: "pro" | "boost", period: "1M" | "1Y") =>
    useSubscriptions.getState().issue({
      code: `PENDING-${serial}`, serial, plan, period,
      clientName: "Karim Benjelloun", company: "", contact: "", source: "whatsapp", note: "", issuedAt: today,
    })

  it("the dashboard line says frozen, with the days in waiting", async () => {
    const issued = issue("K7Q2", "pro", "1M")
    await usePlan.getState().redeem(await codeForSerial("pro", "1M", "K7Q2"))
    const activation = usePlan.getState().activation!
    useSubscriptions.getState().freeze(issued.id, today)

    render(<PlanStrip />)
    const waiting = daysBetween(today, activation.expiresAt)
    expect(screen.getByText(plans.frozen("PRO", waiting))).toBeTruthy()
  })

  it("and stopped, naming the plan that was stopped", async () => {
    const issued = issue("Z3N6", "boost", "1Y")
    await usePlan.getState().redeem(await codeForSerial("boost", "1Y", "Z3N6"))
    useSubscriptions.getState().stop(issued.id)

    render(<PlanStrip />)
    expect(screen.getByText(plans.stopped("BOOST"))).toBeTruthy()
  })
})
