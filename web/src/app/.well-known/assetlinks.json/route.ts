// Digital Asset Links for the Android app (android/, package
// com.threepandalabs.transitvault). Chrome checks this file before it opens the
// site as a Trusted Web Activity; without a matching fingerprint the app shows
// a browser URL bar, and Play reviewers reject that as a "webview wrapper".
//
// A route handler rather than a file in public/: dot-directories are handled
// inconsistently by the Workers asset upload, and this guarantees
// `Content-Type: application/json`, which the Digital Asset Links API requires.
//
// Fingerprints that belong here once the app exists on Play:
//   1. The UPLOAD key (below): signs the AAB we upload and any locally built APK.
//   2. EVERY Play App Signing fingerprint: Google re-signs what users install.
//      Play Console → Test and release → Setup → App signing → "Copy all
//      certificate fingerprints" lists the classical key, the "Quantum-ready
//      (beta)" post-quantum key and possibly a further signing certificate.
//      Add ALL of them and redeploy the web app BEFORE promoting a release.
//      AdVault listed only the classical key and newer phones (Galaxy Fold,
//      2026-11-22) still showed an address bar until every one was listed.
// See infra/play-store/README.md.
const SHA256_CERT_FINGERPRINTS = [
  // Upload key: C:\Users\Anil\Documents\keys\transitvault-upload.jks, alias "upload".
  "72:FF:0F:07:B7:1C:85:62:0B:50:8E:1B:0D:A5:9A:D3:0D:EE:16:CA:8B:E4:E9:6C:21:09:A4:97:4E:DA:1A:FD",
  // Play App Signing (app 4974941412391168060), every SHA-256 Play lists: classical, quantum-ready, extra cert.
  "6E:1D:9E:6C:4C:6F:93:2D:3D:06:8E:88:3F:0A:CA:E7:74:08:56:41:DD:35:BF:DA:A4:9B:5D:4B:1B:79:35:7B",
  "A6:C2:CA:26:90:8C:7A:52:E4:25:9D:00:11:E3:51:7B:A6:D6:87:59:23:F0:CE:82:60:B9:61:7D:C6:D3:13:12",
  "8F:A3:0B:AE:6B:E7:3D:F4:23:71:74:67:6A:1B:56:4B:42:FA:27:BE:18:AA:73:C0:74:D9:71:62:0D:F5:22:82",
  // Play App Signing fingerprints (classical + quantum-ready + any extra
  // certificate): ADD ALL HERE after the app is created in Play Console.
];

const statements = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.threepandalabs.transitvault",
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
