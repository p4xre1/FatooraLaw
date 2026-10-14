/** Stable option IDs stored for the user's first-run onboarding response. */
export type ReferralSource = "google_search" | "social_media" | "word_of_mouth" | "online_ad" | "blog_article" | "other"
export type BusinessProfile = "small_company" | "self_employed" | "professional" | "tradesperson" | "individual"

export type OnboardingAnswers = {
  referralSource: ReferralSource
  referralSourceOther: string
  businessProfile: BusinessProfile
  wantsNotifications: boolean
}
