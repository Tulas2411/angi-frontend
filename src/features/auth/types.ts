export type RoleCode = "TRAVELER" | "RESTAURANT_OWNER" | "MOD" | "ADMIN";
export type UserStatus =
  "pending_verification" | "active" | "suspended" | "banned" | "deactivated";

export interface AuthUserDto {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: RoleCode;
  status: UserStatus;
  needsPreferenceSurvey: boolean | null;
}

export interface AuthResultDto {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: AuthUserDto;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

// Wire DTOs for AUTH-01 self-registration. Status comes from backend as snake_case
// (e.g. "pending_verification") and reuses the existing UserStatus union.
export type RegisterableRole = Extract<RoleCode, "TRAVELER" | "RESTAURANT_OWNER">;

export interface RegisterAccountRequestDto {
  email: string;
  password: string;
  displayName: string;
  role: RegisterableRole;
}

export interface RegisterAccountResponseDto {
  userId: number;
  email: string;
  role: RoleCode;
  status: UserStatus;
}
