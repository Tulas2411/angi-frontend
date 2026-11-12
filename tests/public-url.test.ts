import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/server", () => ({ destroySession: vi.fn() }));

const { publicUrl } = await import("@/shared/api/http");

// What a Route Handler sees behind Caddy + Cloudflare Tunnel: the address Next.js listens on.
const proxied = new Request("http://0.0.0.0:3000/roadmaps/start");

describe("publicUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("builds production redirects on APP_URL, not on the listening address", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://angi.tulas.click");
    expect(publicUrl("/roadmaps?new=1", proxied).href).toBe(
      "https://angi.tulas.click/roadmaps?new=1",
    );
    expect(publicUrl("/login", proxied).href).toBe(
      "https://angi.tulas.click/login",
    );
  });

  it("keeps the request address in development, so a LAN device stays on its own host", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const lan = new Request("http://192.168.1.20:3000/roadmaps/start");
    expect(publicUrl("/roadmaps", lan).href).toBe(
      "http://192.168.1.20:3000/roadmaps",
    );
  });

  it("falls back to the request address when APP_URL is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "");
    expect(publicUrl("/login", proxied).href).toBe("http://0.0.0.0:3000/login");
  });
});
