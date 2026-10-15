import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import Procurement from "../src/modules/Procurement"
import { useMizan } from "../src/store/useMizan"
import { seedContacts } from "../src/store/seed"

/**
 * The expense, itemised: articles with quantities and unit prices, a TVA
 * rate of its own, and the receipt photo stored with the record. The
 * behaviours asserted are the ones an accountant checks: the TTC saved is
 * HT + TVA of the lines, the number of items survives, and the picture
 * that was attached can be opened again from the list.
 */

beforeEach(() => {
  localStorage.clear()
  useMizan.getState().signOut()
  useMizan.getState().signIn("Karim Benjelloun", "karim@atlas.ma", "owner", "expense-user")
  useMizan.setState({ contacts: structuredClone(seedContacts), expenses: [] })
})

function openForm() {
  render(<Procurement />)
  fireEvent.click(screen.getByRole("button", { name: "Nouvelle dépense" }))
}

describe("an itemised expense", () => {
  it("saves articles, quantities, TVA and the TTC they add up to", () => {
    openForm()
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un article/ }))
    fireEvent.change(screen.getByLabelText("Article 1"), { target: { value: "Ciment 25kg" } })
    fireEvent.change(screen.getByLabelText("Qté 1"), { target: { value: "10" } })
    fireEvent.change(screen.getByLabelText("Prix unitaire 1"), { target: { value: "60" } })

    fireEvent.click(screen.getByRole("button", { name: /Ajouter un article/ }))
    fireEvent.change(screen.getByLabelText("Article 2"), { target: { value: "Sable" } })
    fireEvent.change(screen.getByLabelText("Qté 2"), { target: { value: "2" } })
    fireEvent.change(screen.getByLabelText("Prix unitaire 2"), { target: { value: "100" } })

    // HT 800, TVA 20 % (the account default) 160, TTC 960.
    expect(screen.getByText(/Sous-total HT/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    const [saved] = useMizan.getState().expenses
    expect(saved.amount).toBe(960)
    expect(saved.taxRate).toBe(20)
    expect(saved.items).toEqual([
      { label: "Ciment 25kg", qty: 10, unitPrice: 60 },
      { label: "Sable", qty: 2, unitPrice: 100 },
    ])
    // …and the list says how many articles that was.
    expect(screen.getByText(/2 articles · 12 au total/)).toBeTruthy()
  })

  it("refuses an item row that is started but not finished", () => {
    openForm()
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un article/ }))
    fireEvent.change(screen.getByLabelText("Article 1"), { target: { value: "Ciment" } })
    expect(screen.getByText(/Chaque article demande un nom/)).toBeTruthy()
    expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true)
    expect(useMizan.getState().expenses).toHaveLength(0)
  })

  it("keeps the simple path: one amount, its own TVA rate, split shown", () => {
    openForm()
    fireEvent.change(screen.getByLabelText("Montant (MAD)"), { target: { value: "240" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    const [saved] = useMizan.getState().expenses
    expect(saved.amount).toBe(240)
    expect(saved.taxRate).toBe(20)
    expect(saved.items).toBeUndefined()
    // The list underlines the split: HT 200 · TVA 20 %.
    expect(screen.getByText(/Sous-total HT/)).toBeTruthy()
  })
})

describe("the receipt photo", () => {
  it("stores the picture with the expense and opens it from the list", async () => {
    openForm()
    fireEvent.change(screen.getByLabelText("Montant (MAD)"), { target: { value: "120" } })

    const png = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])],
      "facture.png",
      { type: "image/png" },
    )
    fireEvent.change(screen.getByLabelText(/Joindre la photo/), { target: { files: [png] } })
    // The preview is the proof the read landed.
    await screen.findByAltText("Voir le justificatif")

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
    const [saved] = useMizan.getState().expenses
    expect(saved.receiptImage).toMatch(/^data:image\/png;base64,/)
    expect(saved.receipt).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Voir le justificatif" }))
    await waitFor(() => expect(screen.getAllByAltText("Voir le justificatif").length).toBeGreaterThan(0))
  })

  it("rejects a file that is not an image, with the reason", async () => {
    openForm()
    const txt = new File(["bonjour"], "note.txt", { type: "text/plain" })
    fireEvent.change(screen.getByLabelText(/Joindre la photo/), { target: { files: [txt] } })
    expect(await screen.findByText(/Choisissez une image/)).toBeTruthy()
    expect(useMizan.getState().expenses).toHaveLength(0)
  })
})

describe("keywords on expense lines", () => {
  it("an article line keeps the keywords it was bought under", () => {
    openForm()
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un article/ }))
    fireEvent.change(screen.getByLabelText("Article 1"), { target: { value: "Ciment 25kg" } })
    fireEvent.change(screen.getByLabelText("Qté 1"), { target: { value: "10" } })
    fireEvent.change(screen.getByLabelText("Prix unitaire 1"), { target: { value: "60" } })
    fireEvent.change(screen.getByLabelText(/Mots-clés \(ciment, promo…\) 1/), { target: { value: "Ciment, Promo" } })
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    const [saved] = useMizan.getState().expenses
    expect(saved.items?.[0].keywords).toEqual(["ciment", "promo"])
    expect(screen.getByText("ciment, promo")).toBeTruthy()
  })
})
