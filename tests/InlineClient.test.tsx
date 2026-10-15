import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import Projects from "../src/modules/Projects"
import LegalVault from "../src/modules/LegalVault"
import Procurement from "../src/modules/Procurement"
import { useMizan } from "../src/store/useMizan"

/**
 * The one-form rule: with an empty contacts book, a project, a contract
 * and an expense can each be created by typing the party inline — once —
 * and the party is registered in Clients & Fournisseurs from that same
 * submit. No "create the client first", no second form.
 */

beforeEach(() => {
  localStorage.clear()
  useMizan.getState().signOut()
  useMizan.getState().signIn("Karim Benjelloun", "karim@atlas.ma", "owner", "inline-user")
  useMizan.setState({ contacts: [], projects: [], contracts: [], expenses: [] })
})

describe("one form, registered once", () => {
  it("a project creates its client, who lands in the contacts", () => {
    render(<Projects />)
    fireEvent.click(screen.getByRole("button", { name: /Nouveau projet/ }))
    fireEvent.change(screen.getByLabelText("Nom du projet"), { target: { value: "Villa Zellij" } })
    // No client exists: the form is already in "new client" mode.
    fireEvent.change(screen.getByLabelText("Nom / Raison sociale"), { target: { value: "Yasmine El Fassi" } })
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "0661223344" } })
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: "Tanger" } })
    fireEvent.click(screen.getByRole("button", { name: "Créer le projet" }))

    const state = useMizan.getState()
    const created = state.contacts.find((c) => c.name === "Yasmine El Fassi")
    expect(created).toMatchObject({ type: "client", phone: "0661223344", city: "Tanger" })
    expect(state.projects[0]).toMatchObject({ name: "Villa Zellij", clientId: created?.id })
  })

  it("a contract creates its client the same way", () => {
    render(<LegalVault />)
    fireEvent.click(screen.getByRole("button", { name: /Marché de travaux/ }))
    // "Client non renseigné" stays available; the new client is one option away, same form.
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: "__new_party" } })
    fireEvent.change(screen.getByLabelText("Intitulé du contrat"), { target: { value: "Travaux Villa Zellij" } })
    fireEvent.change(screen.getByLabelText("Nom / Raison sociale"), { target: { value: "Omar Berrada" } })
    fireEvent.change(screen.getByLabelText(/Valeur/), { target: { value: "250000" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }))

    const state = useMizan.getState()
    const created = state.contacts.find((c) => c.name === "Omar Berrada")
    expect(created?.type).toBe("client")
    expect(state.contracts[0]).toMatchObject({ title: "Travaux Villa Zellij", clientId: created?.id })
  })

  it("an expense creates its supplier the same way", () => {
    render(<Procurement />)
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle dépense/ }))
    fireEvent.change(screen.getByLabelText("Nom / Raison sociale"), { target: { value: "Quincaillerie Tazi" } })
    fireEvent.change(screen.getByLabelText(/Montant \(MAD\)/), { target: { value: "1200" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    const state = useMizan.getState()
    const created = state.contacts.find((c) => c.name === "Quincaillerie Tazi")
    expect(created?.type).toBe("supplier")
    expect(state.expenses[0]).toMatchObject({ amount: 1200, vendorId: created?.id })
  })

  it("an existing client is picked, never duplicated", () => {
    const id = useMizan.getState().addContact({
      type: "client", name: "Client Existant", ice: "", phone: "", email: "", city: "Rabat", balance: 0,
    })
    render(<Projects />)
    fireEvent.click(screen.getByRole("button", { name: /Nouveau projet/ }))
    fireEvent.change(screen.getByLabelText("Nom du projet"), { target: { value: "Projet Rabat" } })
    fireEvent.click(screen.getByRole("button", { name: "Créer le projet" }))

    const state = useMizan.getState()
    expect(state.contacts).toHaveLength(1)
    expect(state.projects[0].clientId).toBe(id)
  })
})
