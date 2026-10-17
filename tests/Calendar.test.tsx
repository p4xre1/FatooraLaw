import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import Calendar from "../src/modules/Calendar"
import { useLanguageStore } from "../src/lib/language/store"
import { useMizan } from "../src/store/useMizan"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 23, 12))
  useMizan.getState().signOut()
  useMizan.setState({ calendarEvents: [] })
  localStorage.clear()
})

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it("starts empty with a real month view and no fictional deadlines", () => {
  render(<Calendar />)

  expect(screen.getByText("Calendrier")).toBeDefined()
  expect((screen.getByLabelText("Choisir le mois et l'année") as HTMLInputElement).value).toBe("2026-09")
  expect(screen.getByRole("note").textContent).toContain("rappels personnels")
  expect(screen.getByText("Mes événements et échéances")).toBeDefined()
  expect(screen.getByText(/Rien n'est encore ajouté/)).toBeDefined()
  expect(screen.getByRole("button", { name: "Ajouter un événement" })).toBeDefined()
  expect(screen.getByRole("button", { name: "Mois précédent" }).hasAttribute("disabled")).toBe(false)
  expect(screen.getByRole("button", { name: "Mois suivant" }).hasAttribute("disabled")).toBe(false)
  expect(screen.queryByText("Déclaration TVA — T3 2026")).toBeNull()
})

it("lets the user add and remove custom events and deadlines", () => {
  render(<Calendar />)
  fireEvent.click(screen.getByRole("button", { name: "Ajouter un événement" }))

  fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Rendez-vous avec le comptable" } })
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-25" } })
  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "deadline" } })
  fireEvent.change(screen.getByLabelText("Détails (facultatif)"), { target: { value: "Préparer les justificatifs" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer au calendrier" }))

  expect(screen.getAllByText("Rendez-vous avec le comptable").length).toBeGreaterThan(1)
  expect(screen.getAllByText("Préparer les justificatifs").length).toBeGreaterThan(0)
  expect(screen.getAllByText("Échéance").length).toBeGreaterThan(0)
  expect(useMizan.getState().calendarEvents).toMatchObject([
    { title: "Rendez-vous avec le comptable", date: "2026-09-25", kind: "deadline", note: "Préparer les justificatifs" },
  ])

  fireEvent.click(screen.getByRole("button", { name: "Supprimer Rendez-vous avec le comptable" }))
  expect(screen.queryByText("Rendez-vous avec le comptable")).toBeNull()
  expect(useMizan.getState().calendarEvents).toHaveLength(0)
})

it("navigates between months and jumps to an event selected from the saved list", () => {
  act(() => useMizan.getState().addCalendarEvent({
    title: "Project handover",
    date: "2026-10-07",
    kind: "event",
    note: "Bring the signed documents",
  }))
  render(<Calendar />)

  fireEvent.click(screen.getByRole("button", { name: "Mois suivant" }))
  expect((screen.getByLabelText("Choisir le mois et l'année") as HTMLInputElement).value).toBe("2026-10")
  const savedEvent = screen.getAllByRole("button", { name: /Project handover/ }).find((button) => button.hasAttribute("aria-pressed"))!
  fireEvent.click(savedEvent)
  expect(screen.getByText(/Événements du/)).toBeDefined()
  expect(screen.getAllByText("Bring the signed documents").length).toBeGreaterThan(1)
})

it("jumps directly to any selected month and year", () => {
  render(<Calendar />)

  const monthPicker = screen.getByLabelText("Choisir le mois et l'année") as HTMLInputElement
  fireEvent.change(monthPicker, { target: { value: "1999-12" } })
  expect(monthPicker.value).toBe("1999-12")
  fireEvent.click(screen.getByRole("button", { name: "Mois précédent" }))
  expect(monthPicker.value).toBe("1999-11")
  fireEvent.click(screen.getByRole("button", { name: "Ce mois-ci" }))
  expect(monthPicker.value).toBe("2026-09")
})

it("marks past events as ended without changing their saved records", () => {
  act(() => useMizan.getState().addCalendarEvent({
    title: "Old supplier meeting",
    date: "2026-09-22",
    kind: "event",
    note: "Archive the notes",
  }))
  render(<Calendar />)

  expect(screen.getByText("Passé")).toBeDefined()
  expect(useMizan.getState().calendarEvents[0]).toMatchObject({ title: "Old supplier meeting", date: "2026-09-22" })
})

it("offers separate PDF and PNG exports for the selected week and displayed month", () => {
  render(<Calendar />)

  expect(screen.getByRole("button", { name: "PDF de la semaine" })).toBeDefined()
  expect(screen.getByRole("button", { name: "Image de la semaine" })).toBeDefined()
  expect(screen.getByRole("button", { name: "PDF du mois" })).toBeDefined()
  expect(screen.getByRole("button", { name: "Image du mois" })).toBeDefined()
})

it("opens a print-ready weekly view before invoking the browser PDF dialog", async () => {
  act(() => useMizan.getState().addCalendarEvent({
    title: "Historical supplier deadline",
    date: "2026-09-22",
    kind: "deadline",
    note: "Keep the receipt",
  }))
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined)
  render(<Calendar />)

  fireEvent.click(screen.getByRole("button", { name: "PDF de la semaine" }))
  expect(screen.getByRole("heading", { name: /Semaine ·/ })).toBeDefined()
  expect(screen.getAllByText("Historical supplier deadline").length).toBeGreaterThan(1)
  expect(screen.getAllByText("Passé").length).toBeGreaterThan(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(120) })
  expect(print).toHaveBeenCalledOnce()
})

it("translates the editable calendar into English", () => {
  act(() => useLanguageStore.getState().setLanguage("en"))
  render(<Calendar />)

  expect(screen.getByText("Calendar")).toBeDefined()
  expect(screen.getByText("Add and manage the dates you want to remember")).toBeDefined()
  expect(screen.getByText("Your events and deadlines")).toBeDefined()
  expect(screen.getByText("Nothing added yet. Add your own events and deadlines to get started.")).toBeDefined()
  expect(screen.getByRole("button", { name: "Previous month" }).hasAttribute("disabled")).toBe(false)
})

it("translates the calendar into Arabic and keeps the page RTL", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<Calendar />)

  expect(screen.getByText("التقويم")).toBeDefined()
  expect(screen.getByText("أضف التواريخ التي تريد تذكّرها وأدرها")).toBeDefined()
  expect(screen.getByText("أحداثي ومواعيدي النهائية")).toBeDefined()
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})
