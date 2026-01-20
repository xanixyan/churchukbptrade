/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Enable instrumentation hook for running migrations on startup
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
