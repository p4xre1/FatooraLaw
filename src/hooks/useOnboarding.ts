import { useEffect, useState } from "react"
import { isSupabaseConfigured, supabase } from "../lib/supabase"

export type ReferralSource =
  | "google_search"
  | "social_media"
  | "word_of_mouth"
  | "online_ad"
  | "blog_article"
  | "other"

export type BusinessProfile =
  | "small_company"
  | "self_employed"
  | "professional"
  | "tradesperson"
  | "individual"

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

/**
 * Drives the one-time onboarding questionnaire shown the first time a
 * signed-in user reaches the dashboard. A row in `onboarding_responses`
 * is the only signal that a user has already answered — sign-up doesn't
 * create one (see supabase/schema.sql), so its absence after sign-in
 * means "ask them".
 */
export function useOnboarding(signedIn: boolean) {
  const [checked, setChecked] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    if (!isSupabaseConfigured || !signedIn) {
      setChecked(true)
      setNeedsOnboarding(false)
      setUserId(null)
      return () => { mounted = false }
    }

    setChecked(false)
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (!uid) {
        setNeedsOnboarding(false)
        setChecked(true)
        return
      }
      supabase
        .from("onboarding_responses")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle()
        .then(({ data: row, error: err }) => {
          if (!mounted) return
          // Fail open on error (missing table, RLS hiccup, offline...):
          // never block access to the dashboard over the onboarding check.
          setNeedsOnboarding(!err && !row)
          setChecked(true)
        })
    })

    return () => { mounted = false }
  }, [signedIn])

  async function submit(answers: OnboardingAnswers) {
    if (!userId) return
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from("onboarding_responses").insert({
      user_id: userId,
      referral_source: answers.referralSource,
      referral_source_other: answers.referralSourceOther.trim().slice(0, 200),
      business_profile: answers.businessProfile,
      wants_notifications: answers.wantsNotifications,
    })
    setSubmitting(false)
    if (err) {
      setError("Une erreur est survenue. Veuillez réessayer.")
      return
    }
    setNeedsOnboarding(false)
  }

  return { checked, needsOnboarding, submitting, error, submit }
}
