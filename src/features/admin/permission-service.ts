import { api } from "@/shared/api/client";
import type {
  AdminModsPageDto,
  ListModsQuery,
  ModPermissionsDto,
  PermissionCatalogDto,
  PermissionOverrideDto,
  ReplaceModRolePermissionsResponseDto,
} from "./permission-types";

/**
 * F-66 Manage Permission. The calls go through the same-origin proxy, which only lets an Admin
 * session through, so the access token never reaches the browser.
 */
export interface PermissionService {
  /** ADM-P1: the permission catalog and the MOD role defaults. */
  catalog(): Promise<PermissionCatalogDto>;
  /** ADM-M1: one page of Mod accounts, to choose whose permissions to edit. */
  mods(query: ListModsQuery): Promise<AdminModsPageDto>;
  /** ADM-P2: defaults, overrides and effective permissions of one Mod. */
  modPermissions(userId: number): Promise<ModPermissionsDto>;
  /** ADM-P3: replaces every override of one Mod. */
  replaceModPermissions(
    userId: number,
    overrides: PermissionOverrideDto[],
  ): Promise<ModPermissionsDto>;
  /** ADM-P4: replaces the default permissions of the MOD role. */
  replaceRoleDefaults(
    permissionCodes: string[],
  ): Promise<ReplaceModRolePermissionsResponseDto>;
}

export function modsQueryString(query: ListModsQuery) {
  const params = new URLSearchParams();
  const text = query.q?.trim();
  if (text) params.set("q", text);
  if (query.status) params.set("status", query.status);
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.pageSize !== undefined)
    params.set("pageSize", String(query.pageSize));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const permissionService: PermissionService = {
  catalog: () => api.get<PermissionCatalogDto>("admin/permissions"),
  mods: (query) =>
    api.get<AdminModsPageDto>(`admin/mods${modsQueryString(query)}`),
  modPermissions: (userId) =>
    api.get<ModPermissionsDto>(`admin/mods/${userId}/permissions`),
  replaceModPermissions: (userId, overrides) =>
    api.put<ModPermissionsDto>(`admin/mods/${userId}/permissions`, {
      overrides,
    }),
  replaceRoleDefaults: (permissionCodes) =>
    api.put<ReplaceModRolePermissionsResponseDto>(
      "admin/roles/MOD/permissions",
      { permissionCodes },
    ),
};
