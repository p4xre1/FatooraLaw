import { useEffect, useState } from "react"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

/**
 * Appearance: light, dark, or whatever the operating system is doing.
 *
 * A device preference, not account data — like the language, it belongs to
 * the person holding this browser, so it lives in its own persisted store
 * (`fatorati.theme.v1`) rather than in the per-account business settings.
 *
 * How it renders: the dashboard is built on semantic colour tokens
 * (`bg-surface`, `text-ink`, `border-line`, …), and `src/index.css` redefines
 * those tokens under a `.dark` class. Flipping the class on `<html>` is
 * therefore the whole repaint — no component carries a `dark:` copy of
 * itself. The class is applied only while a private (signed-in) screen is on
 * show, from `App.tsx`: the marketing pages and the auth screens keep the
 * light identity they were designed with, and the CMS console keeps its own.
 *
 * The default is light — the appearance the product has always shipped —
 * with dark opt-in from Paramètres → Apparence.
 */

export type ThemeMode = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

/** The three choices, in the order Paramètres offers them. */
export const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"]

export const THEME_STORAGE_KEY = "fatorati.theme.v1"

/** What a choice means right now, given the OS preference. */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "system") return prefersDark ? "dark" : "light"
  return mode
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
}

type ThemeState = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "light",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

/**
 * The theme in force. While the mode is "system" this follows the OS live:
 * flip the OS to dark at sunset and the app follows without a reload.
 */
export function useResolvedTheme(): ResolvedTheme {
  const mode = useThemeStore((state) => state.mode)
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const query = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    setPrefersDark(query.matches)
    query.addEventListener?.("change", onChange)
    return () => query.removeEventListener?.("change", onChange)
  }, [])

  return resolveTheme(mode, prefersDark)
}

/**
 * Put the resolved theme on the document (or take it off). `color-scheme`
 * goes with the class so scrollbars, form controls and the overscroll area
 * agree with the surfaces instead of flashing the light defaults.
 */
export function applyThemeClass(dark: boolean): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.classList.toggle("dark", dark)
  root.style.colorScheme = dark ? "dark" : ""
}
