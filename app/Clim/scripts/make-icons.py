#!/usr/bin/env python3
"""Render logo.svg into every icon the app and the website need.

The SVG is the source of truth; these PNGs are build output. iOS icons must be
opaque with no alpha, so the mark is composited onto the page background rather
than left transparent — and iOS applies its own squircle mask, so the artwork
runs to the edges with no padding of our own.

    python3 scripts/make-icons.py
"""
import io, os, subprocess, sys
from PIL import Image, ImageDraw

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

ANDROID_RES = os.path.join(HERE, "android/app/src/main/res")
# Launcher icon, per density. The legacy PNGs are what pre-Oreo launchers and a
# few OEM skins still read; the adaptive icon below is what everything current
# uses.
ANDROID_DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
# An adaptive icon is a 108dp canvas of which only the middle 72dp is guaranteed
# visible — the launcher masks the rest and parallaxes what is left. So the mark
# is drawn at 60% and centred, rather than run to the edges the way iOS wants.
ADAPTIVE_FOREGROUND_SCALE = 0.60


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

    # Android: legacy per-density PNGs, round variants, and one adaptive icon.
    if os.path.isdir(ANDROID_RES):
        round_mask = None
        for name, px in ANDROID_DENSITIES.items():
            d = os.path.join(ANDROID_RES, f"mipmap-{name}")
            os.makedirs(d, exist_ok=True)
            square = master.resize((px, px), Image.LANCZOS)
            square.save(os.path.join(d, "ic_launcher.png"), "PNG")

            # The round variant has to be genuinely round: shipping the square
            # under a round name is what leaves a boxed icon on the launchers
            # that ask for it.
            rnd = Image.new("RGBA", (px, px), (0, 0, 0, 0))
            mask = Image.new("L", (px * 4, px * 4), 0)
            ImageDraw.Draw(mask).ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
            round_mask = mask.resize((px, px), Image.LANCZOS)
            rnd.paste(square, (0, 0), round_mask)
            rnd.save(os.path.join(d, "ic_launcher_round.png"), "PNG")

            # Adaptive foreground: transparent, mark inset into the safe zone.
            fg = Image.new("RGBA", (px, px), (0, 0, 0, 0))
            m = render(int(px * ADAPTIVE_FOREGROUND_SCALE))
            off = (px - m.size[0]) // 2
            fg.paste(m, (off, off), m)
            fg.save(os.path.join(d, "ic_launcher_foreground.png"), "PNG")

        anydpi = os.path.join(ANDROID_RES, "mipmap-anydpi-v26")
        os.makedirs(anydpi, exist_ok=True)
        adaptive = (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@color/ic_launcher_background" />\n'
            '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
            '    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />\n'
            '</adaptive-icon>\n')
        for n in ("ic_launcher.xml", "ic_launcher_round.xml"):
            with open(os.path.join(anydpi, n), "w") as fh:
                fh.write(adaptive)

        values = os.path.join(ANDROID_RES, "values")
        os.makedirs(values, exist_ok=True)
        with open(os.path.join(values, "ic_launcher_background.xml"), "w") as fh:
            fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                     '    <color name="ic_launcher_background">#111111</color>\n</resources>\n')
        print(f"and:  {len(ANDROID_DENSITIES)} densities + adaptive -> android/app/src/main/res")

    # In-app mark. Transparent here — it sits on the app's dark background.
    for scale, name in ((1, "glyph.png"), (2, "glyph@2x.png"), (3, "glyph@3x.png")):
        render(96 * scale).save(os.path.join(HERE, name), "PNG")
    print("app:  glyph.png, glyph@2x.png, glyph@3x.png")


if __name__ == "__main__":
    sys.exit(main())
