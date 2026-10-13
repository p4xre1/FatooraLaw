import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

afterEach(() => {
  cleanup()
  if (typeof localStorage !== "undefined") localStorage.clear()
  // The development-only local session flag lives in sessionStorage
  // (src/lib/localDevMode.ts); a leftover flag must not leak between tests.
  if (typeof sessionStorage !== "undefined") sessionStorage.clear()
})
