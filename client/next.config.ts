import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // serve images directly from the CDN (Thumbor/SIH) instead of re-optimizing through Next
    loader: "custom",
    loaderFile: "./src/lib/cdn-image-loader.ts",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "aura-cdn.reactiveshots.com",
      },
    ],
  },
};

export default nextConfig;
