import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import PlanLock from "../src/components/PlanLock"
import { PlanActivationCard, PlanStrip } from "../src/components/PlanStatus"
import { useMizan } from "../src/store/useMizan"
import { usePlan } from "../src/store/usePlan"
import { codeFor } from "../src/lib/planCodes"

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
