import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PhotoAura",
    short_name: "PhotoAura",
    description:
      "Self-hosted or managed photo gallery for photography studios.",
    start_url: "/",
    display: "standalone",
    background_color: "#030d14",
    theme_color: "#030d14",
    icons: [
      {
        src: "/logo-color.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  }
}
