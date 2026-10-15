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

/** Projection window: the real boundary's bounding box (see below). */
const BOUNDS = { latMin: 20.787, latMax: 35.951, lngMin: -17.116, lngMax: -1.044 }

/**
 * The box the map is drawn in. Not square on purpose: at Morocco's
 * latitude a degree of longitude is ~98 km against ~111 km for a degree
 * of latitude, so a square box stretches the country sideways. The
 * height below (100 × 1698 km ÷ 1624 km ≈ 104.6) keeps one unit the
 * same number of kilometres on both axes (1 574 km × 1 683 km).
 */
export const MAP_VIEW = { width: 100, height: 106.9 }

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
  // Tanger-Tétouan-Al Hoceïma & the north-west
  ["Asilah", "أصيلة", 35.47, -6.03, ["Assilah", "Arzila"]],
  ["Ksar El Kébir", "القصر الكبير", 35.0, -5.9, ["Ksar el Kebir", "KsarelKebir"]],
  ["Ouezzane", "وزان", 34.8, -5.58, ["Ouazzane"]],
  // Rabat-Salé-Kénitra & the Gharb
  ["Sidi Kacem", "سيدي قاسم", 34.22, -5.71],
  ["Sidi Slimane", "سيدي سليمان", 34.26, -5.93],
  ["Souk Larbaa", "سوق الأربعاء", 34.68, -6.0, ["Souk El Arbaa"]],
  ["Tiflet", "تيفلت", 33.9, -6.31, ["Tifelt"]],
  // The Oriental
  ["Driouch", "الدريوش", 34.98, -3.39],
  ["Taourirt", "تاوريرت", 34.41, -2.9],
  ["Jerada", "جرادة", 34.31, -2.16],
  ["Figuig", "فكيك", 32.11, -1.23],
  ["Bouarfa", "بوعرفة", 32.53, -1.97],
  ["Guercif", "جرسيف", 34.23, -3.37],
  // Fès-Meknès & the Middle Atlas
  ["Taounate", "تاونات", 34.54, -4.64],
  ["Sefrou", "صفرو", 33.83, -4.83],
  ["El Hajeb", "الحاجب", 33.69, -5.37],
  ["Azrou", "أزرو", 33.43, -5.22],
  ["Boulemane", "بولمان", 33.36, -4.75],
  ["Missour", "ميسور", 33.05, -3.99],
  ["Midelt", "ميدلت", 32.68, -4.73],
  // Béni Mellal-Khénifra
  ["Khénifra", "خنيفرة", 32.94, -5.67, ["Khenifra"]],
  ["Fquih Ben Salah", "الفقيه بن صالح", 32.5, -6.69],
  ["Azilal", "أزيلال", 31.96, -6.57],
  // Casablanca-Settat
  ["Berrechid", "برشيد", 33.27, -7.59],
  ["Benslimane", "بنسليمان", 33.61, -7.12],
  ["Sidi Bennour", "سيدي بنور", 32.65, -8.43],
  ["Azemmour", "أزمور", 33.29, -8.34],
  // Marrakech-Safi
  ["Ben Guerir", "بن جرير", 32.24, -7.95, ["Benguerir"]],
  ["Youssoufia", "اليوسفية", 32.25, -8.53],
  ["Kalaat Sraghna", "قلعة السراغنة", 32.06, -7.41, ["Kalaat Sraghna"]],
  // Drâa-Tafilalet
  ["Tinghir", "تنغير", 31.51, -5.53],
  ["Ouarzazate", "ورزازات", 30.93, -6.92],
  ["Zagora", "زاكورة", 30.33, -5.84],
  ["Erfoud", "أرفود", 31.43, -4.24],
  ["Kelaât M'Gouna", "قلعة مكونة", 31.24, -6.13, ["Kelaat Mgouna", "Kelaat M'Gouna"]],
  // Souss-Massa & Guelmim-Oued Noun
  ["Taroudant", "تارودانت", 30.47, -8.87],
  ["Tafraout", "تافراوت", 29.72, -8.98],
  ["Tata", "طاطا", 29.74, -7.97],
  ["Foum Zguid", "فم زكيد", 30.09, -6.87],
  ["Sidi Ifni", "سيدي إفني", 29.38, -10.17],
  ["Tan-Tan", "طانطان", 28.44, -11.1, ["Tan Tan"]],
  // Laâyoune-Sakia El Hamra
  ["Tarfaya", "طرفاية", 27.94, -12.93],
  ["Smara", "السمارة", 26.74, -11.68, ["Es-Semara", "Semara"]],
  ["Boujdour", "بوجدور", 26.13, -14.48],
]

