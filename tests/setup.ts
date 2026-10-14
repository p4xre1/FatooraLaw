import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"
import { DEFAULT_LANGUAGE, useLanguageStore } from "../src/lib/language/store"

afterEach(() => {
  cleanup()
  // Component unmount does not reset the document attributes set by
  // useTranslation(); restore the canonical language too, so an Arabic test
  // cannot leave the next test's (usually French) DOM in RTL.
  if (typeof document !== "undefined") {
    document.documentElement.lang = DEFAULT_LANGUAGE
    document.documentElement.dir = "ltr"
  }
  // The language preference is a module-level zustand singleton, so clearing
  // storage alone would leave the previous test's language active in memory and
  // silently translate the next test's component. Resetting it writes through
  // the persist middleware, and several tests deliberately make storage throw
  // (tests/localStorage.test.tsx simulates a full disk) — vitest restores those
  // mocks only after every afterEach hook has run, so the write is guarded and
  // the storage is cleared immediately below either way.
  try {
    useLanguageStore.setState({ language: DEFAULT_LANGUAGE })
  } catch {
    /* Storage is throwing on purpose; the clear below still resets the test. */
  }
  if (typeof localStorage !== "undefined") localStorage.clear()
  // The development-only local session flag lives in sessionStorage
  // (src/lib/localDevMode.ts); a leftover flag must not leak between tests.
  if (typeof sessionStorage !== "undefined") sessionStorage.clear()
})
