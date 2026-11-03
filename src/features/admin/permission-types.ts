/** Wire DTOs of F-66 Manage Permission (API Design v1.8: ADM-P1..ADM-P4, ADM-M1, DTO sheet). */

/** One entry of the permission catalog (`permissions` table). */
export interface PermissionDto {
  code: string;
  description: string;
}

/** ADM-P1: the catalog and the default permissions of each role. */
export interface PermissionCatalogDto {
  permissions: PermissionDto[];
  roleDefaults: {
    MOD: string[];
    /** Always `["*"]`: an Admin has every permission. */
    ADMIN: string[];
  };
}

export type PermissionEffect = "allow" | "deny";

/** DTO "ModPermissions" `overrides[]` (`user_permissions`). */
export interface PermissionOverrideDto {
  permissionCode: string;
  effect: PermissionEffect;
}

/** DTO "ModPermissions": ADM-P2 and ADM-P3 answers. `effective` = roleDefaults + allow − deny. */
export interface ModPermissionsDto {
  roleDefaults: string[];
  overrides: PermissionOverrideDto[];
  effective: string[];
}

/** ADM-P3 body: the whole override list; an empty list means the role defaults only. */
export interface ReplaceModPermissionsRequestDto {
  overrides: PermissionOverrideDto[];
}

/** ADM-P4 body and answer. */
export interface ReplaceModRolePermissionsRequestDto {
  permissionCodes: string[];
}
export interface ReplaceModRolePermissionsResponseDto {
  role: "MOD";
  permissionCodes: string[];
}

/** DTO "AdminUserCard", as listed by ADM-M1. */
export interface AdminUserCardDto {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  suspendedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminModsPageDto {
  items: AdminUserCardDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** ADM-M1 query: `status` is active | deactivated, `pageSize` 1..100. */
export interface ListModsQuery {
  q?: string;
  status?: "active" | "deactivated";
  page?: number;
  pageSize?: number;
}
