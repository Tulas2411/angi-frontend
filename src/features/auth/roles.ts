import type { RoleCode } from "./types";

export const ROLE_CODES: readonly RoleCode[] = [
  "TRAVELER",
  "RESTAURANT_OWNER",
  "MOD",
  "ADMIN",
];
/**
 * Landing page after sign-in. Travelers land on the public homepage (signed-in state);
 * Moderators and Administrators keep their workspaces.
 */
export const HOME_BY_ROLE: Record<RoleCode, string> = {
  TRAVELER: "/",
  RESTAURANT_OWNER: "/restaurant",
  MOD: "/moderation",
  ADMIN: "/administration",
};
export const LABEL_BY_ROLE: Record<RoleCode, string> = {
  TRAVELER: "Người khám phá",
  RESTAURANT_OWNER: "Chủ nhà hàng",
  MOD: "Kiểm duyệt viên",
  ADMIN: "Quản trị viên",
};
