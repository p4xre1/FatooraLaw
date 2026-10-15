import { describe, expect, it } from "vitest"
import { MAP_CITIES, MAP_OUTLINE, MAP_VIEW, project } from "../src/lib/cities"

/**
 * The map's geometry contract. The first outline cut through coastal
 * cities — Tanger, El Jadida, Safi and Essaouira floated in the
 * Atlantic — and a square box stretched the country sideways. These
 * assertions keep every city inside the border and the proportions
 * honest.
 */

const POLYGON: [number, number][] = MAP_OUTLINE.split(" ").map(
  (pair) => pair.split(",").map(Number) as [number, number],
)

function inside(x: number, y: number): boolean {
  let hit = false
  for (let i = 0, j = POLYGON.length - 1; i < POLYGON.length; j = i++) {
    const [xi, yi] = POLYGON[i]
    const [xj, yj] = POLYGON[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

describe("the Morocco outline", () => {
  it("contains every city it draws — no dot in the ocean", () => {
    for (const city of MAP_CITIES) {
      expect(inside(city.x, city.y), city.fr).toBe(true)
    }
  })

  it("keeps the country in its true relative shape", () => {
    const byName = (name: string) => MAP_CITIES.find((c) => c.fr === name)!
    // North to south, in order.
    expect(byName("Tanger").y).toBeLessThan(byName("Rabat").y)
    expect(byName("Rabat").y).toBeLessThan(byName("Agadir").y)
    expect(byName("Agadir").y).toBeLessThan(byName("Dakhla").y)
    // East to west.
    expect(byName("Oujda").x).toBeGreaterThan(byName("Fès").x)
    expect(byName("Fès").x).toBeGreaterThan(byName("Casablanca").x)
    // The southern provinces reach further west than the north does.
    expect(byName("Dakhla").x).toBeLessThan(byName("Agadir").x)
  })

  it("projects into the aspect-true box, never outside it", () => {
    expect(MAP_VIEW.height).toBeGreaterThan(MAP_VIEW.width) // degrees are not square at 28°N
    for (const city of MAP_CITIES) {
      const point = project(city.lat, city.lng)
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(MAP_VIEW.width)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(MAP_VIEW.height)
    }
  })
})
