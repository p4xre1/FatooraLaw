import { MAP_CITIES, MAP_OUTLINE, type CityAggregate } from "../lib/cities"

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

  return (
    <svg viewBox="0 0 100 100" className="h-auto w-full" role="img" aria-label="Maroc">
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
              y={-r - 1.2}
              textAnchor="middle"
              className="fill-ink font-semibold"
              style={{ fontSize: 3.1 }}
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
