import type { NextConfig } from "next";

// Backend origin that the frontend proxies API/auth traffic to. Same-origin
// proxying keeps the session cookie first-party on this app, so auth works in
// all browsers (including incognito / with third-party cookies blocked).
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ??
  process.env.BACKEND_URL ??
  "http://localhost:8080";

const backendBase = API_PROXY_TARGET.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
