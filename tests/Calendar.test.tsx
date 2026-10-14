import { act, fireEvent, render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import Calendar from "../src/modules/Calendar"
import { useLanguageStore } from "../src/lib/language/store"

it("labels the fixed sample as fictional in French and does not promise month navigation", () => {
  render(<Calendar />)

  expect(screen.getByText("Calendrier")).toBeDefined()
  expect(screen.getByText("septembre 2026")).toBeDefined()
  expect(screen.getByRole("note").textContent).toContain(
    "Données de démonstration fictives",
  )
  expect(screen.getByText("Échéances de démonstration")).toBeDefined()
  expect(
    screen.getAllByText("Déclaration TVA — T3 2026").length,
  ).toBeGreaterThan(0)
  expect(
    screen
      .getByRole("button", { name: "Mois précédent" })
      .getAttribute("disabled"),
  ).not.toBeNull()
  expect(
    screen
      .getByRole("button", { name: "Mois suivant" })
      .getAttribute("disabled"),
  ).not.toBeNull()
})

it("translates the dates, deadlines, event types and demo notice into English", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  render(<Calendar />)

  expect(screen.getByText("Calendar")).toBeDefined()
  expect(screen.getByText("September 2026")).toBeDefined()
  expect(screen.getByRole("note").textContent).toContain(
    "Fictional demonstration data",
  )
  expect(screen.getByText("Sample deadlines")).toBeDefined()
  expect(screen.getAllByText("VAT return — Q3 2026").length).toBeGreaterThan(0)
  expect(screen.getAllByText("Legal deadline").length).toBeGreaterThan(0)
  expect(
    screen
      .getByRole("button", { name: "Previous month" })
      .getAttribute("disabled"),
  ).not.toBeNull()
})

it("translates the fixed examples into Arabic and sets RTL on the document", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<Calendar />)

  expect(screen.getByText("التقويم")).toBeDefined()
  expect(screen.getByText("شتنبر 2026")).toBeDefined()
  expect(screen.getByRole("note").textContent).toContain(
    "بيانات تجريبية افتراضية",
  )
  expect(screen.getByText("مواعيد توضيحية")).toBeDefined()
  expect(
    screen.getAllByText("إقرار الضريبة على القيمة المضافة — الربع الثالث 2026")
      .length,
  ).toBeGreaterThan(0)
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")

  const selectedDay = screen.getByRole("button", {
    name: "عرض أحداث 23 شتنبر 2026",
  })
  fireEvent.click(selectedDay)
  expect(screen.getByText("23 شتنبر")).toBeDefined()
})
