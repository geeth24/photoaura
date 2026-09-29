import type { MetadataRoute } from "next"
import { APP_STORE, PLAY_STORE } from "@/lib/stores"

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
    related_applications: [
      { platform: "play", url: PLAY_STORE, id: "com.radsoftinc.photoaura" },
      { platform: "itunes", url: APP_STORE },
    ],
    icons: [
      {
        src: "/logo-color.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  }
}
