const path = require("node:path");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "../..");
const envFiles = [
  `.env.${process.env.NODE_ENV || "development"}.local`,
  process.env.NODE_ENV === "test" ? null : ".env.local",
  `.env.${process.env.NODE_ENV || "development"}`,
  ".env"
].filter(Boolean);

for (const file of envFiles) {
  dotenv.config({ path: path.join(repoRoot, file), override: false, quiet: true });
}

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const {
  publicProductionDirectives,
  secureProductionDirectives,
  developmentDirectives
} = require("./src/config/csp-directives.json");

const isProduction = process.env.NODE_ENV === "production";
const configuredCspMode = (process.env.CSP_MODE || (isProduction ? "enforce" : "off")).trim().toLowerCase();
const cspMode =
  configuredCspMode === "off" || configuredCspMode === "report-only" || configuredCspMode === "enforce"
    ? configuredCspMode
    : isProduction
      ? "enforce"
      : "off";

const publicCsp = (isProduction ? publicProductionDirectives : developmentDirectives).join("; ");
const secureCsp = (isProduction ? secureProductionDirectives : developmentDirectives).join("; ");
if (cspMode !== "off" && (!publicCsp || !secureCsp)) {
  throw new Error("CSP directives must not be empty.");
}

const nextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  staticPageGenerationTimeout: 120,
  images: {
    // Disable the built-in image optimizer so the app stays portable across hosts/CDNs.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**.roblox.com" },
      { protocol: "https", hostname: "**.robloxden.com" },
      { protocol: "https", hostname: "**.ggpht.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "media.bloxodes.com" },
      { protocol: "https", hostname: "rbxcdn.com" },
      { protocol: "https", hostname: "**.rbxcdn.com" },
      { protocol: "https", hostname: "tr.rbxcdn.com" },
      { protocol: "https", hostname: "rbxcdn.net" },
      { protocol: "https", hostname: "**.rbxcdn.net" }
    ],
    formats: ["image/avif", "image/webp"],
  },
  serverExternalPackages: ["@supabase/supabase-js"],
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
  },
};

module.exports = withBundleAnalyzer(nextConfig);
