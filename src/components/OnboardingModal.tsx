import { useState } from "react"
import type { FormEvent } from "react"
import { ArrowRight, Loader2, AlertCircle } from "lucide-react"
import { Btn, Field, Select, Input, Toggle } from "./kit"
import {
  referralSourceLabels,
  businessProfileLabels,
} from "../hooks/useOnboarding"
import type { ReferralSource, BusinessProfile, OnboardingAnswers } from "../hooks/useOnboarding"

/**
 * Blocking, non-dismissible welcome questionnaire — shown once, right
 * after a user's first sign-in (see useOnboarding). There's no close
 * button and no backdrop/Escape dismissal on purpose: this is meant to
 * be answered, not skipped.
 */
export default function OnboardingModal({
  submitting, error, onSubmit,
}: { submitting: boolean; error: string | null; onSubmit: (answers: OnboardingAnswers) => void }) {
  const [referralSource, setReferralSource] = useState<ReferralSource | "">("")
  const [referralOther, setReferralOther] = useState("")
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | "">("")
  const [wantsNotifications, setWantsNotifications] = useState(true)

  const canSubmit = !!referralSource && !!businessProfile && !submitting

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!referralSource || !businessProfile) return
    onSubmit({ referralSource, referralSourceOther: referralOther, businessProfile, wantsNotifications })
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-navy/40 p-4 backdrop-blur-sm" style={{ animation: "mz-fade .15s ease-out" }}>
      <div
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        style={{ animation: "mz-pop .18s ease-out" }}
      >
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-bold tracking-tight text-ink">Bienvenue sur Fatorati</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            Trois petites questions avant de découvrir votre tableau de bord.
          </p>
        </header>

        <form className="space-y-4 overflow-y-auto px-5 py-5" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-serious/20 bg-serious-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-serious">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Field label="Comment avez-vous connu Fatorati ?">
            <Select
              required
              value={referralSource}
              onChange={(e) => setReferralSource(e.target.value as ReferralSource)}
              autoFocus
            >
              <option value="" disabled>Sélectionnez une réponse</option>
              {(Object.keys(referralSourceLabels) as ReferralSource[]).map((k) => (
                <option key={k} value={k}>{referralSourceLabels[k]}</option>
              ))}
            </Select>
          </Field>

          {referralSource === "other" && (
            <Field label="Précisez (optionnel)">
              <Input
                value={referralOther}
                onChange={(e) => setReferralOther(e.target.value)}
                maxLength={200}
                autoFocus
              />
            </Field>
          )}

          <Field label="Comment décririez-vous votre activité ?" hint="Petite entreprise, indépendant, profession libérale, artisan ou particulier.">
            <Select
              required
              value={businessProfile}
              onChange={(e) => setBusinessProfile(e.target.value as BusinessProfile)}
            >
              <option value="" disabled>Sélectionnez une réponse</option>
              {(Object.keys(businessProfileLabels) as BusinessProfile[]).map((k) => (
                <option key={k} value={k}>{businessProfileLabels[k]}</option>
              ))}
            </Select>
          </Field>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
            <span className="text-[12.5px] leading-relaxed text-muted">
              Recevoir des notifications sur les nouveautés et mises à jour
            </span>
            <Toggle checked={wantsNotifications} onChange={setWantsNotifications} />
          </div>

          <Btn type="submit" className="w-full" disabled={!canSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Terminer <ArrowRight className="h-4 w-4" /></>}
          </Btn>
        </form>
      </div>
    </div>
  )
}
