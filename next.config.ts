import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a minimal server.js, so the Docker image does
  // not need node_modules. Vercel ignores this and uses its own builder.
  output: "standalone",
  // Keep Turbopack inside this repository when another package-lock exists in
  // a parent folder (as it does on the team machines).
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      // The BoneBot landing/chat/results flow now lives at "/" directly.
      // Keep old /assistant links working.
      {
        source: "/assistant",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
