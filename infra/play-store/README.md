# TransitVault on Google Play

The Android app is a **Trusted Web Activity** (`android/`, generated with Bubblewrap): Chrome shows `https://transitvault.3pandalabs.com` full screen, without a URL bar, starting at `/needs`. There's no app code to keep in step. Every web deploy updates the app immediately. Rebuild the AAB only when the name, icon, colours, start URL, shortcuts or version change.

Package `com.threepanda.transitvault` · listing copy and policy answers: `listing.md`.

## Signing

- Upload key: `C:\Users\Anil\Documents\keys\transitvault-upload.jks`, alias `upload` (password in Claude memory `transitvault-upload-key`). **Back it up off this PC.** If it's lost, request an upload-key reset in Play Console.
- Google re-signs installs with the Play App Signing key. After creating the app, copy that key's SHA-256 (Play Console → Test and release → Setup → App signing) into `web/src/app/.well-known/assetlinks.json/route.ts` and redeploy the web app **before** promoting a release, or Play installs show a URL bar.
- Check: https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://transitvault.3pandalabs.com&relation=delegate_permission/common.handle_all_urls

## Build

```bash
cd android
export JAVA_HOME=~/.bubblewrap/jdk/jdk-17.0.21+9 ANDROID_HOME=~/.bubblewrap/android_sdk
# bump appVersionCode (+1 every upload) and appVersionName in twa-manifest.json AND app/build.gradle
./gradlew bundleRelease assembleRelease
# sign (gradle output is unsigned):
#   AAB: jarsigner -keystore ../../keys/transitvault-upload.jks app/build/outputs/bundle/release/app-release.aab upload
#   APK: apksigner sign --ks ../../keys/transitvault-upload.jks --ks-key-alias upload --out app-release-signed.apk app/build/outputs/apk/release/app-release-unsigned.apk
```

Or `npx @bubblewrap/cli build` (prompts for the keystore password and signs both).

## Graphics and screenshots

```bash
cd infra/play-store/tools && npm install
npm run graphics      # icons (web/public/icons + graphics/icon-512.png) and the feature graphic, from web/src/app/icon.svg
```

Screenshots: `screenshots/raw/` (1080×1920 captures of the local app with demo data) and `screenshots/framed/` (captioned; upload these).

## First release (manual)

1. Play Console → Create app "TransitVault", app, free; accept declarations.
2. Fill **App content** and **Store listing** from `listing.md`; upload the icon, feature graphic and framed screenshots.
3. Test and release → **Internal testing** → create release → upload the signed `app-release.aab`.
4. Copy the App Signing SHA-256 into `assetlinks.json/route.ts`, redeploy web, verify with the link above, and install from the internal track: no URL bar = verified.
5. Promote to Production and submit for review. (Organization account: no 12-tester/14-day closed test rule.)
