import { useId, useMemo, useState } from "react"

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"]

type Series = { name: string; color?: string; values: number[] }

function niceMax(v: number): number {
  if (v <= 0) return 10
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {series.map((s, i) => (
        <span key={s.name} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color ?? PALETTE[i] }} />
          {s.name}
        </span>
      ))}
    </div>
  )
}

/** Multi-series area/line chart with crosshair + tooltip. */
export function AreaChart({
  labels, series, height = 240, format = (n: number) => String(n),
}: {
  labels: string[]
  series: Series[]
  height?: number
  format?: (n: number) => string
}) {
  const gid = useId().replace(/:/g, "")
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = height
  const padL = 56
  const padR = 16
  const padT = 14
  const padB = 26
  const iw = W - padL - padR
  const ih = H - padT - padB

  const max = useMemo(() => niceMax(Math.max(1, ...series.flatMap((s) => s.values))), [series])
  const n = labels.length
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => padT + ih - (v / max) * ih

  const ticks = 4
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => (max / ticks) * i)

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((px - padL) / iw) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, idx)))
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`${gid}-g${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? PALETTE[i]} stopOpacity={0.22} />
              <stop offset="100%" stopColor={s.color ?? PALETTE[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* grid + y labels */}
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={padL - 8} y={y(gv) + 3} textAnchor="end" className="fill-faint" style={{ fontSize: 10 }}>
              {format(gv)}
            </text>
          </g>
        ))}

        {/* areas + lines */}
        {series.map((s, si) => {
          const color = s.color ?? PALETTE[si]
          const line = s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ")
          const area = `${line} L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`
          return (
            <g key={si}>
              {si === 0 && <path d={area} fill={`url(#${gid}-g${si})`} />}
              <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          )
        })}

        {/* crosshair */}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="var(--color-line-strong)" strokeWidth={1} strokeDasharray="3 3" />
            {series.map((s, si) => (
              <circle key={si} cx={x(hover)} cy={y(s.values[hover])} r={3.5} fill="var(--color-surface)" stroke={s.color ?? PALETTE[si]} strokeWidth={2} />
            ))}
          </g>
        )}

        {/* x labels (sparse) */}
        {labels.map((l, i) => (
          (n <= 8 || i % Math.ceil(n / 8) === 0) && (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-faint" style={{ fontSize: 10 }}>{l}</text>
          )
        ))}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: 4 }}
        >
          <p className="mb-1 font-semibold text-ink">{labels[hover]}</p>
          {series.map((s, si) => (
            <p key={si} className="tnum flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color ?? PALETTE[si] }} />
              {s.name}: <span className="font-semibold text-ink">{format(s.values[hover])}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/** Grouped/single bar chart with hover tooltip. */
export function BarChart({
  labels, series, height = 240, format = (n: number) => String(n),
}: {
  labels: string[]
  series: Series[]
  height?: number
  format?: (n: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = height
  const padL = 56, padR = 16, padT = 14, padB = 26
  const iw = W - padL - padR
  const ih = H - padT - padB
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)))
  const n = labels.length
  const groupW = iw / n
  const barGap = 4
  const barW = Math.min(26, (groupW - 16) / series.length - barGap)
  const y = (v: number) => padT + ih - (v / max) * ih
  const ticks = 4
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => (max / ticks) * i)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={padL - 8} y={y(gv) + 3} textAnchor="end" className="fill-faint" style={{ fontSize: 10 }}>{format(gv)}</text>
          </g>
        ))}
        {labels.map((l, i) => {
          const gx = padL + i * groupW
          const totalW = series.length * barW + (series.length - 1) * barGap
          const startX = gx + (groupW - totalW) / 2
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={gx} y={padT} width={groupW} height={ih} fill="transparent" />
              {series.map((s, si) => {
                const v = s.values[i]
                const bh = (v / max) * ih
                const bx = startX + si * (barW + barGap)
                return (
                  <rect key={si} x={bx} y={padT + ih - bh} width={barW} height={Math.max(2, bh)} rx={4} fill={s.color ?? PALETTE[si]} opacity={hover === null || hover === i ? 1 : 0.4} />
                )
              })}
              <text x={gx + groupW / 2} y={H - 8} textAnchor="middle" className="fill-faint" style={{ fontSize: 10 }}>{l}</text>
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] shadow-lg">
          <p className="mb-1 font-semibold text-ink">{labels[hover]}</p>
          {series.map((s, si) => (
            <p key={si} className="tnum flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color ?? PALETTE[si] }} />
              {s.name}: <span className="font-semibold text-ink">{format(s.values[hover])}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export function Donut({ segments, size = 150 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = size / 2 - 10
  const c = size / 2
  const circ = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {segments.map((s, i) => {
          const frac = s.value / total
          const dash = frac * circ
          const el = (
            <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={s.color} strokeWidth={14}
              strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          )
          offset += dash
          return el
        })}
      </svg>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="tnum ms-auto font-semibold text-ink">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
