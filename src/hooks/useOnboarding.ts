import { useEffect, useRef, useState } from "react"
import { isSupabaseConfigured, supabase } from "../lib/supabase"
import { useAppLanguage } from "../lib/language/store"
import type { BusinessProfile, OnboardingAnswers, ReferralSource } from "../lib/onboardingTypes"
export type { BusinessProfile, OnboardingAnswers, ReferralSource } from "../lib/onboardingTypes"

/** A response row, not account creation, marks completion. Always scoped to the current user. */
export function useOnboarding(userId: string | null) {
  // This hook also runs while App is rendering a marketing URL. Use the
  // side-effect-free preference reader so an Arabic landing page keeps its
  // URL-owned <html lang/dir>; only the onboarding form itself writes those.
  const { t: copy } = useAppLanguage()
  const [checked, setChecked] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const revision = useRef(0)

  useEffect(() => {
    const request = ++revision.current
    const isCurrent = () => request === revision.current
    setNeedsOnboarding(false)
    setSubmitting(false)
    setError(null)
    if (!isSupabaseConfigured || !userId) {
      setChecked(true)
      return () => { revision.current++ }
    }

    setChecked(false)
    async function check() {
      try {
        const { data: row, error: err } = await supabase.from("onboarding_responses")
          .select("user_id").eq("user_id", userId).maybeSingle()
        // Fail open: an unavailable questionnaire must not block the dashboard.
        if (isCurrent()) setNeedsOnboarding(!err && !row)
      } catch {
        if (isCurrent()) setNeedsOnboarding(false)
      } finally {
        if (isCurrent()) setChecked(true)
      }
    }
    void check()
    return () => { revision.current++ }
  }, [userId])

  async function submit(answers: OnboardingAnswers) {
    if (!userId || submitting) return
    const request = revision.current
    setSubmitting(true)
    setError(null)
    try {
      // Retry-safe across tabs and lost responses: update our own answer row
      // if another successful submission has already created it.
      const { error: err } = await supabase.from("onboarding_responses").upsert({
        user_id: userId,
        referral_source: answers.referralSource,
        referral_source_other: answers.referralSource === "other" ? answers.referralSourceOther.trim().slice(0, 200) : "",
        business_profile: answers.businessProfile,
        wants_notifications: answers.wantsNotifications,
      }, { onConflict: "user_id" })
      if (request !== revision.current) return
      if (err) setError(copy.onboarding.error)
      else setNeedsOnboarding(false)
    } catch {
      if (request === revision.current) setError(copy.onboarding.error)
    } finally {
      if (request === revision.current) setSubmitting(false)
    }
  }

  return { checked, needsOnboarding, submitting, error, submit }
}
