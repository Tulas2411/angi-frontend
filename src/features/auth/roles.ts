import type { RoleCode } from "./types";

export const ROLE_CODES: readonly RoleCode[] = [
  "TRAVELER",
  "RESTAURANT_OWNER",
  "MOD",
  "ADMIN",
];
export const HOME_BY_ROLE: Record<RoleCode, string> = {
  TRAVELER: "/discovery",
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
