import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import {
  defaultCatalog, type PlanCatalog, type PlanCopy,
} from "../lib/planCatalog"
import type { PlanCode } from "../lib/plans"
import type { LocaleId as Language } from "../lib/locales"

/**
 * The editable plan catalog (prices + selling paragraphs), persisted in this
 * browser (`fatorati.plan-catalog.v1`).
 *
 * Written by the CMS and read by every priced surface. Like the subscription
 * ledger it is local-first: the edit applies here immediately, and a reset
 * always returns to the shipped defaults in `lib/plans.ts`.
 */

type State = {
  catalog: PlanCatalog
  setPrice: (plan: Exclude<PlanCode, "free">, field: "monthly" | "yearly", value: number) => void
  setCopy: (plan: PlanCode, locale: Language, field: keyof PlanCopy, value: string) => void
  /** Back to the shipped prices, and no paragraph overrides at all. */
  reset: () => void
}

export const usePlanCatalog = create<State>()(
  persist(
    (set) => ({
      catalog: defaultCatalog(),

      setPrice: (plan, field, value) =>
        set((state) => ({
          catalog: {
            ...state.catalog,
            prices: {
              ...state.catalog.prices,
              [plan]: { ...state.catalog.prices[plan], [field]: Number.isFinite(value) && value >= 0 ? value : 0 },
            },
          },
        })),

      setCopy: (plan, locale, field, value) =>
        set((state) => ({
          catalog: {
            ...state.catalog,
            copy: {
              ...state.catalog.copy,
              [plan]: {
                ...state.catalog.copy[plan],
                [locale]: { ...state.catalog.copy[plan]?.[locale], [field]: value },
              },
            },
          },
        })),

      reset: () => set({ catalog: defaultCatalog() }),
    }),
    {
      name: "fatorati.plan-catalog.v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
