import { api } from "@/shared/api/client";
import { modsQueryString } from "./permission-service";
import type {
  CreateModRequestDto,
  ModDetailDto,
  UpdateModRequestDto,
} from "./mod-types";
import type {
  AdminModsPageDto,
  AdminUserCardDto,
  ListModsQuery,
} from "./permission-types";

/** F-65 Manage Mod through the same-origin proxy (Admin sessions only). */
export interface ModService {
  /** ADM-M1: one page of Mod accounts. */
  list(query: ListModsQuery): Promise<AdminModsPageDto>;
  /** ADM-M2: creates a Mod and e-mails an invitation to set a password. */
  create(request: CreateModRequestDto): Promise<AdminUserCardDto>;
  /** ADM-M3: the Mod with their permissions and what they handled. */
  detail(userId: number): Promise<ModDetailDto>;
  /** ADM-M4: renames, deactivates or reactivates a Mod. */
  update(
    userId: number,
    request: UpdateModRequestDto,
  ): Promise<AdminUserCardDto>;
}

export const modService: ModService = {
  list: (query) =>
    api.get<AdminModsPageDto>(`admin/mods${modsQueryString(query)}`),
  create: (request) => api.post<AdminUserCardDto>("admin/mods", request),
  detail: (userId) => api.get<ModDetailDto>(`admin/mods/${userId}`),
  update: (userId, request) =>
    api.patch<AdminUserCardDto>(`admin/mods/${userId}`, request),
};
