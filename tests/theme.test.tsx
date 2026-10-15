import { fireEvent, render, renderHook, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  THEME_STORAGE_KEY, applyThemeClass, resolveTheme, useResolvedTheme, useThemeStore,
} from "../src/lib/theme"
import { useMizan } from "../src/store/useMizan"
import Settings from "../src/modules/Settings"

/**
 * Appearance: a device preference with three states — light, dark, and
 * "follow the OS". What is asserted is the contract Paramètres shows the
 * user: the choice persists on this device, "system" means what the OS
 * means right now, and the `.dark` class App hangs on <html> is the whole
 * repaint (index.css re-bases the colour tokens under it).
 */

function mockPrefersDark(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  localStorage.clear()
  useThemeStore.setState({ mode: "light" })
  applyThemeClass(false)
  mockPrefersDark(false)
})

describe("what a choice means", () => {
  it("resolves explicitly, and defers to the OS only on system", () => {
    expect(resolveTheme("light", true)).toBe("light")
    expect(resolveTheme("light", false)).toBe("light")
    expect(resolveTheme("dark", true)).toBe("dark")
    expect(resolveTheme("dark", false)).toBe("dark")
    expect(resolveTheme("system", true)).toBe("dark")
    expect(resolveTheme("system", false)).toBe("light")
  })

  it("starts light — the appearance the product has always shipped", () => {
    expect(useThemeStore.getState().mode).toBe("light")
    expect(renderHook(() => useResolvedTheme()).result.current).toBe("light")
  })

  it("follows the OS on system, and only on system", () => {
    mockPrefersDark(true)
    useThemeStore.setState({ mode: "system" })
    expect(renderHook(() => useResolvedTheme()).result.current).toBe("dark")

    useThemeStore.setState({ mode: "light" })
    expect(renderHook(() => useResolvedTheme()).result.current).toBe("light")
  })

  it("keeps working where matchMedia does not exist", () => {
    // jsdom has no media queries; the app must degrade to light, not throw.
    // @ts-expect-error deliberately removing the API
    window.matchMedia = undefined
    useThemeStore.setState({ mode: "system" })
    expect(renderHook(() => useResolvedTheme()).result.current).toBe("light")
  })

  it("persists the choice on this device", () => {
    useThemeStore.getState().setMode("dark")
    const stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)!)
    expect(stored.state.mode).toBe("dark")
  })

  it("hangs .dark (and dark color-scheme) on the document, and takes it off", () => {
    applyThemeClass(true)
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe("dark")
    applyThemeClass(false)
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe("")
  })
})

describe("in Paramètres", () => {
  beforeEach(() => {
    useMizan.getState().signOut()
    localStorage.clear()
    useMizan.getState().signIn("Tester", "tester@example.com", "owner", "theme-account")
    useThemeStore.setState({ mode: "light" })
  })

  it("offers Clair / Sombre / Système and applies the click at once", () => {
    render(<Settings />)
    const group = screen.getByRole("radiogroup", { name: "Apparence" })
    expect(group).toBeTruthy()

    fireEvent.click(screen.getByRole("radio", { name: /Sombre/ }))
    expect(useThemeStore.getState().mode).toBe("dark")
    expect(screen.getByRole("radio", { name: /Sombre/ }).getAttribute("aria-checked")).toBe("true")

    fireEvent.click(screen.getByRole("radio", { name: /Système/ }))
    expect(useThemeStore.getState().mode).toBe("system")

    fireEvent.click(screen.getByRole("radio", { name: /Clair/ }))
    expect(useThemeStore.getState().mode).toBe("light")
  })
})
