/**
 * F-08 Change Password · ACC-03 (ME-03).
 * - PUT /me/password
 *
 * Gọi nền — UI vẫn xử lý trạng thái (success/error) dựa trên local state.
 */

import { api } from "@/shared/api/client";
import { fireAndCollect } from "@/shared/api/fire-and-forget";

export interface ChangePasswordRequestDto {
  currentPassword?: string;
  newPassword: string;
}

export const passwordService = {
  async changePassword(
    request: ChangePasswordRequestDto,
  ): Promise<{ ok: true } | { ok: false; errorCode?: string; message?: string }> {
    const result = await fireAndCollect("me.password", () =>
      api.put<null>("me/password", request),
    );
    if (result === undefined) {
      // BE không phản hồi (offline) hoặc lỗi — caller tự quyết định UI.
      return { ok: false };
    }
    return { ok: true };
  },
};
