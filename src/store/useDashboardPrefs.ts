import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { planBannerKey } from "../lib/plans"
import { useToday } from "../hooks/useToday"
import { usePlanStatus } from "./usePlan"

/**
 * What the dashboard remembers about itself between visits.
 *
 * It starts with the one preference that has to survive a reload: hiding the
 * plan banner (the line that says which plan is running and how much time is
 * left on it). The chart widgets stay component state on purpose — they are a
 * way to look at one screen right now, not a setting.
 *
 * A dismissal is stored as the *key of the plan window it was made in*
 * (`lib/plans.ts` → `planBannerKey`), never as a permanent off switch. Hiding
 * the banner therefore lasts exactly as long as the sentence on it stays true:
 * when the window closes, a code extends or replaces it, or the owner freezes
 * the subscription from the CMS, the key changes and the banner is back without
 * anyone having to remember to switch it on.
 *
 * Local to the browser, like the language preference: it is a display choice
 * about one screen, not account data, so it does not travel with the plan.
 */

export const DASHBOARD_PREFS_STORAGE_KEY = "fatoora.dashboard.v1"

type State = {
  /** The plan-window key the banner was hidden against, or null when it shows. */
  planBannerOffFor: string | null
  /** Hide the banner for as long as this plan window runs. */
  hidePlanBanner: (key: string) => void
  /** Show it again now — and forget the dismissal, whatever window it was for. */
  showPlanBanner: () => void
  reset: () => void
}

const initial = { planBannerOffFor: null }

export const useDashboardPrefs = create<State>()(
  persist(
    (set) => ({
      ...initial,
      hidePlanBanner: (key) => set({ planBannerOffFor: key }),
      showPlanBanner: () => set({ planBannerOffFor: null }),
      reset: () => set({ ...initial }),
    }),
    {
      name: DASHBOARD_PREFS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

/**
 * The plan banner's visibility, shared by the two places that change it: the
 * banner itself on the dashboard and the toggle in its Widgets panel. Both read
 * this hook, so switching it off in the panel takes the banner off the screen in
 * the same tick — and the panel always shows the state the screen is in.
 */
export function usePlanBanner(): {
  /** False while the client has hidden the banner for this plan window. */
  visible: boolean
  /** Hide it until this plan window ends or changes. */
  hide: () => void
  /** Bring it back. */
  show: () => void
} {
  const key = planBannerKey(usePlanStatus(useToday()))
  const offFor = useDashboardPrefs((state) => state.planBannerOffFor)
  return {
    visible: offFor !== key,
    hide: () => useDashboardPrefs.getState().hidePlanBanner(key),
    show: () => useDashboardPrefs.getState().showPlanBanner(),
  }
}
