# clim — App Store submission

Everything App Store Connect asks for, what was already fixed in the project,
and the three decisions only you can make. Work top to bottom.

---

## 1. Fixed in the project already

| Item | Was | Now |
|---|---|---|
| `NSLocationWhenInUseUsageDescription` | present with an **empty string** | removed — the app never asks for location, and an empty purpose string is an automatic 5.1.1 rejection |
| `TARGETED_DEVICE_FAMILY` | absent → Xcode assumed iPhone **+ iPad** | `1` (iPhone only) — otherwise App Store Connect blocks the build until you upload iPad screenshots, which do not exist |
| Camera purpose string | "Clim uses camera to scan the cloud pairing QR" — wrong (it is used for LAN too) and wrong capitalisation | "clim scans the pairing QR code your Mac prints, so the phone can connect to that session." |
| Local network purpose string | mentioned only Claude Code | rewritten to say what actually happens, in plain words |
| Version | Android 1.0, iOS 1.0, app package 0.1.0 | all `1.1.0`, matching npm |

Already correct, verified not assumed:

- **App icon** 1024×1024, mode RGB, **no alpha channel** (alpha is a hard reject).
- **`PrivacyInfo.xcprivacy`** present: `NSPrivacyTracking = false`, no collected
  data types, and three API-reason declarations (file timestamp, user defaults,
  system boot time) that RN needs.
- **`NSAllowsArbitraryLoads = false`** with `NSAllowsLocalNetworking = true` —
  the correct pair for a LAN app. Do not widen this.
- **Bonjour** matches end to end: the Mac publishes `_clim._tcp`, the app scans
  `clim`/`tcp`, and `NSBonjourServices` declares `_clim._tcp`. A mismatch here
  makes discovery silently find nothing on iOS 14+.
- **Launch screen** present (`LaunchScreen.storyboard`).

---

## 2. Three decisions you have to make

### 2a. Export compliance — the one that will stop the upload

clim implements its own end-to-end encryption (NaCl/`tweetnacl`), so it is not
covered by the "only HTTPS" exemption. `ITSAppUsesNonExemptEncryption` is
deliberately **not set** in `Info.plist`, because setting it is a legal
self-classification and it is not mine to make. Your two options:

1. **Claim the open-source exemption** (§740.13(e)). clim's source is public
   and unmodified crypto, which is the normal basis for this. It requires a
   one-time notification email to BIS (`crypt@bis.doc.gov`) and the NSA
   (`enc@nsa.gov`) with the repo URL, *before* you rely on it. After that, set
   `ITSAppUsesNonExemptEncryption` to `false` in `Info.plist`.
2. **Declare non-exempt** — set it to `true` and answer App Store Connect's
   export questions each release, providing your CCATS/self-classification.

Until you pick one, every upload will re-ask the export questions. Not a
rejection, but it blocks automated submission.

### 2b. How the reviewer tests it — the most likely rejection

This is Guideline 2.1 (App Completeness) and it is the real risk. clim is a
remote control for a session on **your** Mac. A reviewer opening the app sees a
pairing screen and has nothing to pair with. Apple rejects apps that cannot be
exercised, and "install our npm package on your own Mac first" is not something
reviewers reliably do.

Pick one before submitting:

1. **Run a demo relay for review** (best odds). Keep a cloud session alive,
   put the invite line in the review notes, and tell the reviewer to choose
   Cloud and paste it. They then see real sessions with no setup.
2. **Ship a demo mode in the app** — a button on the pairing screen that loads
   a canned session so the UI is explorable offline. More work, but it survives
   review forever and helps real users evaluate the app too.
3. **Submit with instructions only** and accept the risk of a rejection round.

The review notes in `LISTING.md` currently describe option 3. If you choose 1
or 2, that text has to change with it.

### 2c. Orientation

