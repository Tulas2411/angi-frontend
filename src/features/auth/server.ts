import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession, type SessionOptions } from "iron-session";
import { ApiError, readApiResponse } from "@/shared/api/error";
import { HOME_BY_ROLE, ROLE_CODES } from "./roles";
import { createRefreshCoordinator } from "./refresh-coordinator";
import { createSessionRegistry } from "./session-registry";
import { runAuthenticated } from "./authenticated-request";
import type { AuthResultDto, AuthUserDto, RoleCode } from "./types";

interface SessionData {
  auth?: AuthResultDto;
  id?: string;
}
function options(ttl = 30 * 24 * 60 * 60): SessionOptions {
  const password = process.env.SESSION_PASSWORD;
  if (!password || password.length < 32)
    throw new Error("SESSION_PASSWORD cần ít nhất 32 ký tự.");
  return {
    password,
    cookieName: "angi_session",
    ttl,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ttl,
    },
  };
}
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), options());
}
export type AuthSession = Awaited<ReturnType<typeof getSession>>;

function validAuth(value: unknown): value is AuthResultDto {
  if (!value || typeof value !== "object") return false;
  const auth = value as AuthResultDto;
  return (
    typeof auth.accessToken === "string" &&
    auth.accessToken.length > 0 &&
    typeof auth.refreshToken === "string" &&
    auth.refreshToken.length > 0 &&
    !!auth.user &&
    typeof auth.user.id === "number" &&
    ROLE_CODES.includes(auth.user.role) &&
    auth.user.status === "active" &&
    Number.isFinite(Date.parse(auth.accessTokenExpiresAt)) &&
    Number.isFinite(Date.parse(auth.refreshTokenExpiresAt)) &&
    Date.parse(auth.refreshTokenExpiresAt) > Date.now()
  );
}

const state = globalThis as typeof globalThis & {
  angiRefresh?: ReturnType<typeof createRefreshCoordinator<AuthResultDto>>;
  angiSessions?: ReturnType<typeof createSessionRegistry>;
};
const coordinateRefresh = (state.angiRefresh ??=
  createRefreshCoordinator<AuthResultDto>());
const sessions = (state.angiSessions ??= createSessionRegistry());

export function readAuth(session: AuthSession): AuthResultDto | null {
  if (!session.id || sessions.isRevoked(session.id)) return null;
  const auth = sessions.get(session.id) ?? session.auth;
  return validAuth(auth) ? auth : null;
}

export function destroySession(session: AuthSession) {
  if (session.id && session.auth) {
    sessions.revoke(session.id, Date.parse(session.auth.refreshTokenExpiresAt));
  }
  session.destroy();
}

export async function saveAuth(
  session: AuthSession,
  auth: AuthResultDto,
  newLogin = false,
) {
  if (!validAuth(auth))
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Dữ liệu đăng nhập không hợp lệ.",
    );
  if (!newLogin && session.id && sessions.isRevoked(session.id)) {
    throw new ApiError(401, "UNAUTHORIZED", "Phiên đã đăng xuất.");
  }
  const ttl = Math.ceil(
    (Date.parse(auth.refreshTokenExpiresAt) - Date.now()) / 1000,
  );
  session.updateConfig(options(ttl));
  if (newLogin || !session.id) session.id = randomUUID();
  if (!sessions.save(session.id, auth))
    throw new ApiError(401, "UNAUTHORIZED", "Phiên đã đăng xuất.");
  session.auth = auth;
  await session.save();
}

export async function backend<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    token?: string;
  } = {},
): Promise<T> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) throw new Error("Thiếu API_BASE_URL.");
  const headers = new Headers({ Accept: "application/json" });
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Không kết nối được backend ANGI.",
    );
  }
  return readApiResponse<T>(response);
}

export async function refreshSession(session: AuthSession) {
  const auth = readAuth(session);
  if (!auth) throw new ApiError(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
  const key = createHash("sha256").update(auth.refreshToken).digest("hex");
  const fresh = await coordinateRefresh(key, () =>
    backend<AuthResultDto>("auth/refresh", {
      method: "POST",
      body: { refreshToken: auth.refreshToken },
    }),
  );
  const current = readAuth(session);
  const latest =
    current && current.refreshToken !== auth.refreshToken ? current : fresh;
  await saveAuth(session, latest);
  return latest;
}

export async function withAuth<T>(
  session: AuthSession,
  send: (auth: AuthResultDto) => Promise<T>,
) {
  const auth = readAuth(session);
  if (!auth) throw new ApiError(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
  const result = await runAuthenticated(auth, send, () =>
    refreshSession(session),
  );
  const latest = readAuth(session);
  if (!latest) throw new ApiError(401, "UNAUTHORIZED", "Phiên đã đăng xuất.");
  if (latest.refreshToken !== session.auth?.refreshToken)
    await saveAuth(session, latest);
  return result;
}

export async function requireUser(
  roles?: readonly RoleCode[],
): Promise<AuthUserDto> {
  const auth = readAuth(await getSession());
  if (!auth) redirect("/login");
  if (roles && !roles.includes(auth.user.role))
    redirect(HOME_BY_ROLE[auth.user.role]);
  return auth.user;
}
