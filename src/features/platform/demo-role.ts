import type { RoleCode } from "@/features/auth/types";
export const demoRoles: Record<string, RoleCode | "GUEST"> = {
  guest: "GUEST",
  traveler: "TRAVELER",
  owner: "RESTAURANT_OWNER",
  moderator: "MOD",
  admin: "ADMIN",
};
