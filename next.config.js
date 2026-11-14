/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Deploys build into a side directory (NEXT_DIST_DIR=.next-build) and swap it in atomically,
  // so the running server never serves a half-written build. Runtime always uses .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/api/workshops/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, x-actor-role, x-actor-name, x-actor-id, *" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
