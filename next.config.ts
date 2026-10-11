import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second dev server (e.g. for e2e runs) work beside `npm run dev`, which locks its build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