/** The cities the map knows, each with its projected point. */
export const MAP_CITIES: (MapCity & { x: number; y: number })[] = SEEDS.map(([fr, ar, lat, lng, aliases = []]) => {
  const { x, y } = project(lat, lng)
  return { id: normalizeCityName(fr), fr, ar, lat, lng, aliases, x, y }
})

/** The country outline, as a projected polygon.
 *
 * Not a sketch: the real boundary, from Natural Earth's 50 m admin-0
 * data (Morocco and the southern provinces dissolved into a single
 * silhouette, the way the country is drawn at home), Douglas-Peucker
 * simplified to 134 points with a ~3 km seaward buffer so coastal
 * towns sit inside the line its generalisation would otherwise shave.
 * At 1 574 km wide × 1 683 km tall the box above keeps the true
 * proportions — the earlier hand-drawn polygon floated Tanger, El
 * Jadida, Safi and Essaouira in the Atlantic and stretched the rest.
 * tests/cities.test.ts keeps every city strictly inside.
 */
export const MAP_OUTLINE: string = (
  [
    [35.959, -5.403], [35.931, -5.268], [35.896, -5.249], [35.842, -5.308], [35.754, -5.308], [35.491, -5.086],
    [35.308, -4.823], [35.236, -4.621], [35.192, -4.331], [35.310, -3.695], [35.258, -3.582], [35.242, -3.396],
    [35.268, -3.216], [35.436, -2.964], [35.159, -2.825], [35.132, -2.208], [34.994, -2.113], [34.771, -1.773],
    [34.716, -1.763], [34.611, -1.816], [34.473, -1.704], [34.366, -1.758], [34.182, -1.677], [33.785, -1.684],
    [33.571, -1.601], [33.322, -1.648], [33.085, -1.523], [32.889, -1.482], [32.805, -1.427], [32.575, -1.091],
    [32.474, -1.036], [32.320, -1.215], [32.085, -1.205], [32.059, -1.276], [32.100, -2.448], [32.045, -2.858],
    [32.022, -2.907], [31.807, -3.006], [31.675, -3.434], [31.661, -3.759], [31.612, -3.817], [31.362, -3.759],
    [31.204, -3.801], [31.081, -3.599], [30.991, -3.599], [30.938, -3.652], [30.884, -3.975], [30.672, -4.310],
    [30.442, -4.948], [30.146, -5.158], [29.929, -5.438], [29.802, -5.999], [29.790, -6.473], [29.644, -6.495],
    [29.555, -6.579], [29.539, -6.630], [29.585, -7.148], [29.366, -7.471], [29.323, -7.671], [28.695, -8.639],
    [25.969, -8.668], [25.965, -11.986], [23.463, -11.994], [23.290, -12.362], [23.244, -12.607], [22.978, -13.011],
    [22.811, -13.125], [22.697, -13.127], [22.498, -13.064], [21.311, -12.997], [21.299, -16.940], [20.898, -17.033],
    [20.800, -17.019], [20.783, -17.067], [20.859, -17.129], [21.911, -16.959], [22.180, -16.815], [22.300, -16.699],
    [22.358, -16.535], [22.606, -16.387], [22.847, -16.332], [22.961, -16.228], [23.029, -16.203], [23.111, -16.237],
    [23.787, -15.824], [23.646, -15.964], [23.653, -16.005], [23.865, -15.921], [24.096, -15.605], [24.502, -15.208],
    [24.573, -15.058], [24.734, -14.931], [24.877, -14.886], [25.224, -14.873], [25.415, -14.823], [25.937, -14.551],
    [26.173, -14.499], [26.270, -14.439], [26.442, -14.183], [26.516, -13.965], [26.755, -13.599], [27.669, -13.203],
    [27.790, -13.064], [27.935, -12.970], [28.008, -12.799], [28.039, -12.474], [28.158, -11.996], [28.337, -11.566],
    [28.406, -11.449], [28.738, -11.098], [29.088, -10.506], [29.399, -10.224], [29.828, -9.876], [30.119, -9.696],
    [30.351, -9.655], [30.434, -9.680], [30.579, -9.793], [30.625, -9.877], [30.715, -9.905], [30.852, -9.862],
    [31.429, -9.838], [31.729, -9.699], [32.102, -9.373], [32.248, -9.316], [32.588, -9.271], [32.942, -8.857],
    [33.278, -8.528], [33.403, -8.311], [33.668, -7.574], [33.993, -6.920], [34.151, -6.780], [34.790, -6.380],
    [35.809, -5.943], [35.858, -5.629],
  ] as [number, number][]
)
  .map(([lat, lng]) => {
    const { x, y } = project(lat, lng)
    return `${x.toFixed(2)},${y.toFixed(2)}`
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
