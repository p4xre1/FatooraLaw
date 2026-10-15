import type { LocaleId as Language } from "./locales"
import { PLANS, type PlanCode } from "./plans"

/**
 * What the CMS can change about the plans without a deploy: prices and the
 * selling paragraphs.
 *
 * `lib/plans.ts` holds the defaults — the prices and module lists the product
 * ships with. The catalog is the owner's override layer on top of them, edited
 * from `/admin/subscription-editor` ("الرموز والأسعار") and read by every
 * surface that shows a price or a plan paragraph: the lock page cards, the
 * dashboard strip, Paramètres and the pre-filled WhatsApp message. Change a
 * price in the CMS and all of them quote the new price, because none of them
 * reads `PLANS` directly for display anymore.
 *
 * Copy is per language for the same reason the app is trilingual: an edited
 * French paragraph must not leak into the Arabic card.
 */

export type PlanPrices = { monthly: number; yearly: number }

export type PlanCopy = { tagline: string; value: string }

export type PlanCatalog = {
  /** Prices for the sold plans. FREE is always 0 and is not editable. */
  prices: Record<Exclude<PlanCode, "free">, PlanPrices>
  /** Paragraph overrides, per plan per language; absent = the app copy. */
  copy: Partial<Record<PlanCode, Partial<Record<Language, Partial<PlanCopy>>>>>
}

/** The catalog as shipped: prices from `PLANS`, no paragraph overrides. */
export function defaultCatalog(): PlanCatalog {
  return {
    prices: {
      pro: { monthly: PLANS.pro.monthlyPrice, yearly: PLANS.pro.yearlyPrice },
      boost: { monthly: PLANS.boost.monthlyPrice, yearly: PLANS.boost.yearlyPrice },
    },
    copy: {},
  }
}

/** The price a surface must quote for `code` (MAD / month and MAD / year). */
export function effectivePrices(catalog: PlanCatalog | null, code: PlanCode): PlanPrices {
  if (code === "free") return { monthly: 0, yearly: 0 }
  const override = catalog?.prices[code]
  return {
    monthly: override?.monthly ?? PLANS[code].monthlyPrice,
    yearly: override?.yearly ?? PLANS[code].yearlyPrice,
  }
}

/** The paragraphs a card must print: CMS override first, app copy as fallback. */
export function effectiveCopy(
  catalog: PlanCatalog | null,
  code: PlanCode,
  locale: Language,
  fallback: PlanCopy,
): PlanCopy {
  const override = catalog?.copy[code]?.[locale]
  return {
    tagline: override?.tagline?.trim() ? override.tagline : fallback.tagline,
    value: override?.value?.trim() ? override.value : fallback.value,
  }
}

/** What a year saves against twelve monthly payments, in MAD. */
export function yearlySaving(prices: PlanPrices): number {
  return Math.max(0, prices.monthly * 12 - prices.yearly)
}
