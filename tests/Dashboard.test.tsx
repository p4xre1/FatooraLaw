import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import Dashboard from "../src/modules/Dashboard"
import { accountStorageKey, useMizan } from "../src/store/useMizan"
import { seedAudit, seedContacts, seedExpenses, seedProjects } from "../src/store/seed"
import { useLanguageStore } from "../src/lib/language/store"

vi.mock("../src/components/charts", () => ({
  Legend: () => null,
  AreaChart: (props: unknown) => <pre data-testid="area-chart">{JSON.stringify(props)}</pre>,
  BarChart: (props: unknown) => <pre data-testid="bar-chart">{JSON.stringify(props)}</pre>,
  Donut: (props: unknown) => <pre data-testid="donut-chart">{JSON.stringify(props)}</pre>,
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 12, 12))
  useMizan.getState().signOut()
  localStorage.clear()
})

afterEach(() => vi.useRealTimers())

it("starts new accounts without made-up business records, identities, subscriptions or activity", () => {
  useMizan.getState().signIn("Real user", "real@example.com", "owner", "empty-dashboard")
  const state = useMizan.getState()
  for (const key of ["projects", "contacts", "expenses", "stock", "contracts", "team", "tools"] as const) expect(state[key]).toEqual([])
  expect(state.settings.company).toBe("")
  expect(state.settings.ice).toBe("")
  expect(state.audit).toHaveLength(1)
  expect(state.audit[0].actor).toBe("Real user")
})

it("shows honest empty states without fake percentages, bank balances or chart data", () => {
  useMizan.setState({ projects: [], contacts: [], expenses: [], audit: [] })
  render(<Dashboard onNavigate={() => {}} />)
  expect(screen.queryByText("+8,2 %")).toBeNull()
  expect(screen.queryByText("+3,1 %")).toBeNull()
  expect(screen.getByText("Aucune donnée financière enregistrée")).toBeDefined()
  expect(screen.getByText("Aucune activité enregistrée.")).toBeDefined()
  expect(screen.queryByTestId("area-chart")).toBeNull()
  expect(screen.queryByTestId("bar-chart")).toBeNull()
})

it("charts exact approved expense amounts by their dates, never estimated monthly income", () => {
  useMizan.setState({
    projects: [{ ...seedProjects[0], id: "real-project", name: "My project", budget: 700, paid: 500, cost: 100 }],
    contacts: [], audit: [],
    expenses: [
      { ...seedExpenses[0], id: "real-july", date: "2026-07-02", amount: 12.35, status: "approved" },
      { ...seedExpenses[0], id: "real-october", date: "2026-10-12", amount: 29.50, status: "approved" },
      { ...seedExpenses[0], id: "not-approved", date: "2026-10-10", amount: 999, status: "pending" },
    ],
  })
  render(<Dashboard onNavigate={() => {}} />)
  const chart = JSON.parse(screen.getByTestId("area-chart").textContent!)
  expect(chart.series).toHaveLength(1)
  expect(chart.series[0].values).toEqual([0, 0, 0, 0, 12.35, 0, 0, 29.5])
  expect(chart.labels.at(-1)).toBe("Oct 2026")
  expect(screen.queryByText("Chiffre d'affaires")).toBeNull()
  expect(screen.getByText("Budgets des projets")).toBeDefined()
})

it("excludes recognizable untouched examples without mutating or deleting the saved records", () => {
  useMizan.getState().signIn("Real user", "real@example.com", "owner", "saved-dashboard")
  useMizan.setState({ projects: structuredClone(seedProjects), contacts: structuredClone(seedContacts), expenses: structuredClone(seedExpenses), audit: structuredClone(seedAudit) })
  const key = accountStorageKey("saved-dashboard")
  const before = localStorage.getItem(key)
  render(<Dashboard onNavigate={() => {}} />)
  expect(screen.getByText("Aucune donnée financière enregistrée")).toBeDefined()
  expect(screen.queryByText("Karim Benjelloun")).toBeNull()
  expect(screen.queryByTestId("area-chart")).toBeNull()
  expect(localStorage.getItem(key)).toBe(before)
  expect(useMizan.getState().projects).toEqual(seedProjects)
})

