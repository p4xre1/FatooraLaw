import type { LocaleId } from "../lib/locales.ts"
import { auth } from "./auth.ts"
import { shell } from "./shell.ts"
import { dashboard } from "./dashboard.ts"
import { common } from "./common.ts"
import { shared } from "./shared.ts"
import { audit } from "./audit.ts"
import { team } from "./team.ts"
import { tools } from "./tools.ts"
import { calendar } from "./calendar.ts"
import { risk } from "./risk.ts"
import { contacts } from "./contacts.ts"
import { inventory } from "./inventory.ts"
import { legal } from "./legal.ts"
import { projects } from "./projects.ts"
import { procurement } from "./procurement.ts"
import { reports } from "./reports.ts"
import { settings } from "./settings.ts"
import { topbar } from "./topbar.ts"
import { onboarding } from "./onboarding.ts"
import { localSave } from "./localSave.ts"
import { app } from "./app.ts"

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
  calendar: calendar.en,
  risk: risk.en,
  contacts: contacts.en,
  inventory: inventory.en,
  legal: legal.en,
  projects: projects.en,
  procurement: procurement.en,
  reports: reports.en,
  settings: settings.en,
  topbar: topbar.en,
  onboarding: onboarding.en,
  localSave: localSave.en,
  app: app.en,
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
  calendar: calendar.fr,
  risk: risk.fr,
  contacts: contacts.fr,
  inventory: inventory.fr,
  legal: legal.fr,
  projects: projects.fr,
  procurement: procurement.fr,
  reports: reports.fr,
  settings: settings.fr,
  topbar: topbar.fr,
  onboarding: onboarding.fr,
  localSave: localSave.fr,
  app: app.fr,
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
  calendar: calendar.ar,
  risk: risk.ar,
  contacts: contacts.ar,
  inventory: inventory.ar,
  legal: legal.ar,
  projects: projects.ar,
  procurement: procurement.ar,
  reports: reports.ar,
  settings: settings.ar,
  topbar: topbar.ar,
  onboarding: onboarding.ar,
  localSave: localSave.ar,
  app: app.ar,
}

export type Translation = typeof en

export const translations: Record<LocaleId, Translation> = { ar, en, fr }