`UISupportedInterfaceOrientations` allows portrait **and both landscapes**, but
every screen was designed and tested in portrait, and all screenshots are
portrait. If a reviewer rotates the device and a screen breaks, that is a 2.1
rejection. Either test landscape properly, or drop to portrait-only:

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>
```

I have not changed this — it is a product decision, not a defect.

---

## 3. App Store Connect — field by field

Copy from `LISTING.md`. Counts there are measured, not estimated.

| Field | Value |
|---|---|
| Name | `clim: terminal remote` (21/30) |
| Subtitle | `Drive Claude Code by phone` (26/30) |
| Category | Developer Tools / Productivity |
| Age rating | 4+ |
| Privacy Policy URL | https://getclim.netlify.app/privacy.html |
| Support URL | https://github.com/subrahmanyabhat/clim/issues |
| Marketing URL | https://getclim.netlify.app |
| Copyright | 2026 Dinga Labs |
| App Privacy | **Data Not Collected** — no analytics, no crash reporter, no account |
| Sign-in required | No |
| Content rights | Contains no third-party content |

**Trademark caution.** The keyword list contains `claude`, `codex` and
`hermes`. Apple rejects metadata that uses another company's trademarks to
gain search placement (4.1 / metadata rejections are common here). The
description already carries a "clim does not provide the AI … not affiliated
with Anthropic, OpenAI or Nous Research" paragraph, which is the mitigation.
If the first submission is rejected on this, drop the three brand keywords —
the description text is what actually matters for discovery.

---

## 4. Screenshots

Uploaded from `~/Desktop/clim-store-screenshots/app-store/` — six at
1320×2868 (6.9"). That single size satisfies every current iPhone requirement;
Apple scales the rest. `other-sizes/` holds 6.5", 6.3" and 6.1" if you want
device-specific art.

Note: the sessions shown are **seeded**, not a recording of a live Claude
session. The UI is real and the screenshots come from the release build, but
if you want to state "actual screenshots" anywhere, re-capture against a real
paired Mac first.

---

## 5. Upload — done, from CI

The build is uploaded. Delivery UUID `f89a9ff0-1a1b-43f3-93d3-e083c4e6d492`.

It could not be uploaded from this Mac. App Store Connect rejects anything
built with an SDK older than iOS 26, and the local Xcode is 16.4 (iOS 18.5):

```
Validation failed (409) SDK version issue. This app was built with the iOS 18.5
SDK. All iOS and iPadOS apps must be built with the iOS 26 SDK or later.
```

So `.github/workflows/upload.yml` builds it on a `macos-15` runner that has
Xcode 26, using `upload-build.sh`. Re-run it with:

```bash
gh workflow run upload.yml
gh run watch
```

Secrets it needs, already set: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`
(the .p8 base64-encoded). The key must be **Admin**, not App Manager — cloud
signing creates a distribution certificate on the runner and App Manager is
refused with "Cloud signing permission error".

Two project changes were needed to build against the iOS 26 SDK at all:

- **Deployment target raised 15.1 → 16.0.** Xcode 26 dropped the Swift 5.6
  back-compatibility libraries, and any target below iOS 15.4 still auto-links
  them, so the archive failed on
  `__swift_FORCE_LOAD_$_swiftCompatibility56` referenced from
  `libReactNativeCameraKit.a`. Raising the target removes the auto-link at its
  source; the alternative was jumping react-native-camera-kit across four major
  versions. `post_install` raises the pods' targets too, since they carry their
  own from their podspecs.
- **Build logs are no longer filtered through grep.** The first failure showed
  only "clang++: error: linker command failed" because undefined-symbol lines
  print as `ld: ...` and matched neither pattern being grepped for.

Build number is `1`. Bump `CURRENT_PROJECT_VERSION` before the next upload —
App Store Connect rejects a duplicate.

## 6. Pre-flight checklist

- [ ] Export compliance decision made (2a) and `ITSAppUsesNonExemptEncryption` set
- [ ] Reviewer access decision made (2b) and review notes updated to match
- [ ] Orientation decision made (2c)
- [ ] `CURRENT_PROJECT_VERSION` bumped
- [ ] Archive exported with the **app-store** options plist, not development
- [ ] Six screenshots uploaded at 1320×2868
- [ ] App Privacy questionnaire answered "Data Not Collected"
- [ ] Both legal URLs load (they do — verified live)
