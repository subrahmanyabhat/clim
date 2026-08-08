#!/usr/bin/env python3
"""Render logo.svg into every icon the app and the website need.

The SVG is the source of truth; these PNGs are build output. iOS icons must be
opaque with no alpha, so the mark is composited onto the page background rather
than left transparent — and iOS applies its own squircle mask, so the artwork
runs to the edges with no padding of our own.

    python3 scripts/make-icons.py
"""
import io, os, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(os.path.dirname(HERE))
SVG = os.path.join(HERE, "logo.svg")
# Background behind the mark. iOS icons cannot be transparent, so this is a real
# choice: pass ICON_BG=white|black (default black — it matches the app UI).
_BGS = {'white': (255, 255, 255), 'black': (10, 10, 10)}
BG = _BGS.get(os.environ.get('ICON_BG', 'black'), _BGS['black'])
MASTER = 2048

APPICON = os.path.join(HERE, "ios/Clim/Images.xcassets/AppIcon.appiconset")
IOS_SIZES = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024]


def render(px):
    """SVG → PIL image at px, via rsvg-convert (vector, so no upscaling blur)."""
    out = subprocess.run(
        ["rsvg-convert", "-w", str(px), "-h", str(px), SVG],
        check=True, capture_output=True).stdout
    return Image.open(io.BytesIO(out)).convert("RGBA")


def flatten(rgba, bg=BG):
    flat = Image.new("RGB", rgba.size, bg)
    flat.paste(rgba, mask=rgba.split()[3])
    return flat


def main():
    master = flatten(render(MASTER))

    os.makedirs(APPICON, exist_ok=True)
    for s in IOS_SIZES:
        master.resize((s, s), Image.LANCZOS).save(os.path.join(APPICON, f"icon-{s}.png"), "PNG")
    print(f"ios: {len(IOS_SIZES)} icons -> {os.path.relpath(APPICON, HERE)}")

    # Website favicon / PWA icon, same artwork.
    site = os.path.join(REPO, "site")
    if os.path.isdir(site):
        master.resize((512, 512), Image.LANCZOS).save(os.path.join(site, "icon.png"), "PNG")
        master.resize((192, 192), Image.LANCZOS).save(os.path.join(site, "icon-192.png"), "PNG")
        print("site: icon.png, icon-192.png")

    # In-app mark. Transparent here — it sits on the app's dark background.
    for scale, name in ((1, "glyph.png"), (2, "glyph@2x.png"), (3, "glyph@3x.png")):
        render(96 * scale).save(os.path.join(HERE, name), "PNG")
    print("app:  glyph.png, glyph@2x.png, glyph@3x.png")


if __name__ == "__main__":
    sys.exit(main())
