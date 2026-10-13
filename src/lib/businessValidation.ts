// Match the practical ranges of the planned numeric(14,2)/(14,3) SQL columns.
export const MAX_AMOUNT = 999_999_999_999.99
export const MAX_QUANTITY = 99_999_999_999.999

export function isNonNegativeNumber(value: unknown, maximum = MAX_AMOUNT): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum
}

/** Empty optional budget fields may explicitly default to zero; required fields may not. */
export function parseAmount(value: string, allowEmpty = false, maximum = MAX_AMOUNT): number | null {
  if (!value.trim()) return allowEmpty ? 0 : null
  const number = Number(value)
  return isNonNegativeNumber(number, maximum) ? number : null
}

export function isTaxRate(value: unknown): value is number {
  return isNonNegativeNumber(value, 100)
}

export function requireAmount(value: unknown, label: string, maximum = MAX_AMOUNT): asserts value is number {
  if (!isNonNegativeNumber(value, maximum)) throw new Error(`${label} doit être un nombre positif ou nul, dans la limite autorisée.`)
}

export function requireBalance(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > MAX_AMOUNT) {
    throw new Error("Le solde doit être un nombre fini dans la limite autorisée.")
  }
}
