# clim — store assets

App Store and Play Store screenshots for clim, plus the listing copy. Built on
the `app-store-screenshots` skill template (Next.js editor) with a headless
export driver bolted on so the deck can be rebuilt without clicking.

## Rebuild the screenshots

```bash
npm install --legacy-peer-deps   # first time only
npm run dev                      # editor at http://localhost:3000
node export.mjs                  # every device → ./export
node export.mjs iphone android   # or just these
```

`--legacy-peer-deps` is needed because the template pins a React 19 release
candidate and npm will not match an `rc` string against `@dnd-kit`'s
`>=16.8.0` peer range. Under bun the lockfile resolves without it.

`export.mjs` drives the editor's own "Export bundle" button with Playwright and
unpacks the zip, so exports come out of the same code path as the UI — no
second renderer to drift.

## Editing

Open the dev server and edit in the browser. Everything autosaves to
`app-store-screenshots.json`, which is committed, so the deck survives a clone.

Two deviations from the stock template, both deliberate:

- **`clim` theme** in `src/lib/constants.ts` — the product's real palette
  (`#0A0A0A` surface, `#F0EEE6` text, `#D97757` accent) rather than a preset.
- **Feature graphic uses the primary surface.** `FeatureGraphicCanvas` was
  pinned to `theme.bgAlt`/`fgAlt`, which on a dark-first theme rendered a pale
  banner with pale text. It now uses `theme.bg`/`fg`.

## Source screenshots

`public/screenshots/{apple/iphone,android/phone}/en/01..05.png` are real device
captures — iPhone 16 Pro simulator and a Pixel 7 emulator running the release
build. Their status bars are cropped off (165px iOS, 100px Android) because the
device frames draw their own; leaving them produced two clocks overlapping.

The session content in them is seeded, not a recording of a live session. If
that matters for the listing, re-capture against a real paired Mac.

## Listing copy

`LISTING.md` — every field App Store Connect and Play Console ask for, with
character counts measured against each store's limit.

## Not done yet

- **iPad screenshots.** Apple requires them if the app ships for iPad. Nothing
  has been captured on an iPad, so the `ipad` deck is empty.
- **Localisation.** English only. Add locales to `locales` in
  `app-store-screenshots.json` and the export loops them automatically.
