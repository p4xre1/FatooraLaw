import { act, render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import LocalSaveNotice from "../src/components/LocalSaveNotice"
import { useLanguageStore } from "../src/lib/language/store"
import { useMizan, accountStorageKey } from "../src/store/useMizan"
import { useLocalSaveStatus } from "../src/lib/localSaveStatus"

function prepare() {
  useMizan.getState().signOut()
  localStorage.clear()
  useMizan.getState().signIn("Save tester", "save@example.ma", "owner", "save-notice-i18n")
  useLocalSaveStatus.setState({ issue: { key: accountStorageKey("save-notice-i18n"), kind: "quota" } })
}

it("warns in English when a local write failed", () => {
  prepare()
  act(() => useLanguageStore.getState().setLanguage("en"))
  render(<LocalSaveNotice />)
  expect(screen.getByRole("alert").textContent).toContain("Local save failed")
  expect(screen.getByRole("button", { name: "Export a backup" })).toBeDefined()
})

it("warns in Arabic and recommends a backup without changing the local-only behavior", () => {
  prepare()
  act(() => useLanguageStore.getState().setLanguage("ar"))
  render(<LocalSaveNotice />)
  expect(screen.getByRole("alert").textContent).toContain("تعذر الحفظ محلياً")
  expect(screen.getByRole("button", { name: "تصدير نسخة احتياطية" })).toBeDefined()
  expect(document.documentElement.dir).toBe("rtl")
})
