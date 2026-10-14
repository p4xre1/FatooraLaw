export { AuthPage } from "./AuthPage"

export { SignInForm } from "./SignIn"
export type { SignInFormProps } from "./SignIn"

export { SignUpForm } from "./SignUp"
export type { SignUpFormProps } from "./SignUp"

export { ForgotPasswordForm } from "./ForgotPassword"
export type { ForgotPasswordFormProps } from "./ForgotPassword"

export { AuthShell } from "./components/AuthShell"

export { useLanguageStore, useTranslation, isRTL, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "../../lib/language/store"
export type { Language } from "../../lib/language/store"
export { LanguageSwitcher } from "../../lib/language/LanguageSwitcher"
export { useAuthTranslation } from "./language/useAuthTranslation"