it("reacts to a real saved expense, preserving quick navigation and Arabic empty states", () => {
  useMizan.setState({ projects: [], contacts: [], expenses: [], audit: [] })
  const navigate = vi.fn()
  render(<Dashboard onNavigate={navigate} />)
  fireEvent.click(screen.getByRole("button", { name: "Créer un projet" }))
  expect(navigate).toHaveBeenCalledWith("projects")
  act(() => useMizan.getState().addExpense({ ...seedExpenses[0], date: "2026-10-12", amount: 19.5, status: "approved" }))
  expect(JSON.parse(screen.getByTestId("area-chart").textContent!).series[0].values.at(-1)).toBe(19.5)
  act(() => useMizan.setState({ expenses: [] }))
  // The dashboard no longer carries its own FR/AR button: it follows the
  // app-wide preference the navigation rail also writes to.
  act(() => useLanguageStore.getState().setLanguage("ar"))
  expect(screen.getByText("لا توجد بيانات مالية مسجلة")).toBeDefined()
})

it("translates the empty state into English, which the old FR/AR dictionary could not", () => {
  useMizan.setState({ projects: [], contacts: [], expenses: [], audit: [] })
  render(<Dashboard onNavigate={vi.fn()} />)
  expect(screen.getByText("Aucune donnée financière enregistrée")).toBeDefined()
  act(() => useLanguageStore.getState().setLanguage("en"))
  expect(screen.getByText("No financial data recorded")).toBeDefined()
  // Direction follows the language, from the same hook the auth screens use.
  expect(document.querySelector(".mz-view")!.getAttribute("dir")).toBe("ltr")
  expect(document.querySelector(".mz-view")!.getAttribute("lang")).toBe("en")
})

it("mirrors to RTL when the preference is Arabic", () => {
  useMizan.setState({ projects: [], contacts: [], expenses: [], audit: [] })
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<Dashboard onNavigate={vi.fn()} />)
  expect(document.querySelector(".mz-view")!.getAttribute("dir")).toBe("rtl")
  expect(document.documentElement.getAttribute("dir")).toBe("rtl")
  expect(document.documentElement.getAttribute("lang")).toBe("ar")
})


it("does not replace existing account records or settings when loading the new empty defaults", () => {
  useMizan.getState().signIn("Real user", "real@example.com", "owner", "existing-real-dashboard")
  useMizan.getState().updateSettings({ company: "My actual company", ice: "Actual registration" })
  useMizan.getState().addProject({ ...seedProjects[0], name: "My saved project", budget: 19.5, paid: 10, cost: 2 })
  useMizan.getState().signOut()
  useMizan.getState().signIn("Real user", "real@example.com", "owner", "existing-real-dashboard")
  expect(useMizan.getState().settings.company).toBe("My actual company")
  expect(useMizan.getState().projects[0]).toMatchObject({ name: "My saved project", budget: 19.5, paid: 10 })
})

it("keeps monthly exports disabled when no dated approved entries exist", () => {
  useMizan.setState({ projects: [], contacts: [], expenses: [], audit: [] })
  render(<Dashboard onNavigate={() => {}} />)
  for (const name of ["CSV", "Excel", "PDF"]) expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true)
})


it("still permits printing real project totals without inventing a dated payment export", () => {
  useMizan.setState({ projects: [{ ...seedProjects[0], id: "real-print", name: "Saved project", budget: 100, paid: 40 }], contacts: [], expenses: [], audit: [] })
  render(<Dashboard onNavigate={() => {}} />)
  expect((screen.getByRole("button", { name: "PDF" }) as HTMLButtonElement).disabled).toBe(false)
  expect((screen.getByRole("button", { name: "CSV" }) as HTMLButtonElement).disabled).toBe(true)
})
