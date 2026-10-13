import { useEffect, useRef, useState } from "react"
import { isSupabaseConfigured, supabase } from "../lib/supabase"

export type ReferralSource = "google_search" | "social_media" | "word_of_mouth" | "online_ad" | "blog_article" | "other"
export type BusinessProfile = "small_company" | "self_employed" | "professional" | "tradesperson" | "individual"
export type OnboardingAnswers = {
  referralSource: ReferralSource
  referralSourceOther: string
  businessProfile: BusinessProfile
  wantsNotifications: boolean
}

export const referralSourceLabels: Record<ReferralSource, string> = {
  google_search: "Recherche sur Google",
  social_media: "Réseaux sociaux (Facebook, Instagram, LinkedIn...)",
  word_of_mouth: "Recommandation d'un proche ou collègue",
  online_ad: "Publicité en ligne",
  blog_article: "Article ou blog",
  other: "Autre",
}
export const businessProfileLabels: Record<BusinessProfile, string> = {
  small_company: "Petite entreprise / PME",
  self_employed: "Indépendant / Auto-entrepreneur",
  professional: "Profession libérale (avocat, comptable, consultant...)",
  tradesperson: "Artisan / Corps de métier",
  individual: "Particulier",
}

/** A response row, not account creation, marks completion. Always scoped to the current user. */
export function useOnboarding(userId: string | null) {
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
      if (err) setError("Une erreur est survenue. Veuillez réessayer.")
      else setNeedsOnboarding(false)
    } catch {
      if (request === revision.current) setError("Une erreur est survenue. Veuillez réessayer.")
    } finally {
      if (request === revision.current) setSubmitting(false)
    }
  }

  return { checked, needsOnboarding, submitting, error, submit }
}
