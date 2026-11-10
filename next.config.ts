import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * Security headers on every page and API route (docs/deploy.vi.md).
 * The CSP only sets the directives that cannot break a script, style, image or map tile: no other site may frame ANGI
 * (clickjacking), no <base> or plugin injection, forms post only to ANGI. Google sign-in (popup + iframe button) and
 * Mapbox keep working because script-src / frame-src / connect-src are left open.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // GPS is used by the roadmap planner and the map dialogs; nothing uses camera, microphone or payments.
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=()",
  },
  // Browsers ignore it over plain http (local), so it is safe to send everywhere.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

/**
 * Hosts that may open the dev server from another device (`next dev` only; ignored by builds).
 * Next.js blocks cross-origin dev requests, the HMR WebSocket included, so a phone or a second PC
 * on the LAN gets "WebSocket connection to ws://<ip>:3000/_next/hmr failed". This machine's own LAN
 * IPv4 addresses are allowed automatically; add others (a hostname, a tunnel) with
 * DEV_ALLOWED_ORIGINS="host-a,host-b".
 */
const allowedDevOrigins = [
  ...Object.values(networkInterfaces())
    .flat()
    .filter((address) => address?.family === "IPv4" && !address.internal)
    .map((address) => address!.address),
  ...(process.env.DEV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  cacheComponents: false,
  poweredByHeader: false,
  experimental: {
    agentUpgrade: "security",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
