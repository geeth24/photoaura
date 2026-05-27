// Apple App Site Association — declares which iOS app handles links on this domain.
// Served at https://aura.reactiveshots.com/.well-known/apple-app-site-association
// (no extension, application/json content-type).

export const dynamic = "force-static"

export function GET() {
  const teamId = "9PX6B5P246"
  const bundleId = "com.radsoftinc.PhotoAura"

  const body = {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${bundleId}`],
          components: [
            // any path under /auth/verify opens the iOS app
            { "/": "/auth/verify", comment: "magic-link sign-in" },
            { "/": "/auth/verify*", comment: "magic-link sign-in with query" },
          ],
        },
      ],
    },
  }

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      // Apple caches AASA — short cache lets us iterate
      "cache-control": "public, max-age=300, must-revalidate",
    },
  })
}
