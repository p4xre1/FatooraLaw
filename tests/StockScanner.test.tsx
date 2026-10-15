import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import Inventory from "../src/modules/Inventory"
import { useMizan } from "../src/store/useMizan"
import type { StockItem } from "../src/store/types"

/**
 * The scanner journey, without a camera (jsdom has none): a code arrives —
 * camera, hardware reader or typing all land in the same field — and the
 * article is acted on. Found means Entrée/Sortie on the spot; unknown
 * means creating the article with that code, which is how a delivery gets
 * stocked.
 */

const CEMENT: StockItem = {
  id: "s1", name: "Ciment 25kg", sku: "6194001234567", qty: 5, minQty: 2,
  unit: "sac", assignedProjectId: null, type: "material",
}

beforeEach(() => {
  localStorage.clear()
  useMizan.getState().signOut()
  useMizan.getState().signIn("Karim Benjelloun", "karim@atlas.ma", "owner", "scanner-user")
  useMizan.setState({ stock: [{ ...CEMENT }], projects: [] })
})

function openScanner() {
  render(<Inventory />)
  fireEvent.click(screen.getByRole("button", { name: "Scanner" }))
  return screen.getByPlaceholderText(/EAN, QR, référence/)
}

describe("the stock scanner", () => {
  it("finds an article by its code and moves it in and out", () => {
    const input = openScanner()
    fireEvent.change(input, { target: { value: " 6194001234567 " } })
    fireEvent.click(screen.getByRole("button", { name: /Trouver l'article/ }))

    // The name shows twice: the table behind, and the scanner's answer.
    expect(screen.getAllByText("Ciment 25kg").length).toBeGreaterThan(1)
    expect(screen.getByText("En stock")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Entrée" }))
    expect(useMizan.getState().stock[0].qty).toBe(6)
    expect(screen.getByText(/\+1 → 6 sac en stock/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "2" } })
    fireEvent.click(screen.getByRole("button", { name: "Sortie" }))
    expect(useMizan.getState().stock[0].qty).toBe(4)
  })

  it("says when the tank is empty and refuses to go below zero", () => {
    useMizan.setState({ stock: [{ ...CEMENT, qty: 1 }] })
    const input = openScanner()
    fireEvent.change(input, { target: { value: "6194001234567" } })
    fireEvent.click(screen.getByRole("button", { name: /Trouver l'article/ }))
    fireEvent.click(screen.getByRole("button", { name: "Sortie" }))
    expect(useMizan.getState().stock[0].qty).toBe(0)
    expect(screen.getByText("Rupture de stock")).toBeTruthy()
    expect((screen.getByRole("button", { name: "Sortie" }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("creates the article for a code stock has never seen", () => {
    const input = openScanner()
    fireEvent.change(input, { target: { value: "NEW-42" } })
    fireEvent.click(screen.getByRole("button", { name: /Trouver l'article/ }))
    expect(screen.getByText(/Aucun article ne porte le code NEW-42/)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Créer l'article avec ce code/ }))
    const sku = screen.getByLabelText("SKU / Référence") as HTMLInputElement
    expect(sku.value).toBe("NEW-42") // the code arrived in the form by itself

    fireEvent.change(screen.getByLabelText("Désignation"), { target: { value: "Perceuse 750W" } })
    fireEvent.click(screen.getByRole("button", { name: "Ajouter au stock" }))
    const created = useMizan.getState().stock.find((i) => i.sku === "NEW-42")
    expect(created?.name).toBe("Perceuse 750W")
  })

  it("offers typing when there is no camera, instead of pretending", () => {
    openScanner()
    const start = screen.getByRole("button", { name: /Activer la caméra/ }) as HTMLButtonElement
    expect(start.disabled).toBe(true) // jsdom has no mediaDevices: honest disable
    expect(screen.getByRole("button", { name: /Trouver l'article/ })).toBeTruthy()
  })

  it("scans another code without reopening anything", () => {
    const input = openScanner()
    fireEvent.change(input, { target: { value: "6194001234567" } })
    fireEvent.click(screen.getByRole("button", { name: /Trouver l'article/ }))
    expect(screen.getByRole("button", { name: "Entrée" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Scanner un autre code/ }))
    expect(screen.queryByRole("button", { name: "Entrée" })).toBeNull()
    expect((screen.getByPlaceholderText(/EAN, QR, référence/) as HTMLInputElement).value).toBe("")
  })
})

describe("what the plans say about it", () => {
  it("the lock page for Stock names the scanner as part of PRO/BOOST", async () => {
    const { default: PlanLock } = await import("../src/components/PlanLock")
    const { translations } = await import("../src/i18n")
    render(<PlanLock module="inventory" onNavigate={() => {}} />)
    expect(screen.getByText(translations.fr.plans.scannerNote)).toBeTruthy()
    // And only there: another locked module does not advertise it.
    render(<PlanLock module="risk" onNavigate={() => {}} />)
    expect(screen.getAllByText(translations.fr.plans.scannerNote)).toHaveLength(1)
  })
})
