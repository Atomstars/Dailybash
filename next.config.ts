import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Type checking is run independently; skipping it here keeps Windows/OneDrive
  // production builds from stalling on filesystem scans.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
