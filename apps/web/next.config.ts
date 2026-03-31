import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@cloud-manager/shared",
    "@cloud-manager/api-client",
  ],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
