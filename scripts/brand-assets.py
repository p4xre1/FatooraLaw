#!/usr/bin/env python3
"""
Generate every published Fatorati brand asset from the master files in
`brand/source/`. Run it again after replacing a master file:

    python3 scripts/brand-assets.py

Outputs (all committed, all referenced from the app):

  public/brand/fatorati-logo.png          blue wordmark (icon + FATORATI), transparent
  public/brand/fatorati-logo-white.png    the same mark in white, for dark surfaces
  public/brand/fatorati-icon.png          icon alone, blue, transparent
  public/brand/fatorati-icon-white.png    icon alone, white, transparent
  public/brand/fatorati-icon-on-blue.png  white icon on the brand blue square (1024)
  public/favicon.ico                      16 / 32 / 48 px, blue icon, transparent
  public/apple-touch-icon.png             180 px, white icon on the brand blue square
  public/icon-192.png, public/icon-512.png  PWA icons (blue square, safe zone kept)
  public/site.webmanifest                 the manifest that names the four icons

Why a script and not hand-exported files: the wordmark is used at four sizes in
three colour treatments, and the icons at five. A file per size, exported by
hand, is how a logo ends up slightly different on the landing page, in the
sidebar and in the browser tab. One master, one script, one result.

Requirements: Python 3 + Pillow (`pip install pillow`). No network access and no
other dependency — this never runs as part of `pnpm build`.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "brand" / "source"
PUBLIC = ROOT / "public"
OUT_BRAND = PUBLIC / "brand"

# The two flat colours the master artwork is drawn with.
BRAND_BLUE = (58, 136, 234)
BRAND_NAVY = (43, 104, 191)
# The treatment the designer used for the white-on-blue version: ribbons white,
# folds a light blue that keeps the fold readable instead of flat white.
WHITE = (255, 255, 255)
FOLD_ON_WHITE = (186, 213, 248)

LOGO_MASTER = SOURCE / "fatorati-logo-blue@4x.png"
ICON_MASTER = SOURCE / "fatorati-icon-blue@4x.png"
ICON_ON_BLUE_MASTER = SOURCE / "fatorati-icon-white-on-blue-1024.png"

# The wordmark is displayed 32-34 px tall; 96 px keeps it crisp on a 3x screen
# without shipping a file nobody needs.
LOGO_HEIGHT = 96
ICON_HEIGHT = 256


def load_flat(path: Path) -> Image.Image:
    """A master file as RGBA, with fully transparent pixels normalised to (0,0,0,0)."""
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                pixels[x, y] = (0, 0, 0, 0)
    return image


def trim(image: Image.Image) -> Image.Image:
    """Crop to the visible artwork so no exported file carries dead margin."""
    box = image.getbbox()
    return image.crop(box) if box else image


def recolour(image: Image.Image, main: tuple[int, int, int], fold: tuple[int, int, int]) -> Image.Image:
    """
    Re-tint a flattened two-shade artwork while keeping its anti-aliasing.

    Every pixel is classified as "main ribbon" or "fold" by which of the two
    source colours it is closer to (in RGB); its alpha — the part that carries
    the smooth edges — is copied across untouched. That is what makes the white
    variant the same drawing rather than a second, slightly different one.
    """
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    src, dst = image.load(), out.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = src[x, y]
            if a == 0:
                continue
            d_main = (r - BRAND_BLUE[0]) ** 2 + (g - BRAND_BLUE[1]) ** 2 + (b - BRAND_BLUE[2]) ** 2
            d_fold = (r - BRAND_NAVY[0]) ** 2 + (g - BRAND_NAVY[1]) ** 2 + (b - BRAND_NAVY[2]) ** 2
            dst[x, y] = (*fold, a) if d_fold < d_main else (*main, a)
    return out


def fit_height(image: Image.Image, height: int) -> Image.Image:
    width = max(1, round(image.width * height / image.height))
    return image.resize((width, height), Image.LANCZOS)


def square(image: Image.Image, size: int, padding_ratio: float = 0.14, background=None) -> Image.Image:
    """
    Centre `image` in a square canvas, leaving `padding_ratio` of the canvas as
    margin. Used for the tab/PWA icons: a maskable icon must keep its artwork
    inside the safe zone, or a host that crops to a circle clips the mark.
    """
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    inner = round(size * (1 - 2 * padding_ratio))
    scaled = image.copy()
    scaled.thumbnail((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    return canvas


def split_wordmark(master: Image.Image) -> tuple[Image.Image, Image.Image]:
    """
    Split the horizontal lock-up into (icon, wordmark) on the widest empty
    vertical band. Doing it by measurement — not by a hard-coded pixel offset —
    keeps this working if the master is re-exported at another size.
    """
    alpha = master.split()[3]
    empty = [x for x in range(master.width) if not any(alpha.getpixel((x, y)) for y in range(master.height))]
    gaps: list[list[int]] = []
    for x in empty:
        if gaps and gaps[-1][-1] == x - 1:
            gaps[-1].append(x)
        else:
            gaps.append([x])
    widest = max(gaps, key=len)
    cut = widest[len(widest) // 2]
    return master.crop((0, 0, cut, master.height)), master.crop((cut, 0, master.width, master.height))


def main() -> None:
    OUT_BRAND.mkdir(parents=True, exist_ok=True)

    logo_master = load_flat(LOGO_MASTER)
    icon_master = load_flat(ICON_MASTER)
    icon_on_blue_master = load_flat(ICON_ON_BLUE_MASTER)

    icon_from_lockup, wordmark = split_wordmark(logo_master)
    icon_blue = trim(icon_from_lockup)

    # --- wordmark lock-ups (blue + white) --------------------------------
    lock_blue = trim(logo_master)
    lock_white = recolour(trim(logo_master), WHITE, FOLD_ON_WHITE)
    fit_height(lock_blue, LOGO_HEIGHT).save(OUT_BRAND / "fatorati-logo.png", optimize=True)
    fit_height(lock_white, LOGO_HEIGHT).save(OUT_BRAND / "fatorati-logo-white.png", optimize=True)

    # --- icon alone (blue + white) ---------------------------------------
    # Both treatments come from the trimmed icon so the two files are the same
    # drawing at the same scale — a white icon with transparent padding would
    # render smaller than the blue one at the same CSS height.
    icon_white = recolour(trim(icon_master), WHITE, FOLD_ON_WHITE)
    fit_height(icon_blue, ICON_HEIGHT).save(OUT_BRAND / "fatorati-icon.png", optimize=True)
    fit_height(icon_white, ICON_HEIGHT).save(OUT_BRAND / "fatorati-icon-white.png", optimize=True)

    # --- blue square (app icon / maskable / Open Graph) -------------------
    icon_on_blue_master.resize((1024, 1024), Image.LANCZOS).save(OUT_BRAND / "fatorati-icon-on-blue.png", optimize=True)

    # --- browser + OS icons ----------------------------------------------
    # The tab icon keeps the mark's own transparency: it is drawn on whatever
    # the browser's tab bar uses, light or dark.
    tab = square(fit_height(icon_blue, 512), 512, padding_ratio=0.09)
    tab.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    tab.resize((32, 32), Image.LANCZOS).save(PUBLIC / "favicon-32.png", optimize=True)

    # iOS never honours transparency and rounds the corners itself, so this one
    # is the solid blue square, exactly like the platform's own icons.
    apple = square(fit_height(recolour(icon_master, WHITE, FOLD_ON_WHITE), 512), 180, padding_ratio=0.13,
                   background=BRAND_BLUE).convert("RGB")
    apple.save(PUBLIC / "apple-touch-icon.png", optimize=True)

    for size in (192, 512):
        square(fit_height(recolour(icon_master, WHITE, FOLD_ON_WHITE), 512), size, padding_ratio=0.14,
               background=BRAND_BLUE).save(PUBLIC / f"icon-{size}.png", optimize=True)

    manifest = {
        "name": "Fatorati — Gestion pour TPE marocaines",
        "short_name": "Fatorati",
        "description": "Projets, trésorerie, achats, stock et conformité juridique pour les petites entreprises au Maroc.",
        "lang": "fr",
        "dir": "ltr",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "background_color": "#f4f6f9",
        "theme_color": "#3a88ea",
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
            {"src": "/apple-touch-icon.png", "sizes": "180x180", "type": "image/png"},
        ],
    }
    (PUBLIC / "site.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    written = sorted(
        [p for p in OUT_BRAND.iterdir()] + [p for p in PUBLIC.iterdir() if p.is_file() and p.suffix in {".ico", ".webmanifest", ".png"}]
    )
    for path in written:
        print(f"{path.relative_to(ROOT)}  {path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
