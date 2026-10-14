import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it } from "vitest"
import Settings from "../src/modules/Settings"
import { useLanguageStore } from "../src/lib/language/store"
import { useMizan } from "../src/store/useMizan"

beforeEach(() => {
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("Settings tester", "settings@example.ma", "owner", "settings-i18n")
})

it("renders identity, tax, backup and document settings in English", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  render(<Settings />)
  expect(screen.getByText("Settings")).toBeDefined()
  expect(screen.getByText("Company identity")).toBeDefined()
  expect(screen.getByLabelText("Company name")).toBeDefined()
  expect(screen.getByLabelText("Tax ID")).toBeDefined()
  expect(screen.getByText("Tax and currency")).toBeDefined()
  expect(screen.getByLabelText("VAT rate (%)")).toBeDefined()
  expect(screen.getByRole("button", { name: "Export my local data" })).toBeDefined()
  expect(screen.getByText("This data is not encrypted by the application.", { exact: false })).toBeDefined()
  expect(screen.getByText("Document header and footer")).toBeDefined()

  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(screen.getByRole("button", { name: "Saved" })).toBeDefined()
})

it("translates Settings and logo validation into Arabic and sets RTL", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<Settings />)

  expect(screen.getByText("الإعدادات")).toBeDefined()
  expect(screen.getByLabelText("اسم الشركة")).toBeDefined()
  expect(screen.getByLabelText("المعرّف الضريبي")).toBeDefined()
  expect(screen.getByLabelText("نسبة الضريبة على القيمة المضافة (%)")).toBeDefined()
  expect(screen.getByRole("button", { name: "تصدير بياناتي المحلية" })).toBeDefined()

  fireEvent.change(screen.getByLabelText("ملف الشعار"), {
    target: { files: [new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" })] },
  })
  expect(screen.getByRole("alert").textContent).toContain("اختر صورة بصيغة PNG")
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})
