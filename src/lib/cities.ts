/**
 * Morocco's cities, positioned for the schematic map in Rapports.
 *
 * The map is a projection, not a GIS: real latitude/longitude run through
 * one linear projection into the SVG's 0–100 box, so every city sits where
 * it truly sits relative to the others, on a simplified outline of the
 * country (drawn, not fetched — the app stays offline-capable).
 *
 * Matching a client's free-typed `city` to a dot is normalization only:
 * case, accents and a small alias table (English names, Arabic spellings)
 * fold to the canonical city. A city that matches nothing is never lost:
 * aggregates keep it under its own label, listed beside the map.
 */

export type MapCity = {
  /** Canonical identifier: the normalized French name. */
  id: string
  fr: string
  ar: string
  lat: number
  lng: number
  aliases: readonly string[]
}

/** Linear projection window (mainland + the southern provinces). */
const BOUNDS = { latMin: 20.8, latMax: 36.1, lngMin: -17.4, lngMax: -0.8 }

/**
 * The box the map is drawn in. Not square on purpose: at Morocco's
 * latitude a degree of longitude is ~98 km against ~111 km for a degree
 * of latitude, so a square box stretches the country sideways. The
 * height below (100 × 1698 km ÷ 1624 km ≈ 104.6) keeps one unit the
 * same number of kilometres on both axes.
 */
export const MAP_VIEW = { width: 100, height: 104.6 }

/** lat/lng → the SVG box. */
export function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * MAP_VIEW.width,
    y: ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * MAP_VIEW.height,
  }
}

type CitySeed = [fr: string, ar: string, lat: number, lng: number, aliases?: string[]]

const SEEDS: CitySeed[] = [
  ["Tanger", "طنجة", 35.78, -5.81, ["Tangier", "Tanja"]],
  ["Tétouan", "تطوان", 35.57, -5.37, ["Tetouan", "Titwan"]],
  ["Chefchaouen", "شفشاون", 35.17, -5.26, ["Chaouen"]],
  ["Larache", "العرائش", 35.19, -6.15],
  ["Al Hoceïma", "الحسيمة", 35.25, -3.94, ["Al Hoceima", "Hoceima"]],
  ["Nador", "الناظور", 35.17, -2.93],
  ["Oujda", "وجدة", 34.68, -1.91],
  ["Berkane", "بركان", 34.92, -2.32],
  ["Kénitra", "القنيطرة", 34.25, -6.58, ["Kenitra"]],
  ["Rabat", "الرباط", 34.02, -6.84],
  ["Salé", "سلا", 34.05, -6.8, ["Sale"]],
  ["Fès", "فاس", 34.02, -5.0, ["Fes", "Fez"]],
  ["Taza", "تازة", 34.21, -4.01],
  ["Meknès", "مكناس", 33.89, -5.55, ["Meknes"]],
  ["Ifrane", "إفران", 33.52, -5.11],
  ["Khémisset", "الخميسات", 33.82, -6.07, ["Khemisset"]],
  ["Casablanca", "الدار البيضاء", 33.57, -7.59, ["Casa"]],
  ["Mohammedia", "المحمدية", 33.69, -7.38],
  ["Settat", "سطات", 33.0, -7.62],
  ["Khouribga", "خريبكة", 32.88, -6.91],
  ["El Jadida", "الجديدة", 33.23, -8.5, ["Jadida"]],
  ["Safi", "آسفي", 32.3, -9.24],
  ["Béni Mellal", "بني ملال", 32.34, -6.35, ["Beni Mellal"]],
  ["Marrakech", "مراكش", 31.63, -7.99, ["Marrakesh"]],
  ["Essaouira", "الصويرة", 31.51, -9.77],
  ["Errachidia", "الرشيدية", 31.93, -4.43],
  ["Agadir", "أكادير", 30.43, -9.6],
  ["Tiznit", "تيزنيت", 29.7, -9.73],
  ["Guelmim", "كلميم", 28.99, -10.06],
  ["Laâyoune", "العيون", 27.15, -13.2, ["Laayoune", "El Aaiun"]],
  ["Dakhla", "الداخلة", 23.68, -15.93],
]

