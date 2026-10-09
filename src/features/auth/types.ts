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
