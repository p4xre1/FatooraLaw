import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import Tools from "../src/modules/Tools"
import Settings from "../src/modules/Settings"
import Projects from "../src/modules/Projects"
import Inventory from "../src/modules/Inventory"
import LegalVault from "../src/modules/LegalVault"
import { MAX_QUANTITY } from "../src/lib/businessValidation"
import Procurement from "../src/modules/Procurement"
import { useMizan } from "../src/store/useMizan"
import { seedContacts, seedExpenses, seedProjects, seedStock, seedTools } from "../src/store/seed"
import { useLanguageStore } from "../src/lib/language/store"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 12, 12))
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("Tester", "tester@example.com", "owner", "modules-account")
  useMizan.setState({ contacts: structuredClone(seedContacts), expenses: structuredClone(seedExpenses), tools: structuredClone(seedTools) })
})
afterEach(() => vi.useRealTimers())

it("keeps newly created subscriptions when navigating away and returning", () => {
  const view = render(<Tools />)
  fireEvent.click(screen.getByRole("button", { name: "Ajouter un outil" }))
  fireEvent.change(screen.getByLabelText("Nom de l'outil"), { target: { value: "My saved subscription" } })
  fireEvent.change(screen.getByLabelText("Coût mensuel (MAD)"), { target: { value: "19.50" } })
  fireEvent.click(screen.getByRole("button", { name: "Ajouter" }))
  expect(screen.getByText("My saved subscription")).toBeDefined()
  view.unmount()
  render(<Tools />)
  expect(screen.getByText("My saved subscription")).toBeDefined()
})

it("marks an expired subscription as expired using the real calendar date", () => {
  render(<Tools />)
  const row = screen.getByText("Microsoft 365 Business").closest("tr")!
  expect(within(row).getByText("Expiré")).toBeDefined()
})

it("updates a supplier-name search after the contact changes without changing the query", () => {
  render(<Procurement />)
  fireEvent.change(screen.getByPlaceholderText("Rechercher libellé, catégorie, fournisseur…"), { target: { value: "Renamed supplier" } })
  expect(screen.getByText("Aucune dépense.")).toBeDefined()
  act(() => useMizan.getState().updateContact("sp1", { name: "Renamed supplier" }))
  expect(screen.queryByText("Aucune dépense.")).toBeNull()
  expect(screen.getAllByText("Renamed supplier").length).toBeGreaterThan(0)
})

it("does not allow saving an out-of-range or empty tax rate", () => {
  render(<Settings />)
  fireEvent.change(screen.getByLabelText("Taux de TVA (%)"), { target: { value: "150" } })
  expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText("Taux de TVA (%)"), { target: { value: "" } })
  expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true)
})


it("requires a finite nonnegative expense amount, and preserves a valid decimal", () => {
  render(<Procurement />)
  fireEvent.click(screen.getByRole("button", { name: "Nouvelle dépense" }))
  const amount = screen.getByLabelText("Montant (MAD)")
  const save = screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement
  for (const value of ["", "-1", "1e309", "1000000000000"]) {
    fireEvent.change(amount, { target: { value } })
    expect(save.disabled).toBe(true)
  }
  fireEvent.change(amount, { target: { value: "19.50" } })
  fireEvent.click(save)
  expect(useMizan.getState().expenses[0].amount).toBe(19.5)
})

it("disables a project with negative financial values but permits explicit zero budgets", () => {
  render(<Projects />)
  fireEvent.click(screen.getByRole("button", { name: "Nouveau projet" }))
  fireEvent.change(screen.getByLabelText("Nom du projet"), { target: { value: "Valid project" } })
  fireEvent.change(screen.getByLabelText("Budget (MAD)", { exact: false }), { target: { value: "-1" } })
  expect((screen.getByRole("button", { name: "Créer le projet" }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText("Budget (MAD)", { exact: false }), { target: { value: "0" } })
  fireEvent.click(screen.getByRole("button", { name: "Créer le projet" }))
  expect(useMizan.getState().projects[0]).toMatchObject({ name: "Valid project", budget: 0, cost: 0 })
})

it("blocks negative, empty, or oversized stock inputs and preserves fractional quantities", () => {
  render(<Inventory />)
  fireEvent.click(screen.getByRole("button", { name: "Nouvel article" }))
  fireEvent.change(screen.getByLabelText("Désignation"), { target: { value: "Valid material" } })
  const save = screen.getByRole("button", { name: "Ajouter au stock" }) as HTMLButtonElement
  for (const value of ["", "-1", "1e309", String(MAX_QUANTITY + 1)]) {
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value } })
    expect(save.disabled).toBe(true)
  }
  fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "2.125" } })
  fireEvent.change(screen.getByLabelText("Seuil minimum"), { target: { value: "-1" } })
  expect(save.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText("Seuil minimum"), { target: { value: "0" } })
  fireEvent.click(save)
  expect(useMizan.getState().stock[0]).toMatchObject({ name: "Valid material", qty: 2.125, minQty: 0 })
})

it("requires an explicit valid contract value rather than silently making it zero", () => {
  render(<LegalVault />)
  fireEvent.click(screen.getByRole("button", { name: /Contrat de prestation/ }))
  fireEvent.change(screen.getByLabelText("Intitulé du contrat"), { target: { value: "Test contract" } })
  const create = screen.getByRole("button", { name: "Enregistrer le brouillon" }) as HTMLButtonElement
  expect(create.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText("Valeur (MAD)", { exact: false }), { target: { value: "-1" } })
  expect(create.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText("Valeur (MAD)", { exact: false }), { target: { value: "0" } })
  fireEvent.click(create)
  expect(useMizan.getState().contracts[0]).toMatchObject({ title: "Test contract", value: 0 })
})

