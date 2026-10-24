import { createServer, type Server } from "node:http";
import { expect, type Page } from "@playwright/test";

/**
 * Minimal local backend for specs that only need an owner session and no restaurant yet
 * (login + OWN-02 404). Binds the same port as the isolated owner test configs.
 */
export async function startOwnerApiStub(port = 5164): Promise<Server> {
  const server = createServer((request, result) => {
    const send = (
      status: number,
      data: unknown,
      errorCode: string | null = null,
    ) => {
      result.writeHead(status, { "Content-Type": "application/json" });
      result.end(
        JSON.stringify({
          success: status < 400,
          message: errorCode ? "Test error" : null,
          errorCode,
          data,
        }),
      );
    };
    request.resume();
    request.on("end", () => {
      if (request.url === "/api/v1/auth/login")
        send(200, {
          accessToken: "test-access",
          refreshToken: "test-refresh",
          accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
          refreshTokenExpiresAt: new Date(
            Date.now() + 2592000000,
          ).toISOString(),
          user: {
            id: 12,
            email: "owner@test.local",
            displayName: "Chủ nhà hàng",
            avatarUrl: null,
            role: "RESTAURANT_OWNER",
            status: "active",
            needsPreferenceSurvey: null,
          },
        });
      else if (request.url === "/api/v1/owner/restaurant")
        send(404, null, "RESTAURANT_NOT_FOUND");
      else send(404, null, "ROUTE_NOT_FOUND");
    });
  });
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  return server;
}

export async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

/** Signs in as the stub owner and opens the restaurant registration form. */
export async function openRegistration(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/^Email/).fill("owner@test.local");
  await page.getByLabel(/^Mật khẩu/).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/restaurant$/);
  await page.goto("/restaurant/register");
  await expect(page.getByLabel("Tỉnh / thành phố")).toBeVisible();
}
