import { render } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { expect, it } from "vitest"
import { Brand, BrandIcon } from "../src/components/Brand"
import { Logo } from "../src/components/nav"

/**
 * The brand mark and the navbar spacing are the two things a redesign is most
 * likely to break silently: an <img> that points at a renamed file still
 * renders (as a broken image), a logo regenerated at another ratio still
 * renders (squashed, because the width/height attributes lie), and a nav gap
 * that shrinks back to a run-on line still renders. None of that fails a type
 * check, so it is asserted here instead.
 */

const read = (path: string) => readFileSync(resolve(process.cwd(), path))
const source = (path: string) => read(path).toString("utf8")

/** PNG width/height, straight out of the IHDR chunk (no image library needed). */
function pngSize(path: string): { width: number; height: number } {
  const bytes = read(path)
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  expect(isPng, `${path} is not a PNG`).toBe(true)
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR")
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

/* --------------------------- the published files -------------------------- */

it("publishes the artwork the component names, as real PNGs, not placeholders", () => {
  // A missing file is the classic silent regression: the <img> still renders,
  // just empty. These are the exact paths Brand/BrandIcon request.
  const files = [
    "public/brand/fatorati-logo.png",
    "public/brand/fatorati-logo-white.png",
    "public/brand/fatorati-icon.png",
    "public/brand/fatorati-icon-white.png",
    "public/brand/fatorati-icon-on-blue.png",
    "public/favicon-32.png",
    "public/icon-192.png",
    "public/icon-512.png",
    "public/apple-touch-icon.png",
  ]
  for (const file of files) {
    const size = pngSize(file)
    expect(size.width, file).toBeGreaterThan(0)
    expect(size.height, file).toBeGreaterThan(0)
  }
  // ICO has its own signature: 0,0,1,0 followed by the image count.
  const ico = read("public/favicon.ico")
  expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0])
  expect(ico.readUInt16LE(4)).toBeGreaterThan(0)
})

it("keeps the master artwork's aspect ratio, and the one the lock-up declares", () => {
  // The component reserves the box from these numbers before the file loads.
  // If the artwork is regenerated at another ratio, the declared size stretches
  // it — the exact squashing the .brand-mark rule in index.css cannot prevent.
  const lockup = pngSize("public/brand/fatorati-logo.png")
  expect(lockup.width / lockup.height).toBeCloseTo(324 / 96, 1)
  expect(pngSize("public/brand/fatorati-logo-white.png").height).toBe(lockup.height)

  const icon = pngSize("public/brand/fatorati-icon.png")
  const iconWhite = pngSize("public/brand/fatorati-icon-white.png")
  expect(icon.width / icon.height).toBeCloseTo(184 / 256, 1)
  // One drawing at one scale: the white icon is the blue icon re-tinted, so a
  // white mark that renders smaller than the blue one at the same CSS height
  // means they drifted apart.
  expect(Math.abs(iconWhite.height - icon.height)).toBeLessThanOrEqual(2)
  expect(Math.abs(iconWhite.width - icon.width)).toBeLessThanOrEqual(2)

  expect(pngSize("public/brand/fatorati-icon-on-blue.png")).toEqual({ width: 1024, height: 1024 })
  expect(pngSize("public/apple-touch-icon.png")).toEqual({ width: 180, height: 180 })
})

it("describes the same icon set in every place that has to know about it", () => {
  const site = JSON.parse(source(".figma/make/site.json")) as {
    icons: { icon: string; appleTouchIcon: string; manifest: string }
    organization: { logoUrl: string }
  }
  const manifest = JSON.parse(source("public/site.webmanifest")) as { icons: { src: string }[] }

  // Every path the build config injects into <head> must be a real file in the
  // document root, or the tab, the home-screen tile and Android's install
  // prompt all 404 while the pages themselves look fine.
  const declared = [site.icons.icon, site.icons.appleTouchIcon, site.icons.manifest, site.organization.logoUrl]
  for (const path of declared) expect(() => read(`public${path}`), path).not.toThrow()

  // The manifest's own icons resolve from `public/` too, and the entity logo is
  // a square PNG: rich results render it at up to 112 px and reject a mark that
  // is smaller, or an SVG.
  for (const icon of manifest.icons) expect(() => read(`public${icon.src}`), icon.src).not.toThrow()
  const logo = pngSize(`public${site.organization.logoUrl}`)
  expect(logo.width).toBe(logo.height)
  expect(logo.width).toBeGreaterThanOrEqual(112)

  // And the entity logo is *not* the 16-48 px tab icon.
  expect(site.organization.logoUrl).not.toBe(site.icons.icon)
})

