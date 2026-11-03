/** Wire DTOs of F-65 Manage Mod (API Design v1.8: ADM-M1..ADM-M4, sheet DTO). */
import type {
  AdminUserCardDto,
  ModPermissionsDto,
  PermissionOverrideDto,
} from "./permission-types";

/** ADM-M3: the card, the Mod's permissions and how much they handled (all time). */
export interface ModDetailDto extends AdminUserCardDto {
  permissions: ModPermissionsDto;
  handled: {
    verifications: number;
    menus: number;
    reports: number;
  };
}

/** ADM-M2 body: the Mod sets a password from the invitation e-mail (AUTH-09 flow). */
export interface CreateModRequestDto {
  email: string;
  displayName: string;
  permissionOverrides?: PermissionOverrideDto[];
}

/** ADM-M4 body: at least one field; `deactivated` revokes every session of the Mod. */
export interface UpdateModRequestDto {
  displayName?: string;
  status?: "active" | "deactivated";
}
