import { useTranslation } from "../../../lib/language/store.ts"
import type { AuthTranslation } from "../../../i18n/auth.ts"

/**
 * The auth screens' view of the app-wide dictionary.
 *
 * They were written against a private store whose `t` *was* the auth copy, so
 * this scopes the promoted dictionary back down to that section. The components
 * keep writing `t.common.emailLabel` instead of `t.auth.common.emailLabel`, and
 * the return type stays narrow enough that a typo in an auth key is still a
 * compile error.
 */
export function useAuthTranslation(): {
  language: ReturnType<typeof useTranslation>["language"]
  setLanguage: ReturnType<typeof useTranslation>["setLanguage"]
  dir: "rtl" | "ltr"
  t: AuthTranslation
} {
  const { language, setLanguage, dir, t } = useTranslation()
  return { language, setLanguage, dir, t: t.auth }
}
