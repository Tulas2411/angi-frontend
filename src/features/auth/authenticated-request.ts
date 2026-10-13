import { ApiError } from "@/shared/api/error";
import type { AuthResultDto } from "./types";

export async function runAuthenticated<T>(
  auth: AuthResultDto,
  send: (current: AuthResultDto) => Promise<T>,
  rotate: () => Promise<AuthResultDto>,
  now = Date.now(),
): Promise<T> {
  let current = auth;
  let refreshed = false;
  if (Date.parse(current.accessTokenExpiresAt) <= now) {
    current = await rotate();
    refreshed = true;
  }
  try {
    return await send(current);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.errorCode === "UNAUTHORIZED" &&
      !refreshed
    ) {
      return send(await rotate());
    }
    throw error;
  }
}
