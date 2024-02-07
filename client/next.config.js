/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'aura.reactiveshots.com',
        port: '',
      },
    ],
  },
};

module.exports = nextConfig
