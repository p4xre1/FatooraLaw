import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import LegalVault from "../src/modules/LegalVault"
import Reports from "../src/modules/Reports"
import { accountStorageKey, useMizan } from "../src/store/useMizan"
import { seedAudit, seedContacts, seedContracts, seedExpenses, seedProjects, seedSettings } from "../src/store/seed"
import { addCalendarDays } from "../src/lib/calendarDates"
import { useLanguageStore } from "../src/lib/language/store"

const exports = vi.hoisted(() => ({ csv: vi.fn() }))
vi.mock("../src/lib/mizan", async (actual) => ({ ...await actual<typeof import("../src/lib/mizan")>(), toCSV: exports.csv, runAsync: async (task: () => unknown) => task() }))
vi.mock("../src/components/charts", () => ({ BarChart: (props: unknown) => <pre data-testid="report-chart">{JSON.stringify(props)}</pre>, Legend: () => null, Donut: () => null }))

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 13, 12))
  useMizan.getState().signOut(); localStorage.clear()
  useMizan.getState().signIn("Actual user", "actual@example.com", "owner", "legal-reports-account")
  exports.csv.mockReset()
})
afterEach(() => vi.useRealTimers())

it("excludes cached sample contracts and identities without changing saved records", () => {
  useMizan.setState({ contracts: structuredClone(seedContracts), contacts: structuredClone(seedContacts), projects: structuredClone(seedProjects), expenses: structuredClone(seedExpenses), audit: structuredClone(seedAudit), settings: structuredClone(seedSettings) })
  const saved = localStorage.getItem(accountStorageKey("legal-reports-account"))
  render(<LegalVault />)
  expect(screen.getByText("Aucun document enregistré.")).toBeDefined()
  expect(screen.queryByText("Marché travaux — Villa Californie")).toBeNull()
  expect(screen.getByText("Documents (0)")).toBeDefined()
  expect(localStorage.getItem(accountStorageKey("legal-reports-account"))).toBe(saved)
  expect(useMizan.getState().contracts).toEqual(seedContracts)
})

it("does not claim legal certification or fabricate clauses in real document previews", () => {
  useMizan.setState({ contracts: [{ ...seedContracts[0], id: "real-contract", title: "My actual contract", value: 123.45, status: "draft", date: "2026-10-13", clientId: "real-client" }], contacts: [{ ...seedContacts[0], id: "real-client", name: "Actual client" }] })
  render(<LegalVault />)
  expect(screen.queryByText(/Conforme Loi 09-08/)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Voir My actual contract" }))
  expect(screen.getByText("Contenu du contrat non enregistré")).toBeDefined()
  expect(screen.queryByText(/tribunaux de Casablanca/)).toBeNull()
  expect(screen.queryByText(/Article 1 — Objet/)).toBeNull()
  expect(screen.getAllByText(/123,45/).length).toBeGreaterThan(0)
})

it("creates only user-entered draft metadata and leaves sample clients out of the selector", () => {
  useMizan.setState({ contacts: structuredClone(seedContacts) })
  render(<LegalVault />)
  fireEvent.click(screen.getByRole("button", { name: /Contrat de prestation/ }))
  expect(screen.queryByRole("option", { name: "Groupe Immobilier Atlas" })).toBeNull()
  fireEvent.change(screen.getByLabelText("Intitulé du contrat"), { target: { value: "Entered draft" } })
  fireEvent.change(screen.getByLabelText("Valeur (MAD)", { exact: false }), { target: { value: "0" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }))
  expect(useMizan.getState().contracts[0]).toMatchObject({ title: "Entered draft", clientId: "", value: 0, status: "draft" })
})

it("labels status changes as manual tracking, not an electronic signature or email", () => {
  useMizan.setState({ contracts: [{ ...seedContracts[0], id: "tracking", title: "Tracking only", status: "draft", value: 19.5, date: "2026-10-13" }], contacts: [] })
  render(<LegalVault />)
  fireEvent.click(screen.getByRole("button", { name: "Marquer Tracking only comme signé" }))
  expect(useMizan.getState().contracts[0].status).toBe("draft")
  expect(screen.getByText(/ne crée aucune signature électronique/)).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "Confirmer le statut" }))
  expect(useMizan.getState().contracts[0].status).toBe("signed")
  expect(useMizan.getState().audit[0].action).toBe("a marqué le contrat comme signé")
})

it("shows empty reports instead of invented VAT, profits, forecasts or monthly revenue", () => {
  render(<Reports />)
  expect(screen.getByText("Aucune donnée financière enregistrée")).toBeDefined()
  expect(screen.getByText("TVA non calculée")).toBeDefined()
  expect(screen.queryByText(/Résultat net estimé/)).toBeNull()
  expect(screen.queryByText(/Prévision trésorerie \(30j\)/)).toBeNull()
  expect(screen.queryByTestId("report-chart")).toBeNull()
})

it("keeps sample business amounts out of reports without deleting the cache", () => {
  useMizan.setState({ projects: structuredClone(seedProjects), contacts: structuredClone(seedContacts), expenses: structuredClone(seedExpenses), audit: structuredClone(seedAudit) })
  const saved = localStorage.getItem(accountStorageKey("legal-reports-account"))
  render(<Reports />)
  expect(screen.getByText("Aucune donnée financière enregistrée")).toBeDefined()
  expect(screen.queryByTestId("report-chart")).toBeNull()
  expect(localStorage.getItem(accountStorageKey("legal-reports-account"))).toBe(saved)
})

