import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(process.cwd()),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
