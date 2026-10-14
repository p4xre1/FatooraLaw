import { act, render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { useFormats } from "../src/lib/language/formats"
import { useLanguageStore } from "../src/lib/language/store"

function FormattedValues() {
  const { money, decimalMoney, number } = useFormats()
  return (
    <div>
      <p data-testid="money">{money(1234.56)}</p>
      <p data-testid="decimal-money">{decimalMoney(1234.56)}</p>
      <p data-testid="number">{number(1234.56)}</p>
    </div>
  )
}

it("formats numbers using the same locale as the signed-in interface", () => {
  const view = render(<FormattedValues />)
  const expected = (locale: string) => ({
    money: `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(1235)} MAD`,
    decimalMoney: `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(1234.56)} MAD`,
    number: new Intl.NumberFormat(locale).format(1234.56),
  })

  expect(screen.getByTestId("money").textContent).toBe(expected("fr-MA").money)
  expect(screen.getByTestId("decimal-money").textContent).toBe(expected("fr-MA").decimalMoney)
  expect(screen.getByTestId("number").textContent).toBe(expected("fr-MA").number)

  act(() => useLanguageStore.getState().setLanguage("en"))
  expect(screen.getByTestId("money").textContent).toBe(expected("en").money)
  expect(screen.getByTestId("decimal-money").textContent).toBe(expected("en").decimalMoney)
  expect(screen.getByTestId("number").textContent).toBe(expected("en").number)

  act(() => useLanguageStore.getState().setLanguage("ar"))
  expect(screen.getByTestId("money").textContent).toBe(expected("ar-MA").money)
  expect(screen.getByTestId("decimal-money").textContent).toBe(expected("ar-MA").decimalMoney)
  expect(screen.getByTestId("number").textContent).toBe(expected("ar-MA").number)
})
