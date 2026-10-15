/**
 * The Fatorati brand mark.
 *
 * One component, because the logo appears on nine surfaces — the landing
 * header, the mobile menu, the footer, the product mock-up on the homepage,
 * both auth panels, the 404 page and the dashboard sidebar — and each of them
 * needs one of three treatments:
 *
 *   tone="blue"   the blue artwork. Light backgrounds (landing, auth form
 *                 panel, 404, dashboard content).
 *   tone="white"  the white artwork, for the dark navy surfaces (the landing
 *                 header in dark theme, the auth brand panel, the sidebar).
 *   tone="auto"   both files are rendered and CSS shows the right one for the
 *                 element's background (`[data-theme='dark']` on the landing
 *                 root). Rendering both costs one small image that is already
 *                 cached on every page, and it means the markup does not have
 *                 to know which theme is active — no flash while a script
 *                 decides, and the mark is correct even with JavaScript off.
 *
 * The files are produced by `scripts/brand-assets.py` from the master artwork
 * in `brand/source/`. Never hand-edit a file in `public/brand/`: regenerate it.
 *
 * Sizing: `height` is the height of the whole lock-up. The wordmark's cap
 * height is ~0.43 of that, so `height={34}` gives the same optical size as the
 * old 21 px text wordmark next to a 32 px tile, with a slightly larger icon.
 */

/** Displayed height (px) → intrinsic size, so the browser reserves the space. */
const LOCKUP_RATIO = 324 / 96 // public/brand/fatorati-logo.png
const ICON_RATIO = 184 / 256 // public/brand/fatorati-icon.png

type Tone = "blue" | "white" | "auto"

function Source({ file }: { file: string }) {
  return file === "white" ? "/brand/fatorati-logo-white.png" : "/brand/fatorati-logo.png"
}

/**
 * The horizontal lock-up: icon + "FATORATI".
 *
 * `alt` defaults to the brand name. The theme-duplicate artwork in the `auto`
 * treatment repeats the same `alt` but stays `aria-hidden`, so a screen reader
 * still announces the name once while crawlers and SEO auditors never see an
 * image without descriptive alt text.
 */
export function Brand({ height = 34, tone = "blue", alt = "Fatorati", className = "" }: {
  height?: number
  tone?: Tone
  alt?: string
  className?: string
}) {
  const width = Math.round(height * LOCKUP_RATIO)
  const name = alt || "Fatorati"
  if (tone !== "auto") {
    return (
      <img
        src={Source({ file: tone })}
        alt={name}
        width={width}
        height={height}
        decoding="async"
        className={`brand-mark ${className}`}
      />
    )
  }
  return (
    <span className={`brand-mark brand-mark-auto ${className}`}>
      <img src="/brand/fatorati-logo.png" alt={name} width={width} height={height} decoding="async" className="brand-on-light" />
      <img src="/brand/fatorati-logo-white.png" alt={name} aria-hidden="true" width={width} height={height} decoding="async" className="brand-on-dark" />
    </span>
  )
}

/**
 * The icon alone — the compact mark for places where the wordmark would not
 * fit: the collapsed sidebar and the browser tab. `tone="onBlue"` draws the
 * white artwork on the solid brand-blue square, the app-icon treatment.
 */
export function BrandIcon({ size = 28, tone = "blue", alt = "", className = "" }: {
  size?: number
  tone?: "blue" | "white" | "onBlue"
  alt?: string
  className?: string
}) {
  const file = tone === "onBlue" ? "/brand/fatorati-icon-on-blue.png" : tone === "white" ? "/brand/fatorati-icon-white.png" : "/brand/fatorati-icon.png"
  const isSquare = tone === "onBlue"
  return (
    <img
      src={file}
      alt={alt}
      aria-hidden={alt ? undefined : "true"}
      width={isSquare ? size : Math.round(size * ICON_RATIO)}
      height={size}
      decoding="async"
      className={`brand-mark ${className}`}
    />
  )
}
