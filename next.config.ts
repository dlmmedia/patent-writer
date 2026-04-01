import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@sparticuz/chromium-min",
    "puppeteer-core",
    "pdf-parse",
  ],
};

export default nextConfig;
