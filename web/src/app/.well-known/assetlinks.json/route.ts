// Digital Asset Links for the Android app (android/, package
// com.threepanda.transitvault). Chrome checks this file before it opens the
// site as a Trusted Web Activity; without a matching fingerprint the app shows
// a browser URL bar, and Play reviewers reject that as a "webview wrapper".
//
// A route handler rather than a file in public/: dot-directories are handled
// inconsistently by the Workers asset upload, and this guarantees
// `Content-Type: application/json`, which the Digital Asset Links API requires.
//
// TWO fingerprints belong here once the app exists on Play:
//   1. The UPLOAD key (below): signs the AAB we upload and any locally built APK.
//   2. The Play App Signing key: Google re-signs what users install. Copy its
//      SHA-256 from Play Console → Test and release → Setup → App signing, add
//      it below, and redeploy the web app BEFORE promoting a release. Until
//      then, installs from Play show a URL bar.
// See infra/play-store/README.md.
const SHA256_CERT_FINGERPRINTS = [
  // Upload key: C:\Users\Anil\Documents\keys\transitvault-upload.jks, alias "upload".
  "72:FF:0F:07:B7:1C:85:62:0B:50:8E:1B:0D:A5:9A:D3:0D:EE:16:CA:8B:E4:E9:6C:21:09:A4:97:4E:DA:1A:FD",
  // Play App Signing key: ADD HERE after the app is created in Play Console.
];

const statements = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.threepanda.transitvault",
      sha256_cert_fingerprints: SHA256_CERT_FINGERPRINTS,
    },
  },
];

export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(statements, null, 2), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
}
