import type { RoleCode } from "@/features/auth/types";

/** ME-01 / ME-02 response, API Design v1.8 (DTO UserProfile). */
export interface UserProfileDto {
  id: number;
  email: string;
  role: RoleCode;
  displayName: string;
  avatarUrl: string | null;
  phone: string | null;
  bio: string | null;
  status: string;
  emailVerified: boolean;
  hasPassword: boolean;
  linkedProviders: string[];
  preferenceStatus: "completed" | "skipped" | null;
  restaurantId: number | null;
  permissions: string[];
  createdAt: string;
}

/** ME-02. Omitted keys stay unchanged; `null` clears phone and bio. */
export interface UpdateProfileRequestDto {
  displayName?: string;
  phone?: string | null;
  bio?: string | null;
}

/** ME-03. `currentPassword` is required only when the account already has a password. */
export interface ChangePasswordRequestDto {
  currentPassword?: string;
  newPassword: string;
}

export interface ProfileFormValues {
  displayName: string;
  phone: string;
  bio: string;
}
