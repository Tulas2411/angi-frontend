import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { sealData, unsealData } from "iron-session";

const base = process.env.APP_URL ?? "http://localhost:3000";
const password =
  process.env.ANGI_TEST_PASSWORD ??
  JSON.parse(
    readFileSync(
      new URL("../../.tools/local-settings.json", import.meta.url),
      "utf8",
    ).replace(/^\uFEFF/, ""),
  ).devAccountPassword;
const secret = process.env.SESSION_PASSWORD;
assert.ok(secret, "SESSION_PASSWORD is required");
let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks++;
  console.log("PASS " + label);
}
function sessionCookie(response) {
  const values = response.headers.getSetCookie();
  const value = values.find((header) => header.startsWith("angi_session="));
  return value?.split(";")[0] ?? "";
}
async function call(
  path,
  { method = "GET", body, cookie = "", origin = base } = {},
) {
  const headers = { Origin: origin, Accept: "application/json" };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(90_000),
  });
}
async function redirected(response, target, label) {
  if (response.status === 307 && response.headers.get("location") === target) {
    check(true, label);
    return;
  }
  // Next.js emits a meta redirect when a loading boundary has already started streaming.
  const html = response.status === 200 ? await response.text() : "";
  check(
    html.includes('content="0;url=' + target + '"') ||
      html.includes("NEXT_REDIRECT;replace;" + target + ";"),
    label,
  );
}
async function login(email) {
  const response = await call("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(response.status, 200, "Login must succeed: " + email);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.ok(
    !("accessToken" in payload.data) && !("refreshToken" in payload.data),
    "Tokens must not be exposed to browser JSON",
  );
  assert.ok(
    response.headers.getSetCookie().some((header) => /HttpOnly/i.test(header)),
  );
  return { user: payload.data, cookie: sessionCookie(response) };
}
async function unpack(cookie) {
  return unsealData(decodeURIComponent(cookie.slice("angi_session=".length)), {
    password: secret,
    ttl: 30 * 24 * 60 * 60,
  });
}
async function pack(data) {
  return (
    "angi_session=" +
    encodeURIComponent(
      await sealData(data, { password: secret, ttl: 30 * 24 * 60 * 60 }),
    )
  );
}

check((await call("/")).status === 200, "public homepage");
const anonymous = await call("/administration");
check(
  anonymous.status === 307 && anonymous.headers.get("location") === "/login",
  "anonymous guard",
);
const deniedOrigin = await call("/api/auth/login", {
  method: "POST",
  body: {},
  origin: "https://untrusted.example",
});
check(
  deniedOrigin.status === 403 &&
    (await deniedOrigin.json()).errorCode === "FORBIDDEN",
  "mutation origin guard",
);
const invalid = await call("/api/auth/login", {
  method: "POST",
  body: {
    email: "absent-" + randomUUID() + "@angi.local",
    password: "wrong-password",
  },
});
check(
  invalid.status === 401 &&
    (await invalid.json()).errorCode === "INVALID_CREDENTIALS",
  "credential errorCode",
);
const validation = await call("/api/auth/login", {
  method: "POST",
  body: { email: "not-an-email", password: "" },
});
const validationBody = await validation.json();
check(
  validation.status === 400 &&
    !!validationBody.errors.email &&
    !!validationBody.errors.password,
  "field validation",
);

for (const [email, role, home] of [
  ["traveler@angi.local", "TRAVELER", "/discovery"],
  ["owner@angi.local", "RESTAURANT_OWNER", "/restaurant"],
  ["mod@angi.local", "MOD", "/moderation"],
  ["admin@angi.local", "ADMIN", "/administration"],
]) {
  const session = await login(email);
  check(session.user.role === role, role + " login and private tokens");
  check(
    (await call(home, { cookie: session.cookie })).status === 200,
    role + " page",
  );
  const wrong = await call(
    role === "ADMIN" ? "/restaurant" : "/administration",
    { cookie: session.cookie },
  );
  await redirected(wrong, home, role + " role guard");
  const logout = await call("/api/auth/logout", {
    method: "POST",
    cookie: session.cookie,
  });
  check(
    logout.status === 200 && (await logout.json()).data === null,
    role + " logout",
  );
  check(
    (await call(home, { cookie: session.cookie })).headers.get("location") ===
      "/login",
    role + " revoked frontend session",
  );
}

const session = await login("traveler@angi.local");
const original = await unpack(session.cookie);
const expired = {
  ...original,
  id: randomUUID(),
  auth: { ...original.auth, accessTokenExpiresAt: "2000-01-01T00:00:00Z" },
};
const oldCookie = await pack(expired);
const parallel = await Promise.all(
  Array.from({ length: 5 }, () =>
    call("/api/auth/session", { cookie: oldCookie }),
  ),
);
check(
  parallel.every((response) => response.status === 200),
  "parallel expired-token requests",
);
const rotated = await Promise.all(
  parallel.map((response) => unpack(sessionCookie(response))),
);
check(
  rotated.every(
    (value) => value.auth.refreshToken === rotated[0].auth.refreshToken,
  ) && rotated[0].auth.refreshToken !== original.auth.refreshToken,
  "one shared rotated token pair",
);
const currentCookie = sessionCookie(parallel[0]);
const staleResponse = await call("/api/auth/session", { cookie: oldCookie });
check(
  staleResponse.status === 200 &&
    (await unpack(sessionCookie(staleResponse))).auth.refreshToken ===
      rotated[0].auth.refreshToken,
  "stale cookie is updated to the latest token pair",
);
check(
  (await call("/api/auth/session", { cookie: currentCookie })).status === 200,
  "refreshed session stays usable",
);
const futureApi = await call("/api/backend/me", { cookie: currentCookie });
check(
  futureApi.status === 404 &&
    (await futureApi.json()).errorCode === "ROUTE_NOT_FOUND",
  "unimplemented me keeps backend errorCode",
);
const loggedOut = await call("/api/auth/logout", {
  method: "POST",
  cookie: currentCookie,
});
check(loggedOut.status === 200, "logout with rotated refresh token");

const another = await login("traveler@angi.local");
const bad = await unpack(another.cookie);
bad.id = randomUUID();
bad.auth.accessTokenExpiresAt = "2000-01-01T00:00:00Z";
bad.auth.refreshToken = "invalid-local-test-token";
const expiredResponse = await call("/api/auth/session", {
  cookie: await pack(bad),
});
check(
  expiredResponse.status === 401 &&
    (await expiredResponse.json()).errorCode === "REFRESH_TOKEN_INVALID",
  "invalid refresh exits without a retry loop",
);
check(
  expiredResponse.headers
    .getSetCookie()
    .some((header) => /Max-Age=0/i.test(header)),
  "invalid refresh deletes cookie",
);
await call("/api/auth/logout", { method: "POST", cookie: another.cookie });
console.log("Completed " + checks + " local integration checks.");
