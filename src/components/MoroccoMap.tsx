import { MAP_CITIES, MAP_OUTLINE, MAP_VIEW, type CityAggregate } from "../lib/cities"

/**
 * The schematic Morocco map: one dot per city, sized by what the owner is
 * looking at (client count or collected money), true relative positions on
 * a simplified outline (lib/cities.ts — drawn, never fetched, so the app
 * stays offline-capable).
 *
 * Cities the map has no dot for are not drawn — they are listed beside it
 * (Rapports does that) so no client silently vanishes from the picture.
 * Dots are buttons; the same selection is offered as a real list next to
 * the map for keyboards and small screens.
 */
export default function MoroccoMap({
  aggregates,
  metric,
  selected,
  onSelect,
}: {
  aggregates: CityAggregate[]
  metric: "clients" | "spent"
  /** The selected aggregate's label, or null. */
  selected: string | null
  onSelect: (label: string | null) => void
}) {
  const plotted = aggregates.filter((a) => a.city)
  const max = Math.max(1, ...plotted.map((a) => (metric === "clients" ? a.clients : a.spent)))
  const value = (a: CityAggregate) => (metric === "clients" ? a.clients : a.spent)

  // Labels sit above their dot — except where the previous label is
  // already there (Rabat/Salé, Casablanca/Mohammedia share a coastline),
  // in which case the label goes below instead of on top of it.
  const labelBelow = new Set<string>()
  const placed: { x: number; y: number }[] = []
  for (const a of [...plotted].sort((p, q) => p.city!.y - q.city!.y || p.city!.x - q.city!.x)) {
    const city = a.city!
    if (placed.some((point) => Math.abs(point.x - city.x) < 9 && Math.abs(point.y - city.y) < 3.4)) {
      labelBelow.add(city.id)
      placed.push({ x: city.x, y: city.y + 4.6 })
    } else {
      placed.push({ x: city.x, y: city.y - 3.4 })
    }
  }

  return (
    <svg viewBox={`0 0 ${MAP_VIEW.width} ${MAP_VIEW.height}`} className="h-auto w-full" role="img" aria-label="Maroc">
      <polygon points={MAP_OUTLINE} className="fill-brand-50 stroke-line-strong" strokeWidth={0.5} strokeLinejoin="round" />
      {plotted.map((a) => {
        const city = a.city!
        const r = 1.1 + 2.4 * Math.sqrt(value(a) / max)
        const isSelected = selected === a.label
        return (
          <g
            key={city.id}
            transform={`translate(${city.x.toFixed(1)} ${city.y.toFixed(1)})`}
            onClick={() => onSelect(isSelected ? null : a.label)}
            className="cursor-pointer"
            role="button"
            aria-label={`${city.fr}: ${a.clients}`}
          >
            <title>{`${city.fr} — ${a.clients} · ${a.spent}`}</title>
            <circle r={r + 1.6} className={isSelected ? "fill-brand/20" : "fill-transparent"} />
            <circle
              r={r}
              className={isSelected ? "fill-brand stroke-navy" : "fill-brand/80 stroke-surface"}
              strokeWidth={isSelected ? 0.7 : 0.4}
            />
            <text
              y={labelBelow.has(city.id) ? r + 3.4 : -r - 1.2}
              textAnchor="middle"
              className="fill-ink font-semibold"
              style={{ fontSize: 3, paintOrder: "stroke", stroke: "var(--color-surface)", strokeWidth: 1 }}
            >
              {city.fr}
            </text>
          </g>
        )
      })}
      {/* Cities without clients keep a faint landmark dot, so the map
          reads as Morocco even before the first client lights it up. */}
      {MAP_CITIES.filter((c) => !plotted.some((a) => a.city?.id === c.id)).map((city) => (
        <circle key={city.id} cx={city.x} cy={city.y} r={0.55} className="fill-line-strong" aria-hidden="true" />
      ))}
    </svg>
  )
}
