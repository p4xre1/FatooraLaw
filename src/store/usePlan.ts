import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { planStatus, type PlanActivation, type PlanStatus } from "../lib/plans"
import { redeemPlanCode } from "../lib/planCodes"
import { controlForSerial, useSubscriptions } from "./useSubscriptions"
import { todayISO } from "../lib/calendarDates"
import { supabase, isSupabaseConfigured } from "../lib/supabase"

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
        if (userId && isSupabaseConfigured) {
          try {
            void supabase.from("account_subscriptions")
              .select("plan,status,current_period_end,created_at")
              .eq("user_id", userId).maybeSingle()
              .then(({ data, error }) => {
                if (error || get().account !== userId) return
                const row = data as { plan?: string; status?: string; current_period_end?: string | null; created_at?: string } | null
                const plan = row?.plan === "business" || row?.plan === "boost" ? "boost" : row?.plan === "pro" ? "pro" : null
                if (!plan || row?.status !== "active" || !row.current_period_end) {
                  set({ activation: null })
                  return
                }
                const dateParts = new Intl.DateTimeFormat("en", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(row.current_period_end))
                const part = (type: string) => dateParts.find((item) => item.type === type)?.value ?? "00"
                const end = new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")) - 1))
                const expiresAt = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`
                const startedAt = row.created_at?.slice(0, 10) ?? todayISO()
                const period: PlanActivation["period"] = new Date(row.current_period_end).getTime() - Date.now() > 180 * 86_400_000 ? "1Y" : "1M"
                set({ activation: { code: "SERVER-ACCOUNT-PLAN", plan, period, startedAt, expiresAt, serial: null } })
              })
          } catch {
            // A test/client stub may not implement table access; keep app boot safe.
          }
        }
      },

      redeem: async (code, today) => {
        // Entitlement is decided by the server. Never fall back to the old
        // bundle-embedded checksum: that would let a key be reused on another
        // account or minted by inspecting the JavaScript bundle.
        if (!get().account) return { ok: false, reason: "checksum" }
        if (!isSupabaseConfigured) {
          // Local preview/development has no real authenticated accounts or
          // server ledger. Keep its legacy demo behavior isolated to this
          // unconfigured mode; production-configured builds never use it.
          const demo = await redeemPlanCode(code, get().activation, today)
          if (demo.ok) {
            set({ activation: demo.activation })
            useSubscriptions.getState().markRedeemed(demo.activation)
          }
          return demo
        }
        const { data, error } = await supabase.rpc("redeem_activation_key", { p_key: code })
        if (error || !data || typeof data !== "object" || !(data as { ok?: boolean }).ok) {
          return { ok: false, reason: "checksum" }
        }
        const result = data as { plan: "pro" | "boost"; period: "1M" | "1Y"; started_at: string; ends_at: string; serial: string }
        const activation: PlanActivation = {
          code: code.trim().toUpperCase(),
          plan: result.plan,
          period: result.period,
          startedAt: result.started_at,
          expiresAt: result.ends_at,
          serial: result.serial,
        }
        set({ activation })
        useSubscriptions.getState().markRedeemed(activation)
        return { ok: true, activation }
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
