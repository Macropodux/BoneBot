import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a minimal server.js, so the Docker image does
  // not need node_modules. Vercel ignores this and uses its own builder.
  output: "standalone",
};

export default nextConfig;
