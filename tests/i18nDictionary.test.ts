import { expect, it } from "vitest"
import { translations } from "../src/i18n"
import { LOCALE_IDS } from "../src/lib/locales"

/**
 * The dictionary's integrity, checked at runtime rather than by eye.
 *
 * `typeof en` already makes a *missing* key a compile error, which is the common
 * failure. What types cannot catch is a key that is present but wrong: an Arabic
 * string with a fragment of another script pasted into it, a value left empty, a
 * French string copied into the Arabic column, or a pluralising function that
 * returns nothing for 1. Those are exactly the defects that survive a
 * monolingual test run and reach a user.
 */

type Leaf = string | ((...args: never[]) => string)

function leaves(
  node: unknown,
  prefix: string,
  out: [string, Leaf][] = [],
): [string, Leaf][] {
  if (typeof node === "string") {
    out.push([prefix, node])
  } else if (typeof node === "function") {
    out.push([prefix, node as Leaf])
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(
      node as Record<string, unknown>,
    )) {
      leaves(value, prefix ? `${prefix}.${key}` : key, out)
    }
  }
  return out
}

/** Resolve a leaf to the strings it can produce, exercising plural branches. */
function render(leaf: Leaf, locale: string): string[] {
  if (typeof leaf === "string") return [leaf]
  // Exercise both sides of number-based plural branches, string interpolation,
  // and the two-string date/aria-label formatters. Passing realistic arguments
  // also ensures no function silently formats `undefined` in the integrity run.
  const fn = leaf as unknown as (...args: unknown[]) => string
  const month = {
    fr: "septembre 2026",
    en: "September 2026",
    ar: "شتنبر 2026",
  }[locale]
  return [fn(1, month), fn(2, month), fn("Fatorati", month), fn("23", month)]
}

const ARABIC =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

/**
 * Leaves that are not a fixed key set. `dashboard.categories` maps a *stored*
 * expense category to its translation, so French maps nothing (French is what is
 * stored) while English and Arabic map the five seeded categories — a deliberate
 * asymmetry, not a missing key. Anything added here should be an open record
 * keyed by data, never by translatable copy.
 */
const OPEN_RECORDS = new Set(["dashboard.categories"])

/**
 * Values intentionally identical in every language. Email addresses are ASCII by
 * specification, so an Arabic-localised placeholder would advertise a mailbox
 * format that cannot exist. Keep this list short and add to it deliberately: the
 * checks below are what stop an untranslated English string reaching the Arabic
 * column, and every entry here is a hole in them.
 */
const LANGUAGE_NEUTRAL = new Set([
  "auth.common.emailPlaceholder",
  "team.emailPlaceholder",
  // Product/service names stay in their registered brand spelling in Arabic.
  "calendar.events.adobe.label",
  "calendar.events.microsoft.label",
  "calendar.events.sage.label",
  "contacts.table.ice",
  "contacts.whatsapp",
  "contacts.phonePlaceholder",
  "procurement.export",
  "reports.pdf",
  "settings.identity.ice",
])
/** Scripts that have no business in any of the three languages we publish. */
const FOREIGN =
  /[\u0400-\u04FF\u0590-\u05FF\u0900-\u097F\u0E00-\u0E7F\u3000-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/

const TREES = LOCALE_IDS.map((id) => ({
  id,
  entries: leaves(translations[id], ""),
}))

function isOpenRecord(path: string): boolean {
  return [...OPEN_RECORDS].some(
    (open) => path === open || path.startsWith(`${open}.`),
  )
}

it("publishes the same keys in every language", () => {
  const [first, ...rest] = TREES
  const keysOf = (tree: typeof TREES[number]) =>
    tree.entries
      .map(([path]) => path)
      .filter((path) => !isOpenRecord(path))
      .sort()
  const keys = keysOf(first)
  expect(keys.length).toBeGreaterThan(100)
  for (const tree of rest) {
    expect(keysOf(tree)).toEqual(keys)
  }
})

it("has no empty value in any language", () => {
  for (const { id, entries } of TREES) {
    for (const [path, leaf] of entries) {
      for (const value of render(leaf, id)) {
        expect(value.trim().length, `${id}: ${path}`).toBeGreaterThan(0)
      }
    }
  }
})

it("keeps every string in the script of its own language", () => {
  for (const { id, entries } of TREES) {
    for (const [path, leaf] of entries) {
      for (const value of render(leaf, id)) {
        // A stray fragment of an unrelated script is how a bad paste ships: it
        // still renders, still typechecks, and only a reader of that language
        // would notice.
        expect(value.match(FOREIGN), `${id}: ${path} -> ${value}`).toBeNull()
        if (LANGUAGE_NEUTRAL.has(path)) continue
        if (id === "ar") {
          // Arabic copy may legitimately contain Latin (brand names, ISO codes,
          // email placeholders) but must contain Arabic.
          expect(ARABIC.test(value), `${id}: ${path} -> ${value}`).toBe(true)
        } else {
          expect(ARABIC.test(value), `${id}: ${path} -> ${value}`).toBe(false)
        }
      }
    }
  }
})

it("does not reuse the French or English string as the Arabic one", () => {
  const byPath = new Map(
    TREES.flatMap(({ id, entries }) =>
      entries.map(([path, leaf]) => [`${id}:${path}`, leaf] as const),
    ),
  )
  const fr = TREES.find((t) => t.id === "fr")!
  let compared = 0
  for (const [path, leaf] of fr.entries) {
    const arabic = byPath.get(`ar:${path}`)!
    // Only compare plain strings: a pluralising function is a different object
    // in each language, and comparing its source would test formatting, not copy.
    if (typeof leaf !== "string" || typeof arabic !== "string") continue
    // Short language-neutral tokens (ISO codes, "Total", "Fatorati") can match.
    if (leaf.length < 4) continue
    if (LANGUAGE_NEUTRAL.has(path)) continue
    compared++
    expect(arabic, `ar:${path} still holds the French "${leaf}"`).not.toBe(leaf)
    const english = byPath.get(`en:${path}`)!
    if (typeof english === "string")
      expect(
        arabic,
        `ar:${path} still holds the English "${english}"`,
      ).not.toBe(english)
  }
  expect(compared).toBeGreaterThan(100)
})
