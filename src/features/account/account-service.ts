import { api } from "@/shared/api/client";
import type {
  ChangePasswordRequestDto,
  UpdateProfileRequestDto,
  UserProfileDto,
} from "./account-types";

export interface AccountService {
  getProfile: () => Promise<UserProfileDto>;
  updateProfile: (request: UpdateProfileRequestDto) => Promise<UserProfileDto>;
  changePassword: (request: ChangePasswordRequestDto) => Promise<null>;
}

/** ME-01, ME-02 and ME-03 through the same-origin proxy. */
export const accountService: AccountService = {
  getProfile: () => api.get<UserProfileDto>("me"),
  updateProfile: (request) => api.patch<UserProfileDto>("me", request),
  changePassword: (request) => api.put<null>("me/password", request),
};
