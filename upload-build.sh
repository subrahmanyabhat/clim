#!/bin/bash
# Archives, exports and uploads a clim build to App Store Connect.
#
#   ASC_ISSUER_ID=<issuer> ./upload-build.sh
#
# The app record must already exist in App Store Connect — the API cannot create
# apps. clim's is 6799607439.
#
# App Store uploads require the iOS 26 SDK or later. Xcode 16.4 ships iOS 18.5
# and its uploads are rejected with a 409, which is why this exists: run it on a
# runner that has Xcode 26, or point XCODE26 at a side-by-side install.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

XCODE26="${XCODE26:-/Applications/Xcode-26.3.app}"
if [ -d "$XCODE26" ]; then
  export DEVELOPER_DIR="$XCODE26/Contents/Developer"
fi
SDK_VER="$(xcrun --sdk iphoneos --show-sdk-version 2>/dev/null || echo 0)"
case "$SDK_VER" in
  2[6-9].*|[3-9][0-9].*) : ;;
  *)
    echo "iOS SDK $SDK_VER is too old — App Store Connect requires iOS 26 or later." >&2
    echo "Set XCODE26 to an Xcode 26 install, or run this on a macos-15 runner." >&2
    exit 1 ;;
esac
echo "Using SDK iOS $SDK_VER from ${DEVELOPER_DIR:-$(xcode-select -p)}"

IOS="$REPO/app/Clim/ios"
KEY_ID="${ASC_KEY_ID:-D3C49G4LAY}"
ISSUER="${ASC_ISSUER_ID:?set ASC_ISSUER_ID}"
KEY="$HOME/.appstoreconnect/private_keys/AuthKey_$KEY_ID.p8"
[ -f "$KEY" ] || { echo "missing $KEY" >&2; exit 1; }
OUT="$(mktemp -d)"
AUTH=(-allowProvisioningUpdates
      -authenticationKeyPath "$KEY"
      -authenticationKeyID "$KEY_ID"
      -authenticationKeyIssuerID "$ISSUER")

echo "==> Archiving"
xcodebuild archive -workspace "$IOS/Clim.xcworkspace" -scheme Clim \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$OUT/Clim.xcarchive" "${AUTH[@]}" \
  | grep -E "error:|ARCHIVE (SUCCEEDED|FAILED)"

echo "==> Exporting"
xcodebuild -exportArchive -archivePath "$OUT/Clim.xcarchive" \
  -exportOptionsPlist "$IOS/ExportOptions-ci.plist" -exportPath "$OUT/ipa" \
  "${AUTH[@]}" \
  | grep -E "error:|EXPORT (SUCCEEDED|FAILED)"

# altool exits 0 even when it prints "VERIFY FAILED" or "UPLOAD FAILED", so its
# output has to be inspected rather than its status.
run_altool() {
  local action="$1" log
  log="$OUT/altool-$action.log"
  echo "==> ${action}"
  xcrun altool "--${action}-app" -f "$OUT/ipa/Clim.ipa" -t ios \
    --apiKey "$KEY_ID" --apiIssuer "$ISSUER" 2>&1 | tee "$log"
  if grep -qE "VERIFY FAILED|UPLOAD FAILED|ERROR: \[altool" "$log"; then
    echo "altool reported failure during ${action} (it still exits 0)." >&2
    exit 1
  fi
}

run_altool validate
run_altool upload

echo
echo "Uploaded. The build appears in App Store Connect after processing"
echo "(usually 5-15 minutes), then attach it to version 1.1.0."
