import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it } from "vitest"
import Inventory from "../src/modules/Inventory"
import { useLanguageStore } from "../src/lib/language/store"
import { useMizan } from "../src/store/useMizan"

beforeEach(() => {
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("Inventory tester", "inventory@example.ma", "owner", "inventory-i18n")
  useMizan.setState({
    stock: [{ id: "item-1", name: "Steel bolts", sku: "BOLT-8", qty: 1, minQty: 2, unit: "pcs", assignedProjectId: null, type: "material" }],
    projects: [],
  })
})

it("translates the stock list, warning and creation form into English", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  render(<Inventory />)

  expect(screen.getByText("Stock & Equipment")).toBeDefined()
  expect(screen.getByText("1 item · 1 below minimum")).toBeDefined()
  expect(screen.getByText("Low-stock alert — 1 item")).toBeDefined()
  expect(screen.getByText("Materials")).toBeDefined()
  expect(screen.getByText("Minimum")).toBeDefined()
  expect(screen.getByLabelText("Search inventory")).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "New item" }))
  expect(screen.getByLabelText("Item name")).toBeDefined()
  expect(screen.getByLabelText("Quantity")).toBeDefined()
  expect((screen.getByRole("button", { name: "Add to stock" }) as HTMLButtonElement).disabled).toBe(true)
})

it("translates stock controls into Arabic, including the initial unit and RTL", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<Inventory />)

  expect(screen.getByText("المخزون والمعدات")).toBeDefined()
  expect(screen.getByText("1 صنف · 1 دون الحد الأدنى")).toBeDefined()
  expect(screen.getByText("تنبيه انخفاض المخزون — 1 صنف")).toBeDefined()
  expect(screen.getByLabelText("البحث في المخزون")).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "صنف جديد" }))
  expect(screen.getByLabelText("اسم الصنف")).toBeDefined()
  expect((screen.getByLabelText("الوحدة") as HTMLInputElement).value).toBe("وحدة")
  expect(screen.getByRole("button", { name: "إضافة إلى المخزون" })).toBeDefined()
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})
