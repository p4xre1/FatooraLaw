import { expect, it, vi } from "vitest"
import { checkPassword } from "../src/modules/auth/lib/validation"
import { DEFAULT_LANGUAGE, useLanguageStore } from "../src/lib/language/store"
import { DEFAULT_LOCALE } from "../src/lib/locales"

it("enforces password limits in UTF-8 bytes, not just JavaScript code units", () => {
  expect(checkPassword("é".repeat(36))).toBeNull()
  expect(checkPassword("é".repeat(37))).toBe("tooLong")
  expect(checkPassword("a".repeat(72))).toBeNull()
  expect(checkPassword("a".repeat(73))).toBe("tooLong")
  expect(checkPassword("short")).toBe("tooShort")
})

it("validates a corrupted language even at the current persistence version", async () => {
  localStorage.setItem("fatoora.language", JSON.stringify({ state: { language: "unsupported" }, version: 1 }))
  await useLanguageStore.persist.rehydrate()
  expect(useLanguageStore.getState().language).toBe(DEFAULT_LANGUAGE)
})

it("defaults to the locale the marketing site serves unprefixed", () => {
  // The app and the marketing site must not disagree about what "no preference"
  // means: DEFAULT_LOCALE is the unprefixed, canonical, x-default locale.
  expect(DEFAULT_LANGUAGE).toBe(DEFAULT_LOCALE)
  expect(DEFAULT_LANGUAGE).toBe("fr")
})

it("carries a language chosen under the old auth-scoped key over to the app-wide one", async () => {
  // The preference used to live at fatoora.auth.language. Promoting the store
  // must not cost an existing user the Arabic or English they picked.
  localStorage.setItem("fatoora.auth.language", JSON.stringify({ state: { language: "en" }, version: 1 }))
  vi.resetModules()
  const { useLanguageStore: promoted } = await import("../src/lib/language/store")
  await promoted.persist.rehydrate()
  expect(promoted.getState().language).toBe("en")
  expect(localStorage.getItem("fatoora.auth.language")).toBeNull()
})
