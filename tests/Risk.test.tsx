import { act, fireEvent, render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import Risk from "../src/modules/Risk"
import { useLanguageStore } from "../src/lib/language/store"

it("states in French that the risk register is a fictional, unassessed sample", () => {
  render(<Risk />)

  expect(screen.getByText("Gestion des Risques")).toBeDefined()
  expect(screen.getByRole("note").textContent).toContain("Liste de démonstration fictive")
  expect(screen.getByText("Exemples classés non critiques")).toBeDefined()
  expect(screen.getAllByText("Déclaration TVA — T3 2026").length).toBeGreaterThan(0)
  expect(screen.getByLabelText("Rechercher dans les exemples de risques")).toBeDefined()
})

it("translates the risk examples and filters in English", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  render(<Risk />)

  expect(screen.getByText("Risk Management")).toBeDefined()
  expect(screen.getByRole("note").textContent).toContain("No risk, filing or compliance status has been assessed")
  expect(screen.getByText("Examples marked non-critical")).toBeDefined()

  fireEvent.change(screen.getByLabelText("Search risk examples"), { target: { value: "CNSS" } })
  expect(screen.getByText("CNSS — monthly declaration")).toBeDefined()
  expect(screen.queryByText("VAT return — Q3 2026")).toBeNull()

  fireEvent.change(screen.getByLabelText("Search risk examples"), { target: { value: "" } })
  fireEvent.click(screen.getByRole("button", { name: "Non-critical" }))
  expect(screen.getByText("Commercial register — Model J")).toBeDefined()
  expect(screen.queryByText("Client contract — local SME")).toBeNull()
})

it("translates risk descriptions into Arabic and sets the document RTL", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<Risk />)

  expect(screen.getByText("إدارة المخاطر")).toBeDefined()
  expect(screen.getByRole("note").textContent).toContain("لم يتم تقييم أي مخاطر أو إقرارات أو حالة امتثال")
  expect(screen.getByLabelText("البحث في أمثلة المخاطر")).toBeDefined()
  expect(screen.getAllByText("إقرار الضريبة على القيمة المضافة — الربع الثالث 2026").length).toBeGreaterThan(0)
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})
