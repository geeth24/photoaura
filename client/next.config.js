/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.reactiveshots.com',
        port: '',
      },
    ],
  },
};

module.exports = nextConfig
