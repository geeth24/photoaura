/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // {
      //   protocol: 'http',
      //   hostname: 'localhost',
      //   port: '8000',
      // },
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_API_URL.split('/')[1] || 'aura.reactiveshots.com',
        port: '',
      },
    ],
  },
};

module.exports = nextConfig
