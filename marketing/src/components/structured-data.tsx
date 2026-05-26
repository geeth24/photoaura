// JSON-LD structured data for search-engine understanding
// Renders in <body> via server component; harmless if duplicated across pages.

const SITE_URL = "https://photoaura.app"

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Rad Soft",
  url: "https://radsoftinc.com",
  logo: `${SITE_URL}/logo-color.png`,
  sameAs: ["https://github.com/geeth24/photoaura"],
}

const software = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "PhotoAura",
  applicationCategory: "PhotographyApplication",
  operatingSystem: "Web, Linux, macOS, Windows (Docker)",
  description:
    "Self-hosted or managed photo gallery for photography studios. Client galleries, face recognition, branded shared albums.",
  url: SITE_URL,
  image: `${SITE_URL}/logo-color.png`,
  publisher: {
    "@type": "Organization",
    name: "Rad Soft",
    url: "https://radsoftinc.com",
  },
  license: "https://opensource.org/licenses/MIT",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free and open-source for self-host. Managed deployments available.",
  },
}

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PhotoAura",
  url: SITE_URL,
}

export function StructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(software) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  )
}