/** The cities the map knows, each with its projected point. */
export const MAP_CITIES: (MapCity & { x: number; y: number })[] = SEEDS.map(([fr, ar, lat, lng, aliases = []]) => {
  const { x, y } = project(lat, lng)
  return { id: normalizeCityName(fr), fr, ar, lat, lng, aliases, x, y }
})

/** The country outline, as a projected polygon.
 *
 * Traced clockwise from Cap Spartel along the real coastline, the
 * Algeria and Mauritania borders, and back up the Atlantic — simplified,
 * but every coastal anchor sits seaward of the city it neighbours, so no
 * city dot ever floats in the ocean (the old outline cut Tanger, El
 * Jadida, Safi and Essaouira off into the Atlantic). The geometry test
 * in tests/cities.test.ts keeps every city strictly inside.
 */
export const MAP_OUTLINE: string = (
  [
    // The Mediterranean coast, west → east.
    [35.86, -5.92], [35.93, -5.45], [35.75, -5.30], [35.45, -4.85], [35.28, -3.98],
    [35.42, -2.98], [35.10, -2.22], [34.93, -1.86],
    // The Algeria border, south to the Mauritanian tripoint.
    [34.30, -1.62], [33.20, -1.35], [32.15, -1.20], [31.00, -3.10],
    [29.90, -5.30], [28.70, -7.90], [27.72, -8.58],
    // The Mauritania border: south-east, then west to Cap Blanc.
    [26.20, -10.10], [24.40, -11.90], [22.90, -13.60], [21.60, -15.60], [20.88, -17.02],
    // The Atlantic coast, back north.
    [21.70, -16.85], [23.00, -16.20], [23.95, -16.05], [24.70, -15.30], [26.12, -14.48],
    [27.20, -13.28], [28.45, -11.15], [29.55, -10.15], [30.45, -9.68], [31.55, -9.82],
    [32.33, -9.30], [33.26, -8.56], [33.62, -7.58], [34.08, -6.95], [34.30, -6.62],
    [35.25, -6.20], [35.50, -6.02],
  ] as [number, number][]
)
  .map(([lat, lng]) => {
    const { x, y } = project(lat, lng)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  .join(" ")

/** "  Café Tanger " → "tanger": the form two city names are compared in. */
export function normalizeCityName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

const CITY_INDEX = new Map<string, (typeof MAP_CITIES)[number]>()
for (const city of MAP_CITIES) {
  CITY_INDEX.set(city.id, city)
  CITY_INDEX.set(normalizeCityName(city.ar), city)
  for (const alias of city.aliases) CITY_INDEX.set(normalizeCityName(alias), city)
}

/** The canonical city a free-typed place name means, if the map knows it. */
export function matchCity(rawCity: string): (typeof MAP_CITIES)[number] | null {
  return CITY_INDEX.get(normalizeCityName(rawCity)) ?? null
}

export type CityAggregate = {
  /** Null for a place the map has no dot for — kept, listed, never dropped. */
  city: (typeof MAP_CITIES)[number] | null
  label: string
  clients: number
  spent: number
}

/** Roll client rows up to one aggregate per city, biggest spend first. */
export function aggregateByCity(entries: readonly { city: string; spent: number }[]): CityAggregate[] {
  const byKey = new Map<string, CityAggregate>()
  for (const entry of entries) {
    const city = matchCity(entry.city)
    const key = city ? `map:${city.id}` : `raw:${normalizeCityName(entry.city)}`
    const existing = byKey.get(key)
    if (existing) {
      existing.clients += 1
      existing.spent += entry.spent
    } else {
      byKey.set(key, { city, label: city ? city.fr : entry.city.trim(), clients: 1, spent: entry.spent })
    }
  }
  return [...byKey.values()].sort((a, b) => b.spent - a.spent || b.clients - a.clients)
}
