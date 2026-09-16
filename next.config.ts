import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The generated Prisma client and its pg driver are server-only; keep the
  // bundler from tracing them into the client bundle.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],
};

export default nextConfig;
