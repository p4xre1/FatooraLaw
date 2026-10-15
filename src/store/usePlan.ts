import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { planStatus, type PlanActivation, type PlanStatus } from "../lib/plans"
import { redeemPlanCode } from "../lib/planCodes"
import { controlForSerial, useSubscriptions } from "./useSubscriptions"
import { todayISO } from "../lib/calendarDates"

/**
 * Which plan the signed-in account is on.
 *
 * Kept in its own store, one storage key per account, exactly like the business
 * data in `store/useMizan.ts`: a plan belongs to the account that redeemed the
 * code, so signing into another account must not inherit it (and the previous
 * account's window must still be there when it signs back in).
 *
 * The activation record — code, plan, period, start, end — is all that is
 * persisted. Everything the UI shows (is it active, how many days left, which
 * modules unlock) is derived from it by `lib/plans.ts`, so an expired plan
 * degrades to FREE by itself with no job, timer or write to go wrong.
 */

export const planStorageKey = (userId: string | null) =>
  userId ? `mizan.plan.v1.${encodeURIComponent(userId)}` : "mizan.plan.v1.signed-out"

export type RedeemOutcome =
  | { ok: true; activation: PlanActivation }
  | { ok: false; reason: "format" | "checksum" }

type State = {
  /** The account whose storage is currently loaded, or null when signed out. */
  account: string | null
  activation: PlanActivation | null
  /** Point the store at an account: its own key, its own activation. */
  forAccount: (userId: string | null) => void
  /**
   * Redeem a code for the current account. Returns what happened so the form can
   * say it; the store only writes on success.
   */
  redeem: (code: string, today?: string) => Promise<RedeemOutcome>
  /** Support path: forget the activation of the current account. */
  clear: () => void
}

export const usePlan = create<State>()(
  persist(
    (set, get) => ({
      account: null,
      activation: null,

      forAccount: (userId) => {
        if (get().account === userId) return
        // Order matters, and it is the order `useMizan.signIn` uses: point the
        // storage at the signed-out key *before* clearing the activation,
        // otherwise that clear is written over the previous account's record
        // and its plan is gone when it signs back in. Hydration is then
        // synchronous, and the merge resets anything the new account has not
        // saved — so one account can never see another's plan.
        usePlan.persist.setOptions({ name: planStorageKey(null) })
        set({ account: userId, activation: null })
        usePlan.persist.setOptions({ name: planStorageKey(userId) })
        void usePlan.persist.rehydrate()
      },

      redeem: async (code, today) => {
        const result = await redeemPlanCode(code, get().activation, today)
        if (result.ok) {
          set({ activation: result.activation })
          // Tell the CMS ledger: this serial is live, and these are the real
          // start/end dates the owner asked to see.
          useSubscriptions.getState().markRedeemed(result.activation)
        }
        return result
      },

      clear: () => set({ activation: null }),
    }),
    {
      name: planStorageKey(null),
      storage: createJSONStorage(() => localStorage),
      // Only the activation is data: `account` is session state, and persisting
      // it would point the next visit at a key that may not be the one loaded.
      partialize: (state) => ({ activation: state.activation }),
    },
  ),
)

/**
 * The plan in force for the signed-in account, today — including the owner's
 * hand on it. Subscribing to the ledger makes a freeze or stop made in the CMS
 * apply here in the same tick.
 */
export function usePlanStatus(today = todayISO()): PlanStatus {
  const activation = usePlan((state) => state.activation)
  // Subscribed for reactivity (a CMS freeze/stop re-renders the app at once);
  // the lookup itself goes through the store's getter.
  useSubscriptions((state) => state.records)
  return planStatus(activation, today, controlForSerial(activation?.serial ?? null))
}