/* ------------------------------- the component ---------------------------- */

it("renders one <img> per treatment, with the alt/aria contract the callers rely on", () => {
  const blue = render(<Brand height={34} />)
  const blueImg = blue.container.querySelector("img")!
  expect(blueImg.getAttribute("src")).toBe("/brand/fatorati-logo.png")
  expect(blueImg.getAttribute("alt")).toBe("Fatorati")
  expect(blueImg.getAttribute("width")).toBe("115")
  expect(blueImg.getAttribute("height")).toBe("34")

  const white = render(<Brand height={34} tone="white" />)
  expect(white.container.querySelector("img")!.getAttribute("src")).toBe("/brand/fatorati-logo-white.png")

  // `auto` puts both files in the DOM and lets CSS pick — the second one must
  // stay out of the accessibility tree, or the brand is announced twice.
  const auto = render(<Brand tone="auto" />)
  const imgs = auto.container.querySelectorAll("img")
  expect(imgs).toHaveLength(2)
  expect(auto.container.querySelector(".brand-mark-auto")).not.toBeNull()
  expect(imgs[1].getAttribute("alt")).toBe("")
  expect(imgs[1].getAttribute("aria-hidden")).toBe("true")

  const icon = render(<BrandIcon size={28} />)
  const iconImg = icon.container.querySelector("img")!
  expect(iconImg.getAttribute("src")).toBe("/brand/fatorati-icon.png")
  expect(iconImg.getAttribute("height")).toBe("28")
  expect(iconImg.getAttribute("aria-hidden")).toBe("true")

  const onBlue = render(<BrandIcon size={32} tone="onBlue" />)
  const onBlueImg = onBlue.container.querySelector("img")!
  expect(onBlueImg.getAttribute("src")).toBe("/brand/fatorati-icon-on-blue.png")
  expect(onBlueImg.getAttribute("width")).toBe("32")
})

it("keeps the dashboard wordmark on the white artwork", () => {
  // `Logo light` is the sidebar/auth treatment: the navy surfaces need the
  // white file, and passing the wrong one is invisible until it is on screen.
  expect(render(<Logo light />).container.querySelector("img")!.getAttribute("src")).toBe("/brand/fatorati-logo-white.png")
  expect(render(<Logo />).container.querySelector("img")!.getAttribute("src")).toBe("/brand/fatorati-logo.png")
  expect(render(<Logo size={38} />).container.querySelector("img")!.getAttribute("height")).toBe("40")
})

/* ------------------------------ navbar spacing ---------------------------- */

it("keeps the page-link words apart, and the underline under the words", () => {
  const css = source("src/marketing/landing.css")
  const rule = css.match(/\.landing-nav-desktop \{([^}]*)\}/)?.[1] ?? ""
  const gap = rule.match(/column-gap:\s*clamp\(([\d.]+)rem[^)]*?([\d.]+)rem\)/)
  expect(gap, "the desktop nav has no fluid column gap").not.toBeNull()

  // The complaint this answers: the links read as one line because the gap was
  // smaller than the space between two words inside a label. Never let the
  // minimum fall back under 1rem, and keep it growing with the viewport.
  const [min, max] = [Number(gap![1]), Number(gap![2])]
  expect(min).toBeGreaterThanOrEqual(1)
  expect(max).toBeGreaterThan(min)

  // The visible separation is gap + padding, and the hover underline must be
  // inset by exactly the padding so it stays under the text, not under the
  // click target. One custom property drives both.
  expect(css).toMatch(/--nav-link-pad:\s*0?\.\d+rem/)
  expect(css).toMatch(/padding-inline:\s*var\(--nav-link-pad\)/)
  expect(css).toMatch(/inset-inline:\s*var\(--nav-link-pad,\s*0\)/)
})
