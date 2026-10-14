import { act, fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import OnboardingModal from "../src/components/OnboardingModal"
import { useLanguageStore } from "../src/lib/language/store"

it("localises the first-run questionnaire and submits stable IDs in English", () => {
  const onSubmit = vi.fn()
  act(() => useLanguageStore.getState().setLanguage("en"))
  render(<OnboardingModal submitting={false} error={null} onSubmit={onSubmit} />)

  expect(screen.getByText("Welcome to Fatorati")).toBeDefined()
  fireEvent.change(screen.getByLabelText("How did you hear about Fatorati?"), { target: { value: "google_search" } })
  fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "small_company" } })
  expect(screen.getByText("Small company / SME")).toBeDefined()
  fireEvent.click(screen.getByRole("button", { name: "Finish" }))
  expect(onSubmit).toHaveBeenCalledWith({
    referralSource: "google_search",
    referralSourceOther: "",
    businessProfile: "small_company",
    wantsNotifications: true,
  })
})

it("localises first-run options and validation copy in Arabic RTL", () => {
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<OnboardingModal submitting={false} error="حدث خطأ. يرجى المحاولة مجدداً." onSubmit={vi.fn()} />)

  expect(screen.getByText("مرحباً بك في فاطوراتي")).toBeDefined()
  expect(screen.getByLabelText("كيف تعرفت على فاطوراتي؟")).toBeDefined()
  expect(screen.getByText("وسائل التواصل الاجتماعي (Facebook وInstagram وLinkedIn…)")).toBeDefined()
  expect(screen.getAllByRole("combobox")).toHaveLength(2)
  expect(screen.getByText("مقاولة صغيرة / متوسطة")).toBeDefined()
  expect(screen.getByText("حدث خطأ. يرجى المحاولة مجدداً.")).toBeDefined()
  expect(document.documentElement.lang).toBe("ar")
  expect(document.documentElement.dir).toBe("rtl")
})
