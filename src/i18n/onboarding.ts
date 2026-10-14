import type { Language } from "../lib/language/store.ts"
import type { BusinessProfile, ReferralSource } from "../lib/onboardingTypes.ts"

/** First-run questionnaire labels; the submitted answers remain stable IDs. */
const en = {
  title: "Welcome to Fatorati",
  subtitle: "Three quick questions before you explore your dashboard.",
  referralQuestion: "How did you hear about Fatorati?",
  selectAnswer: "Select an answer",
  referralOther: "Please specify (optional)",
  businessQuestion: "How would you describe your business?",
  businessHint: "Small company, self-employed, professional services, tradesperson or individual.",
  notifications: "Receive updates about new features and improvements",
  finish: "Finish",
  error: "Something went wrong. Please try again.",
  referralSource: {
    google_search: "Google search",
    social_media: "Social media (Facebook, Instagram, LinkedIn…)",
    word_of_mouth: "Recommendation from a friend or colleague",
    online_ad: "Online advertisement",
    blog_article: "Article or blog",
    other: "Other",
  } satisfies Record<ReferralSource, string>,
  businessProfile: {
    small_company: "Small company / SME",
    self_employed: "Self-employed",
    professional: "Professional services (lawyer, accountant, consultant…)",
    tradesperson: "Tradesperson / skilled worker",
    individual: "Individual",
  } satisfies Record<BusinessProfile, string>,
}

type OnboardingCopy = typeof en

const fr: OnboardingCopy = {
  title: "Bienvenue sur Fatorati",
  subtitle: "Trois petites questions avant de découvrir votre tableau de bord.",
  referralQuestion: "Comment avez-vous connu Fatorati ?",
  selectAnswer: "Sélectionnez une réponse",
  referralOther: "Précisez (optionnel)",
  businessQuestion: "Comment décririez-vous votre activité ?",
  businessHint: "Petite entreprise, indépendant, profession libérale, artisan ou particulier.",
  notifications: "Recevoir des notifications sur les nouveautés et mises à jour",
  finish: "Terminer",
  error: "Une erreur est survenue. Veuillez réessayer.",
  referralSource: {
    google_search: "Recherche sur Google",
    social_media: "Réseaux sociaux (Facebook, Instagram, LinkedIn…)",
    word_of_mouth: "Recommandation d'un proche ou collègue",
    online_ad: "Publicité en ligne",
    blog_article: "Article ou blog",
    other: "Autre",
  },
  businessProfile: {
    small_company: "Petite entreprise / PME",
    self_employed: "Indépendant / Auto-entrepreneur",
    professional: "Profession libérale (avocat, comptable, consultant…)",
    tradesperson: "Artisan / Corps de métier",
    individual: "Particulier",
  },
}

const ar: OnboardingCopy = {
  title: "مرحباً بك في فاطوراتي",
  subtitle: "ثلاثة أسئلة سريعة قبل استكشاف لوحة التحكم.",
  referralQuestion: "كيف تعرفت على فاطوراتي؟",
  selectAnswer: "اختر إجابة",
  referralOther: "يرجى التوضيح (اختياري)",
  businessQuestion: "كيف تصف نشاطك؟",
  businessHint: "مقاولة صغيرة، عمل مستقل، مهنة حرة، حرفة أو فرد.",
  notifications: "تلقي إشعارات حول الميزات والتحديثات الجديدة",
  finish: "إنهاء",
  error: "حدث خطأ. يرجى المحاولة مجدداً.",
  referralSource: {
    google_search: "بحث عبر Google",
    social_media: "وسائل التواصل الاجتماعي (Facebook وInstagram وLinkedIn…)",
    word_of_mouth: "توصية من صديق أو زميل",
    online_ad: "إعلان عبر الإنترنت",
    blog_article: "مقال أو مدونة",
    other: "أخرى",
  },
  businessProfile: {
    small_company: "مقاولة صغيرة / متوسطة",
    self_employed: "عمل مستقل",
    professional: "مهنة حرة (محامٍ أو محاسب أو مستشار…)",
    tradesperson: "حرفي / عامل متخصص",
    individual: "فرد",
  },
}

export const onboarding: Record<Language, OnboardingCopy> = { ar, en, fr }
