import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a minimal server.js, so the Docker image does
  // not need node_modules. Vercel ignores this and uses its own builder.
  output: "standalone",
  async redirects() {
    return [
      // The BoneWise landing/chat/results flow now lives at "/" directly
      // (design_handoff_bonewise). Keep old /assistant links working.
      {
        source: "/assistant",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
