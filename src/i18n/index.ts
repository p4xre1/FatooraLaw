import type { LocaleId } from "../lib/locales.ts"
import { auth } from "./auth.ts"
import { shell } from "./shell.ts"
import { dashboard } from "./dashboard.ts"
import { common } from "./common.ts"
import { shared } from "./shared.ts"
import { audit } from "./audit.ts"
import { team } from "./team.ts"
import { tools } from "./tools.ts"

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
  common: common.en,
  shared: shared.en,
  auth: auth.en,
  sidebar: shell.en,
  dashboard: dashboard.en,
  audit: audit.en,
  team: team.en,
  tools: tools.en,
}

const fr: typeof en = {
  common: common.fr,
  shared: shared.fr,
  auth: auth.fr,
  sidebar: shell.fr,
  dashboard: dashboard.fr,
  audit: audit.fr,
  team: team.fr,
  tools: tools.fr,
}

const ar: typeof en = {
  common: common.ar,
  shared: shared.ar,
  auth: auth.ar,
  sidebar: shell.ar,
  dashboard: dashboard.ar,
  audit: audit.ar,
  team: team.ar,
  tools: tools.ar,
}

export type Translation = typeof en

export const translations: Record<LocaleId, Translation> = { ar, en, fr }