it("uses dated approved expenses and exports exact values without fiscal or income assumptions", async () => {
  useMizan.setState({ projects: [{ ...seedProjects[0], id: "actual-project", name: "Actual project", budget: 700, paid: 200 }], expenses: [{ ...seedExpenses[0], id: "approved", amount: 12.35, date: "2026-10-13" }, { ...seedExpenses[0], id: "pending", amount: 999, status: "pending", date: "2026-10-13" }], contacts: [] })
  render(<Reports />)
  // Two charts now (the money diagram and this monthly one): pick the monthly.
  const chart = screen.getAllByTestId("report-chart")
    .map((el) => JSON.parse(el.textContent!))
    .find((candidate) => candidate.series[0].name === "Dépenses approuvées")
  expect(chart.series).toHaveLength(1)
  expect(chart.series[0].values.at(-1)).toBe(12.35)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Exporter les dépenses" })))
  const rows = exports.csv.mock.calls[0][0]
  expect(rows.at(-1)).toMatchObject({ "Dépenses approuvées": 12.35, "Nombre d'entrées": 1 })
  expect(rows[0]).not.toHaveProperty("Revenus")
  expect(rows[0]).not.toHaveProperty("TVA")
})

it("preserves edited contracts from old caches rather than hiding user changes", () => {
  useMizan.setState({ contracts: [{ ...seedContracts[0], title: "My edited contract", value: 19.5 }], contacts: [], audit: structuredClone(seedAudit) })
  render(<LegalVault />)
  expect(screen.getByText("My edited contract")).toBeDefined()
})

it("tracks a declared send status without pretending to send mail", () => {
  useMizan.setState({ contracts: [{ ...seedContracts[0], id: "sent-tracking", title: "Declared send", status: "draft", date: "2026-10-13" }] })
  render(<LegalVault />)
  fireEvent.click(screen.getByRole("button", { name: "Marquer Declared send comme envoyé" }))
  expect(useMizan.getState().contracts[0].status).toBe("draft")
  fireEvent.click(screen.getByRole("button", { name: "Confirmer le statut" }))
  expect(useMizan.getState().contracts[0].status).toBe("sent")
  expect(useMizan.getState().audit[0].action).toBe("a marqué le contrat comme envoyé")
})

it("reports an actual export failure instead of claiming a report was generated", async () => {
  useMizan.setState({ expenses: [{ ...seedExpenses[0], id: "export-real", date: "2026-10-13", amount: 19.5 }] })
  exports.csv.mockImplementationOnce(() => { throw new Error("blocked") })
  render(<Reports />)
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Exporter les dépenses" })))
  expect(screen.getByRole("alert").textContent).toContain("Échec de l'export")
  expect((screen.getByRole("button", { name: "Exporter les dépenses" }) as HTMLButtonElement).disabled).toBe(false)
})


it("renders legal-draft warnings, templates and fields in English", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  render(<LegalVault />)
  expect(screen.getByText("Legal Vault")).toBeDefined()
  expect(screen.getByText("The structures below are not certified contracts. No complete legal text, email delivery or electronic signature is provided.")).toBeDefined()
  expect(screen.getByText("No saved documents.")).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: /Service agreement/ }))
  expect(screen.getByText("Enter your information. No certified contract text is generated.")).toBeDefined()
  expect(screen.getByLabelText("Contract title")).toBeDefined()
  expect(screen.getByText("Value (MAD)")).toBeDefined()
  expect(screen.getByRole("button", { name: "Save draft" })).toBeDefined()
})

it("renders Arabic legal records and the metadata-only preview in RTL", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  const contract = { ...seedContracts[0], id: "arabic-contract", title: "عقد تجريبي", clientId: "arabic-client", date: "2026-10-13", value: 123.45 }
  useMizan.setState({ contracts: [contract], contacts: [{ ...seedContacts[0], id: "arabic-client", name: "عميل تجريبي" }] })
  render(<LegalVault />)

  expect(screen.getByText("الخزنة القانونية")).toBeDefined()
  expect(screen.getByText("النماذج أدناه ليست عقوداً معتمدة.", { exact: false })).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "عرض عقد تجريبي" }))
  expect(screen.getByText("سجل المستند المحفوظ")).toBeDefined()
  expect(screen.getByText("محتوى العقد غير محفوظ")).toBeDefined()
  expect(screen.getByText(/لم يحدد ما إذا كان قبل الضريبة/)).toBeDefined()
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})


it("translates the fiscal caveats, monthly range and export controls into English", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  render(<Reports />)
  expect(screen.getByText("Reports & Tax")).toBeDefined()
  expect(screen.getByText("No financial data recorded")).toBeDefined()
  expect(screen.getByText("VAT not calculated")).toBeDefined()
  expect(screen.getByLabelText("Expense period")).toBeDefined()
  expect(screen.getByRole("button", { name: "Export expenses" }).getAttribute("disabled")).not.toBeNull()
})

it("translates the fiscal caveats into Arabic and sets RTL", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<Reports />)
  expect(screen.getByText("التقارير والضرائب")).toBeDefined()
  expect(screen.getByText("لا توجد بيانات مالية مسجلة")).toBeDefined()
  expect(screen.getByText("لم يتم احتساب الضريبة على القيمة المضافة")).toBeDefined()
  expect(screen.getByLabelText("فترة المصاريف")).toBeDefined()
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})
