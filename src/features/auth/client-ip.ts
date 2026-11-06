/**
 * The browser's IP for the backend's per-IP limits (anonymous rate limit, login failures). The frontend calls the API
 * from its own server, so without this every guest would arrive with the server's IP. Read from the request headers
 * the host sets: on Vercel `x-forwarded-for` starts with the client and is rewritten by the platform, so a browser
 * cannot choose it. Only trust this behind such a proxy (docs/deploy.vi.md).
 */
export function clientIpFrom(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim();
  // Only plain IPv4 / IPv6 text goes on; anything else is dropped rather than forwarded.
  return ip && /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : null;
}
