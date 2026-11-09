import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle, only for the Docker image (the Dockerfile sets NEXT_OUTPUT).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // PGlite (the zero-setup local database) ships WASM files and must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
