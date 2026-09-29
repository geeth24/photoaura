// Digital Asset Links — lets the Android app open sign-in links on this domain.
// Served at https://aura.reactiveshots.com/.well-known/assetlinks.json

export const dynamic = "force-static"

// Play's app signing key goes first once the app exists in Play Console
const fingerprints = [
  // upload key
  "27:E8:2B:9C:9F:83:8E:4F:01:2F:D6:00:AE:9E:E8:ED:76:12:2A:ED:69:7C:5A:E1:F1:A5:B1:5A:B2:98:93:02",
  // local debug builds
  "9D:C0:65:4F:1F:46:CF:07:62:9A:D6:EB:33:F4:59:4F:ED:91:2A:46:62:14:4D:C2:71:9F:52:7A:6C:5C:DE:16",
]

export function GET() {
  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.radsoftinc.photoaura",
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=300, must-revalidate" },
  })
}
