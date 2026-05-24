import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "aura-cdn.reactiveshots.com",
      },
    ],
  },
};

export default nextConfig;
