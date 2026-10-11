import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second dev server (e.g. for e2e runs) work beside `npm run dev`, which locks its build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Off for e2e runs on a dev server: the badge sits over the phone tab bar and takes its clicks.
  devIndicators: process.env.NEXT_DEV_INDICATORS === "off" ? false : undefined,
};

export default nextConfig;
