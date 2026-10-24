import { createServer, type Server } from "node:http";
import { expect, type Page } from "@playwright/test";
import type { RoleCode } from "../../src/features/auth/types";
import type {
  ChangePasswordRequestDto,
  UpdateProfileRequestDto,
  UserProfileDto,
} from "../../src/features/account/account-types";

const roleByPrefix: Record<string, RoleCode> = {
  traveler: "TRAVELER",
  owner: "RESTAURANT_OWNER",
  mod: "MOD",
  admin: "ADMIN",
};

/** Mutable state of the local account backend used by routes.spec.ts and account.spec.ts. */
export interface AccountStub {
  server: Server;
  profile: UserProfileDto;
  calls: string[];
  patches: UpdateProfileRequestDto[];
  passwords: ChangePasswordRequestDto[];
  failProfileGet: boolean;
  failPatch: {
    status: number;
    errorCode: string;
    errors?: Record<string, string[]>;
  } | null;
  failPassword: { status: number; errorCode: string } | null;
  reset: () => void;
}

export function profileSample(role: RoleCode = "TRAVELER"): UserProfileDto {
  return {
    id: 12,
    email: "traveler@test.local",
    role,
    displayName: "Minh Anh",
    avatarUrl: null,
    phone: "0901234567",
    bio: "Thích bún chả",
    status: "active",
    emailVerified: true,
    hasPassword: true,
    linkedProviders: [],
    preferenceStatus: null,
    restaurantId: null,
    permissions: [],
    createdAt: "2026-09-01T03:00:00Z",
  };
}

/** Answers a feature's own routes; returns false to fall through to the account routes. */
export type StubHandler = (
  request: { method: string; url: string; body: unknown },
  send: (
    status: number,
    data: unknown,
    errorCode?: string | null,
    errors?: Record<string, string[]>,
  ) => void,
) => boolean;

export async function startAccountStub(
  port = 5164,
  handler?: StubHandler,
): Promise<AccountStub> {
  const stub = {
    profile: profileSample(),
    calls: [] as string[],
    patches: [] as UpdateProfileRequestDto[],
    passwords: [] as ChangePasswordRequestDto[],
    failProfileGet: false,
    failPatch: null,
    failPassword: null,
  } as unknown as AccountStub;
  stub.reset = () => {
    stub.profile = profileSample();
    stub.calls = [];
    stub.patches = [];
    stub.passwords = [];
    stub.failProfileGet = false;
    stub.failPatch = null;
    stub.failPassword = null;
  };
  stub.server = createServer(async (request, result) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    const send = (
      status: number,
      data: unknown,
      errorCode: string | null = null,
      errors?: Record<string, string[]>,
    ) => {
      result.writeHead(status, { "Content-Type": "application/json" });
      result.end(
        JSON.stringify({
          success: status < 400,
          message: errorCode ? "Test error" : null,
          errorCode,
          data,
          ...(errors ? { errors } : {}),
        }),
      );
    };
    const authResult = (email: string, role: RoleCode) => ({
      accessToken: "test-access",
      refreshToken: "test-refresh",
      accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
      user: {
        id: 12,
        email,
        displayName: stub.profile.displayName,
        avatarUrl: null,
        role,
        status: "active",
        needsPreferenceSurvey: null,
      },
    });
    stub.calls.push(`${request.method} ${request.url}`);
    if (
      handler?.(
        {
          method: request.method ?? "GET",
          url: request.url ?? "",
          body: raw ? (JSON.parse(raw) as unknown) : null,
        },
        send,
      )
    )
      return;
    if (request.url === "/api/v1/auth/login") {
      const { email } = JSON.parse(raw) as { email: string };
      const role = roleByPrefix[email.split("@")[0]] ?? "TRAVELER";
      stub.profile = { ...stub.profile, email, role };
      send(200, authResult(email, role));
    } else if (request.url === "/api/v1/auth/refresh") {
      send(200, authResult(stub.profile.email, stub.profile.role));
    } else if (request.url === "/api/v1/auth/logout") send(200, null);
    else if (request.url === "/api/v1/me" && request.method === "GET") {
      if (stub.failProfileGet) send(503, null, "SERVICE_UNAVAILABLE");
      else send(200, stub.profile);
    } else if (request.url === "/api/v1/me" && request.method === "PATCH") {
      const body = JSON.parse(raw) as UpdateProfileRequestDto;
      stub.patches.push(body);
      if (stub.failPatch)
        send(
          stub.failPatch.status,
          null,
          stub.failPatch.errorCode,
          stub.failPatch.errors,
        );
      else {
        stub.profile = { ...stub.profile, ...body };
        send(200, stub.profile);
      }
    } else if (
      request.url === "/api/v1/me/password" &&
      request.method === "PUT"
    ) {
      stub.passwords.push(JSON.parse(raw) as ChangePasswordRequestDto);
      if (stub.failPassword)
        send(stub.failPassword.status, null, stub.failPassword.errorCode);
      else send(200, null);
    } else send(404, null, "ROUTE_NOT_FOUND");
  });
  await new Promise<void>((resolve) =>
    stub.server.listen(port, "127.0.0.1", resolve),
  );
  return stub;
}

export async function stopAccountStub(stub: AccountStub) {
  await new Promise<void>((resolve, reject) =>
    stub.server.close((error) => (error ? reject(error) : resolve())),
  );
}

export async function loginAs(
  page: Page,
  role: "traveler" | "owner" | "mod" | "admin",
) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/^Email/).fill(`${role}@test.local`);
  await page.getByLabel(/^Mật khẩu/).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
