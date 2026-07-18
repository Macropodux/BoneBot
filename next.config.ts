import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a minimal server.js, so the Docker image does
  // not need node_modules. Vercel ignores this and uses its own builder.
  output: "standalone",
  async redirects() {
    return [
      // BoneBot (/assistant) is the product now — send visitors straight
      // there instead of the old scaffold status board. Temporary (307) so
      // this is easy to change once a real landing page exists.
      {
        source: "/",
        destination: "/assistant",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
