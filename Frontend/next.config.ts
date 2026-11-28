import type { NextConfig } from "next";
import path from "path";

/** Baseline security headers. The Content-Security-Policy is per request (nonce) in src/proxy.ts. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    // Microphone stays allowed for this origin: meeting recording uses getUserMedia.
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(process.cwd()),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
