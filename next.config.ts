import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2"],
  distDir: process.env.BUILD_OUTPUT_DIR || ".next",
  images: { qualities: [75, 90] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
