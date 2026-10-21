/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Deploys build into a side directory (NEXT_DIST_DIR=.next-build) and swap it in atomically,
  // so the running server never serves a half-written build. Runtime always uses .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
