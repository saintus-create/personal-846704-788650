import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/chat": ["./public/corpus/**/*"],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
