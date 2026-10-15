import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import Contacts from "../src/modules/Contacts"
import Reports from "../src/modules/Reports"
import Inventory from "../src/modules/Inventory"
import { useMizan } from "../src/store/useMizan"
import type { Contact, Project, StockItem } from "../src/store/types"

/**
 * The ranking at work: a lone client tops every relative scale (50+15+15
 * and 10 for a prime-age birth year = 90, VIP) — asserted exactly, because
 * the weights are the feature. Segments then slice that same list, and
 * the Reports map lights the client's city.
 */

const CLIENT: Contact = {
  id: "c1", type: "client", name: "Yasmine El Fassi", ice: "", phone: "0611223344",
  email: "", city: "Tanger", balance: 0, birthYear: 1990, source: "whatsapp", channel: "direct",
}
const PROJECT: Project = {
  id: "p1", name: "Villa Anfa", clientId: "c1", budget: 8000, paid: 5000, cost: 0,
  status: "active", progress: 40, start: "2026-01-05", end: "2026-07-01", milestones: [], equipmentIds: [],
}
const CEMENT: StockItem = {
  id: "s1", name: "Ciment 25kg", sku: "CIM-25", qty: 40, minQty: 5, unit: "sac",
  assignedProjectId: "p1", type: "material", keywords: ["ciment", "chantier"],
}

beforeEach(() => {
  localStorage.clear()
  useMizan.getState().signOut()
  useMizan.getState().signIn("Karim Benjelloun", "karim@atlas.ma", "owner", "rank-user")
  useMizan.setState({ contacts: [{ ...CLIENT }], projects: [{ ...PROJECT }], stock: [{ ...CEMENT }], contracts: [] })
})

describe("in Clients & Fournisseurs", () => {
  it("badges the score and tier, and opens the point-by-point detail", () => {
    render(<Contacts />)
    expect(screen.getByText(/VIP · 90/)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Yasmine El Fassi" }))
    expect(screen.getByText("Détail du score")).toBeTruthy()
    expect(screen.getByText("Argent encaissé")).toBeTruthy()
    expect(screen.getByText(/36 ans|3[0-9] ans/)).toBeTruthy()
    // The keywords of her project's stock became her buying profile.
    // Chips in the detail — the same words also sit in the segment menus.
    expect(screen.getAllByText("ciment").length).toBeGreaterThan(1)
    expect(screen.getAllByText("WhatsApp").length).toBeGreaterThan(1)
  })

  it("slices the ranking by source and by item category", () => {
    render(<Contacts />)
    fireEvent.change(screen.getByLabelText("Toutes les catégories"), { target: { value: "ciment" } })
    expect(screen.getByText("Yasmine El Fassi")).toBeTruthy()

    fireEvent.change(screen.getByLabelText("Toutes les sources"), { target: { value: "instagram" } })
    expect(screen.queryByText("Yasmine El Fassi")).toBeNull()
    expect(screen.getByText("Aucun contact.")).toBeTruthy()
  })

  it("records birth year, source and channel at creation", () => {
    render(<Contacts />)
    fireEvent.click(screen.getByRole("button", { name: /Ajouter/ }))
    fireEvent.change(screen.getByLabelText("Nom / Raison sociale"), { target: { value: "Omar Berrada" } })
    fireEvent.change(screen.getByLabelText("Année de naissance"), { target: { value: "1985" } })
    fireEvent.change(screen.getByLabelText("Nous a connus via"), { target: { value: "instagram" } })
    fireEvent.change(screen.getByLabelText("Achète via"), { target: { value: "reseller" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    const created = useMizan.getState().contacts.find((c) => c.name === "Omar Berrada")
    expect(created).toMatchObject({ birthYear: 1985, source: "instagram", channel: "reseller" })
  })
})

describe("on the map in Rapports", () => {
  it("lights the client's city and names its best clients on click", () => {
    render(<Reports />)
    expect(screen.getByText("Clients par ville — Maroc")).toBeTruthy()

    // The side list's button (the map dot of the same name comes first in the DOM).
    const cityButtons = screen.getAllByRole("button", { name: /Tanger/ })
    fireEvent.click(cityButtons[cityButtons.length - 1])
    expect(screen.getByText("Meilleurs clients à Tanger")).toBeTruthy()
    expect(screen.getByText("Yasmine El Fassi")).toBeTruthy()
  })
})

describe("keywords on items", () => {
  it("a stock article keeps its keywords, shown as chips", () => {
    render(<Inventory />)
    fireEvent.click(screen.getByRole("button", { name: "Nouvel article" }))
    fireEvent.change(screen.getByLabelText("Désignation"), { target: { value: "Tube PVC 110" } })
    fireEvent.change(screen.getByLabelText("Mots-clés"), { target: { value: "Plomberie, PVC sanitaire" } })
    fireEvent.click(screen.getByRole("button", { name: "Ajouter au stock" }))

    const created = useMizan.getState().stock.find((i) => i.name === "Tube PVC 110")
    expect(created?.keywords).toEqual(["plomberie", "pvc sanitaire"])
    expect(screen.getByText("plomberie")).toBeTruthy()
  })
})
