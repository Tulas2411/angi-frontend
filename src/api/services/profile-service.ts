/**
 * F-07 Manage Personal Profile · ACC-01/02.
 * - GET   /me                 (ME-01)
 * - PATCH /me                 (ME-02)
 *
 * `useProfile()` is the React hook for the Account page: it loads the
 * authenticated user's profile from the backend on mount, exposes a save()
 * helper that PATCHes /me and updates local state from the response. Falls
 * back to `null` while loading or if the BE call fails — callers can decide
 * how to behave offline.
 *
 * The fire-and-forget helpers below remain for callers that want to ping
 * the BE without affecting UI (e.g. background sync).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/client";
import { fireAndCollect } from "@/shared/api/fire-and-forget";

/** DTO phản hồi của GET/PATCH /me — định nghĩa tối thiểu cho hợp đồng v1.8. */
export interface UserProfileDto {
  id: number;
  email: string;
  role: string;
  displayName: string;
  avatarUrl: string | null;
  phone: string | null;
  bio: string | null;
  status: string;
  emailVerified: boolean;
  hasPassword: boolean;
  linkedProviders: string[];
  preferenceStatus: string | null;
  restaurantId: number | null;
  permissions: string[];
  createdAt: string;
}

/** Body của PATCH /me: tất cả field optional. */
export interface UpdateProfileRequestDto {
  displayName?: string;
  phone?: string;
  bio?: string;
  avatarMediaId?: number;
}

export const profileService = {
  /** Fire-and-forget read; trả về profile nếu BE có, hoặc undefined nếu lỗi. */
  async getMyProfile(): Promise<UserProfileDto | undefined> {
    return fireAndCollect("me.get", () => api.getOptional<UserProfileDto>("me"));
  },

  /** Fire-and-forget update; trả về profile mới nếu BE có, hoặc undefined. */
  async updateMyProfile(
    request: UpdateProfileRequestDto,
  ): Promise<UserProfileDto | undefined> {
    return fireAndCollect("me.patch", () =>
      api.patch<UserProfileDto>("me", request),
    );
  },
};

/**
 * React hook for the Account page in live mode.
 *
 * Loads `GET /me` on mount and exposes `save()` that PATCHes /me then
 * updates local state from the BE response. Returns `null` for `profile`
 * while loading and keeps the last known value on error so the UI does
 * not flash empty fields.
 */
export function useProfile() {
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // `getOptional` (không tự redirect khi 401) — trang công khai vẫn gọi hook
    // này qua ProfileIdentity; nếu dùng `get` thì khách chưa đăng nhập sẽ bị
    // đẩy sang /login khi mở trang chi tiết món ăn.
    api
      .getOptional<UserProfileDto>("me")
      .then((data) => {
        if (!active) return;
        setProfile(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Không tải được hồ sơ.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(
    async (request: UpdateProfileRequestDto) => {
      setSaving(true);
      setError(null);
      try {
        const updated = await api.patch<UserProfileDto>("me", request);
        setProfile(updated);
        return updated;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Cập nhật hồ sơ thất bại.";
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // Return a stable reference for `profile` itself, but keep the loading
  // / saving / error flags fresh. Callers that depend on the whole
  // returned object will not re-render just because a sibling field
  // changed.
  return useMemo(
    () => ({ profile, loading, saving, error, save }),
    [profile, loading, saving, error, save],
  );
}
