import type { NextConfig } from "next";
import { CLIENT_CACHE_SECONDS } from "./src/lib/client-cache";

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image (see Dockerfile), with only the files it needs.
  output: "standalone",
  // Lets a second dev server (e.g. for e2e runs) work beside `npm run dev`, which locks its build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Off for e2e runs on a dev server: the badge sits over the phone tab bar and takes its clicks.
  devIndicators: process.env.NEXT_DEV_INDICATORS === "off" ? false : undefined,
  // Pages are dynamic; keep them in the browser so moving between them doesn't fetch each time.
  experimental: { staleTimes: { dynamic: CLIENT_CACHE_SECONDS } },
};

export default nextConfig;
