import { expect, it } from "vitest"
import { checkPassword } from "../src/modules/auth/lib/validation"
import { useLanguageStore } from "../src/modules/auth/language/useLanguage"

it("enforces password limits in UTF-8 bytes, not just JavaScript code units", () => {
  expect(checkPassword("é".repeat(36))).toBeNull()
  expect(checkPassword("é".repeat(37))).toBe("tooLong")
  expect(checkPassword("a".repeat(72))).toBeNull()
  expect(checkPassword("a".repeat(73))).toBe("tooLong")
  expect(checkPassword("short")).toBe("tooShort")
})

it("validates a corrupted language even at the current persistence version", async () => {
  localStorage.setItem("fatoora.auth.language", JSON.stringify({ state: { language: "unsupported" }, version: 1 }))
  await useLanguageStore.persist.rehydrate()
  expect(useLanguageStore.getState().language).toBe("ar")
})
