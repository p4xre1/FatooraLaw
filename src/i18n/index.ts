import type { LocaleId } from "../lib/locales.ts"
import { auth } from "./auth.ts"

/**
 * The application dictionary: every string the signed-in product shows, in the
 * three languages it publishes, assembled from one section file per area.
 *
 * Sections are written `en` first and then declared `typeof en` for `fr` and
 * `ar`, and the same check is applied again here when the sections are composed.
 * A key that exists in one language and not another is therefore a compile
 * error, never a blank string at runtime — which matters because a missing
 * translation is invisible in a monolingual test run.
 *
 * Adding a screen: create `src/i18n/<area>.ts` exporting `{ ar, en, fr }`, add
 * it to the three objects below, and read it with `useTranslation()` as
 * `t.<area>`.
 */
const en = {
  auth: auth.en,
}

const fr: typeof en = {
  auth: auth.fr,
}

const ar: typeof en = {
  auth: auth.ar,
}

export type Translation = typeof en

export const translations: Record<LocaleId, Translation> = { ar, en, fr }
