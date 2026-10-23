import type { RoleCode } from "./types";

export const ROLE_CODES: readonly RoleCode[] = [
  "TRAVELER",
  "RESTAURANT_OWNER",
  "MOD",
  "ADMIN",
];
/**
 * Landing page after sign-in. Only RESTAURANT_OWNER has a business workspace
 * backed by the real API; every other role lands on the public homepage in its
 * signed-in state until its workspace is integrated.
 */
export const HOME_BY_ROLE: Record<RoleCode, string> = {
  TRAVELER: "/",
  RESTAURANT_OWNER: "/restaurant",
  MOD: "/",
  ADMIN: "/",
};
export const LABEL_BY_ROLE: Record<RoleCode, string> = {
  TRAVELER: "Người khám phá",
  RESTAURANT_OWNER: "Chủ nhà hàng",
  MOD: "Kiểm duyệt viên",
  ADMIN: "Quản trị viên",
};
