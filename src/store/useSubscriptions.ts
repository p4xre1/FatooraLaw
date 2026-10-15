import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import {
  applyFreeze, applyReactivate, applyStop, applyUnfreeze, controlFor,
  type SubscriptionRecord,
} from "../lib/subscriptionLedger"
import type { PlanActivation, PlanControl } from "../lib/plans"
import { todayISO } from "../lib/calendarDates"

/**
 * The CMS ledger as a store: the owner's subscription records, persisted in
 * this browser (`fatorati.subscriptions.v1`).
 *
 * Two readers: the CMS page (`/admin/subscription-editor`) manages it, and the
 * signed-in app folds the record matching the activation's serial into
 * `planStatus` — which is how a freeze or a stop made here takes effect in the
 * app. Same browser, same storage: honest local-first behaviour, and the
 * records are shaped to map onto `account_subscriptions` when Supabase lands.
 */

type NewSubscription = Omit<SubscriptionRecord, "id" | "startsAt" | "endsAt" | "status" | "frozenAt">

type State = {
  records: SubscriptionRecord[]
  /** Mint a record for a code the builder just generated. */
  issue: (record: NewSubscription) => SubscriptionRecord
  freeze: (id: string, today?: string) => void
  unfreeze: (id: string, today?: string) => void
  stop: (id: string) => void
  reactivate: (id: string, today?: string) => void
  remove: (id: string) => void
  /**
   * The app telling the ledger a code was redeemed: the real start and end
   * replace the projections, so "when did they start, when do they end" is
   * answered with facts, not estimates.
   */
  markRedeemed: (activation: PlanActivation) => void
}

const update = (records: SubscriptionRecord[], id: string, fn: (r: SubscriptionRecord) => SubscriptionRecord) =>
  records.map((record) => (record.id === id ? fn(record) : record))

export const useSubscriptions = create<State>()(
  persist(
    (set) => ({
      records: [],

      issue: (record) => {
        const full: SubscriptionRecord = {
          ...record,
          id: crypto.randomUUID(),
          startsAt: null,
          endsAt: null,
          status: "active",
          frozenAt: null,
        }
        set((state) => ({ records: [full, ...state.records] }))
        return full
      },

      freeze: (id, today = todayISO()) => set((state) => ({ records: update(state.records, id, (r) => applyFreeze(r, today)) })),
      unfreeze: (id, today = todayISO()) => set((state) => ({ records: update(state.records, id, (r) => applyUnfreeze(r, today)) })),
      stop: (id) => set((state) => ({ records: update(state.records, id, applyStop) })),
      reactivate: (id, today = todayISO()) => set((state) => ({ records: update(state.records, id, (r) => applyReactivate(r, today)) })),
      remove: (id) => set((state) => ({ records: state.records.filter((record) => record.id !== id) })),

      markRedeemed: (activation) => {
        if (!activation.serial) return
        set((state) => ({
          records: state.records.map((record) => {
            if (record.serial !== activation.serial || record.status === "stopped") return record
            return {
              ...record,
              startsAt: record.startsAt ?? activation.startedAt,
              endsAt: activation.expiresAt,
            }
          }),
        }))
      },
    }),
    {
      name: "fatorati.subscriptions.v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

/** The owner's control over the signed-in activation, if its serial is known. */
export function controlForSerial(serial: string | null): PlanControl | null {
  if (!serial) return null
  const record = useSubscriptions.getState().records.find((entry) => entry.serial === serial)
  return record ? controlFor(record) : null
}