it("allows a zero tax rate and clears saved feedback when the draft changes", () => {
  render(<Settings />)
  fireEvent.change(screen.getByLabelText("Taux de TVA (%)"), { target: { value: "0" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
  expect(useMizan.getState().settings.taxRate).toBe(0)
  expect(screen.getByRole("button", { name: "Enregistré" })).toBeDefined()
  fireEvent.change(screen.getByLabelText("Raison sociale"), { target: { value: "Unsaved draft" } })
  expect(screen.queryByRole("button", { name: "Enregistré" })).toBeNull()
})

it("refreshes subscription expiry after local midnight without needing a page reload", () => {
  vi.setSystemTime(new Date(2026, 9, 11, 23, 59, 30))
  useMizan.setState({ tools: [{ id: "midnight", name: "Midnight subscription", cost: 10, start: "", expiry: "2026-10-11" }] })
  render(<Tools />)
  const row = screen.getByText("Midnight subscription").closest("tr")!
  expect(within(row).getByText("Expire dans 0 j")).toBeDefined()
  act(() => vi.advanceTimersByTime(31_000))
  expect(within(row).getByText("Expiré")).toBeDefined()
})


it("renders Tools in English and Arabic from the same app-wide preference as the shell", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  const view = render(<Tools />)
  expect(screen.getByText("Subscriptions & Tools")).toBeDefined()
  expect(screen.getByText("Tracking recurring costs and expiry dates")).toBeDefined()
  expect(screen.getByText("Theoretical amounts of the subscriptions covering each month, without pro-rating. This chart is not a payment history.")).toBeDefined()
  expect(document.documentElement.lang).toBe("en")
  expect(document.documentElement.dir).toBe("ltr")

  view.unmount()
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<Tools />)
  expect(screen.getByText("الاشتراكات والأدوات")).toBeDefined()
  expect(screen.getByText("متابعة التكاليف الدورية وتواريخ الانتهاء")).toBeDefined()
  expect(screen.getByText("هذا الرسم ليس سجلاً للمدفوعات.", { exact: false })).toBeDefined()
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})

it("uses translated labels and grammatical field hints in the tool form", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<Tools />)
  fireEvent.click(screen.getByRole("button", { name: "إضافة أداة" }))
  expect(screen.getByLabelText("اسم الأداة")).toBeDefined()
  expect(screen.getByLabelText("التكلفة الشهرية (MAD)")).toBeDefined()
  expect(screen.getAllByText("اختيارية")).toHaveLength(2)
  expect(screen.getByRole("button", { name: "إلغاء" })).toBeDefined()
  expect(screen.getByRole("button", { name: "إضافة" })).toBeDefined()
})


it("renders project tables and milestones in English from the app-wide language", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  useMizan.setState({ projects: structuredClone(seedProjects), contacts: structuredClone(seedContacts), stock: structuredClone(seedStock) })
  render(<Projects />)
  expect(screen.getByText("Projects")).toBeDefined()
  expect(screen.getByText("Collected")).toBeDefined()
  expect(screen.getAllByText("In progress").length).toBeGreaterThan(0)
  fireEvent.click(screen.getAllByRole("button", { name: "Milestones" })[0])
  expect(screen.getByText("Milestones — phase progress")).toBeDefined()
  expect(screen.getByText("Actual cost")).toBeDefined()
})

it("renders project creation and assignment in Arabic RTL", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  useMizan.setState({ projects: structuredClone(seedProjects), contacts: structuredClone(seedContacts), stock: structuredClone(seedStock) })
  render(<Projects />)
  expect(screen.getByText("المشاريع")).toBeDefined()
  expect(screen.getAllByText("قيد التنفيذ").length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole("button", { name: "مشروع جديد" }))
  expect(screen.getByLabelText("اسم المشروع")).toBeDefined()
  expect(screen.getByText("الميزانية (MAD)")).toBeDefined()
  expect(screen.getByRole("button", { name: "إنشاء المشروع" })).toBeDefined()
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})

it("translates expense filters, categories, approval and the honest receipt notice into English", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  useMizan.setState({ contacts: structuredClone(seedContacts), expenses: [{ ...seedExpenses[0], id: "expense-i18n", method: "transfer", status: "pending", receipt: true, amount: 123.5 }] })
  render(<Procurement />)
  expect(screen.getByText("Purchases & Expenses")).toBeDefined()
  expect(screen.getByText("Materials")).toBeDefined()
  expect(screen.getAllByText("Bank transfer").length).toBeGreaterThan(0)
  expect(screen.getAllByText("Pending").length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole("button", { name: "New expense" }))
  expect(screen.getByText("This is a flag only: no file is attached or stored, and no OCR is run.")).toBeDefined()
  expect(screen.getByText("Amount (MAD)")).toBeDefined()
  expect(screen.getByLabelText("Description")).toBeDefined()
})

it("translates expense categories and controls into Arabic RTL", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  useMizan.setState({ contacts: structuredClone(seedContacts), expenses: [{ ...seedExpenses[0], id: "expense-i18n-ar", method: "check", status: "approved", receipt: false, amount: 123.5 }] })
  render(<Procurement />)
  expect(screen.getByText("المشتريات والمصاريف")).toBeDefined()
  expect(screen.getByText("مواد البناء")).toBeDefined()
  expect(screen.getAllByText("شيك").length).toBeGreaterThan(0)
  expect(screen.getAllByText("تمت الموافقة").length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole("button", { name: "مصروف جديد" }))
  expect(screen.getByText("هذا مجرد مؤشر: لا يتم إرفاق ملف أو حفظه، ولا تُجرى معالجة ضوئية للنصوص (OCR)." )).toBeDefined()
  expect(screen.getByLabelText("الوصف")).toBeDefined()
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})
