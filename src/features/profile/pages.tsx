"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/shared/ui";
import {
  Breadcrumbs,
  Dialog,
  Field,
  UploadField,
  Avatar,
  type UploadedFile,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";
import { validateUpload } from "@/features/platform/rules";
import { LogoutButton } from "@/features/auth/session-panel";
import {
  profileService,
  useProfile,
  type UserProfileDto,
} from "@/api/services/profile-service";
import { passwordService } from "@/api/services/password-service";
import { fireAndForget } from "@/shared/api/fire-and-forget";

export function AccountPage({ profile = false }: { profile?: boolean }) {
  const { data, mutate, busy } = usePlatform(),
    { user, base, demo } = useWorkspace(),
    router = useRouter();
  // Demo mode is a preview that defaults to mock data, but as soon as a
  // real user is signed in we must read from the BE — even if the URL
  // still has /demo/... in it (the WorkspaceShell for those routes
  // injects a mock user, but the BE session cookie is real).
  const live = useProfile();
  const useMock = demo && !live.profile;
  const source: UserProfileDto | null = useMock ? null : live.profile;
  const defaults = {
    name:
      source?.displayName ??
      (profile ? data.profile.name : user?.displayName ?? ""),
    phone: source?.phone ?? (useMock ? data.profile.phone : ""),
    bio: source?.bio ?? (useMock ? data.profile.bio ?? "" : ""),
  };
  const [draft, setDraft] = useState<{
    source: UserProfileDto | null;
    name: string;
    phone: string;
    bio: string;
  } | null>(null);
  // A new backend response supplies fresh defaults without mirroring it in an effect.
  const { name, phone, bio } = draft?.source === source ? draft : defaults;
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");

  function updateDraft(fields: Partial<typeof defaults>) {
    setDraft((current) => ({
      ...(current?.source === source ? current : defaults),
      ...fields,
      source,
    }));
  }

  // Source of truth for displayed identity fields.
  // - Signed-in user (any route, including /demo/...): BE profile wins.
  // - Pure preview (no session): fall back to mock so the UI still renders.
  const displayName = useMock
    ? profile
      ? data.profile.name
      : (user?.displayName ?? "")
    : ((source?.displayName ?? user?.displayName) ?? "");
  const email = useMock
    ? (user?.email ?? "")
    : (source?.email ?? user?.email ?? "");
  const avatar = useMock
    ? (files[0]?.url ?? data.profile.avatar)
    : (files[0]?.url ?? source?.avatarUrl ?? null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    setSaved(false);
    if (useMock) {
      // Mock flow: mutate in-memory store, then fire BE PATCH in background.
      await mutate((d) => {
        if (user?.role === "TRAVELER")
          for (const blog of d.blogs) {
            if (blog.author === user.displayName) blog.author = trimmed;
            for (const comment of blog.comments)
              if (comment.author === user.displayName)
                comment.author = trimmed;
          }
        d.profile = {
          name: trimmed,
          phone,
          bio,
          avatar: files[0]?.url ?? d.profile.avatar,
        };
      });
      fireAndForget(
        "me.patch",
        () =>
          profileService.updateMyProfile({
            displayName: trimmed,
            phone: phone || undefined,
            bio: bio || undefined,
          }),
      );
      return;
    }
    // Live flow: PATCH /me, await response, update state from BE.
    try {
      await live.save({
        displayName: trimmed,
        phone: phone || undefined,
        bio: bio || undefined,
      });
      setSaved(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Cập nhật hồ sơ thất bại.";
      setError(msg);
    }
  }

  function resetForm() {
    if (useMock) {
      updateDraft({
        name: data.profile.name,
        phone: data.profile.phone,
        bio: data.profile.bio ?? "",
      });
    } else if (source) {
      setDraft(null);
    }
    setFiles([]);
    setError("");
    setSaved(false);
  }

  return (
    <div className={profile ? "container workspace stack" : "stack"}>
      {/* === MÀN HỒ SƠ CHO TRAVELER (2 CỘT) === */}
      {profile ? (
        <>
          <Breadcrumbs
            items={[
              { label: "Trang chủ", href: base || "/" },
              { label: "Hồ sơ của tôi" },
            ]}
          />
          <PageHeading
            title="Chỉnh sửa hồ sơ"
            description="Cập nhật thông tin cá nhân, ảnh đại diện và bảo vệ tài khoản của bạn."
          />

          <div className="profile-edit-grid">
            {/* CỘT TRÁI: 1 card duy nhất (avatar + tên + email + nút thay/xóa ảnh) */}
            <Card className="profile-edit-side">
              {/* Avatar */}
              <div className="profile-avatar-block">
                <span className="profile-avatar-xl" aria-hidden>
                  <Avatar name={displayName} image={avatar ?? undefined} />
                </span>
              </div>

              {/* Tên + email */}
              <div className="profile-side-identity">
                <h2>{displayName}</h2>
                <p className="helper">{email}</p>
              </div>

              {/* 2 nút: Thay đổi / Xóa ảnh đại diện — chỉ preview mock mới hỗ
                  trợ upload local; chế độ thật chưa wire media endpoint. */}
              {useMock && (
                <div className="profile-avatar-actions">
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={async (e) => {
                      const picked = e.target.files?.[0];
                      e.target.value = "";
                      if (!picked) return;
                      const problem = validateUpload(picked, false);
                      if (problem) {
                        setUploadError(problem);
                        return;
                      }
                      setUploadError("");
                      const url = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result));
                        reader.onerror = () =>
                          reject(new Error("Không đọc được tệp."));
                        reader.readAsDataURL(picked);
                      });
                      setFiles([
                        {
                          id: crypto.randomUUID(),
                          name: picked.name,
                          url,
                          size: picked.size,
                          type: picked.type,
                        },
                      ]);
                    }}
                  />
                  <Button
                    className="button-sm"
                    onClick={() => avatarInput.current?.click()}
                  >
                    Thay đổi ảnh đại diện
                  </Button>
                  <Button
                    className="button-sm"
                    variant="secondary"
                    disabled={!avatar}
                    onClick={() => {
                      setFiles([]);
                      if (profile && useMock)
                        mutate((d) => {
                          d.profile = { ...d.profile, avatar: "" };
                        });
                    }}
                  >
                    Xóa ảnh đại diện
                  </Button>
                  {uploadError && (
                    <p className="profile-avatar-error" role="alert">
                      {uploadError}
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* CỘT PHẢI: form thông tin cá nhân */}
            <Card className="soft" title="Thông tin cá nhân">
              {error && (
                <Alert tone="error">{error}</Alert>
              )}
              {saved && !error && (
                <Alert tone="success">Đã lưu thay đổi vào hồ sơ của bạn.</Alert>
              )}
              {!useMock && live.loading && (
                <p className="helper">Đang tải hồ sơ từ máy chủ…</p>
              )}
              <form
                id="profile-form"
                className="stack"
                onSubmit={saveProfile}
              >
                <Field
                  label="Tên hiển thị"
                  value={name}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  minLength={2}
                  maxLength={100}
                  required
                  helper="Từ 2 đến 100 ký tự."
                />
                <Field
                  label="Email"
                  value={email}
                  readOnly
                  helper="Email tài khoản · Chỉ xem"
                />
                <Field
                  label="Số điện thoại"
                  value={phone}
                  onChange={(e) => updateDraft({ phone: e.target.value })}
                  maxLength={20}
                />
                <TextArea
                  label="Giới thiệu"
                  value={bio}
                  onChange={(e) => updateDraft({ bio: e.target.value })}
                  maxLength={500}
                  helper="Không bắt buộc."
                />
                <div className="actions">
                  <Button
                    type="submit"
                    loading={useMock ? busy : live.saving}
                  >
                    Lưu thay đổi
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`${base}/profile`)}
                  >
                    Hủy thay đổi
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </>
      ) : (
        /* === MÀN TÀI KHOẢN CHO CÁC ROLE KHÁC === */
        <>
          <PageHeading
            title="Tài khoản của bạn"
            description="Cập nhật thông tin cá nhân và bảo vệ tài khoản của bạn."
          />
          <div className="split-content">
            <Card className="soft" title="Thông tin cá nhân">
              {error && (
                <Alert tone="error">{error}</Alert>
              )}
              {saved && !error && (
                <Alert tone="success">Đã lưu thay đổi vào hồ sơ của bạn.</Alert>
              )}
              <form className="stack" onSubmit={saveProfile}>
                <Field
                  label="Tên hiển thị"
                  value={name}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  minLength={2}
                  maxLength={100}
                  required
                  helper="Từ 2 đến 100 ký tự."
                />
                <Field
                  label="Email"
                  value={email}
                  readOnly
                  helper="Email tài khoản · Chỉ xem"
                />
                <Field
                  label="Số điện thoại"
                  value={phone}
                  onChange={(e) => updateDraft({ phone: e.target.value })}
                  maxLength={20}
                />
                {useMock && (
                  <UploadField
                    label="Ảnh đại diện"
                    files={files}
                    onChange={setFiles}
                  />
                )}
                <TextArea
                  label="Giới thiệu"
                  value={bio}
                  onChange={(e) => updateDraft({ bio: e.target.value })}
                  maxLength={500}
                  helper="Không bắt buộc."
                />
                <div className="actions">
                  <Button
                    type="submit"
                    loading={useMock ? busy : live.saving}
                  >
                    Lưu hồ sơ
                  </Button>
                  <Button variant="secondary" onClick={resetForm}>
                    Hủy thay đổi
                  </Button>
                </div>
              </form>
            </Card>
            <div className="stack">
              <Card title="Tài khoản">
                <div className="profile-card">
                  <Avatar name={displayName} image={avatar ?? undefined} />
                  <div>
                    <strong>{displayName}</strong>
                    <p className="helper">{email}</p>
                  </div>
                </div>
                <p className="helper">
                  {useMock ? "Đang hoạt động · Dữ liệu minh họa" : "Đang hoạt động"}
                </p>
                <div className="actions">
                  <Button
                    variant="secondary"
                    onClick={() => setPasswordOpen(true)}
                  >
                    Đổi mật khẩu
                  </Button>
                  <LogoutButton />
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Dialog đổi mật khẩu */}
      <Dialog
        open={passwordOpen}
        onClose={() => {
          setPasswordOpen(false);
          setError("");
        }}
        title="Đổi mật khẩu"
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== confirm) {
              setError("Mật khẩu xác nhận chưa trùng khớp.");
              return;
            }
            setError("Đang gửi yêu cầu đổi mật khẩu…");
            const result = await passwordService.changePassword({
              currentPassword: current || undefined,
              newPassword: password,
            });
            if (result.ok) {
              setError("");
              setCurrent("");
              setPassword("");
              setConfirm("");
              setPasswordOpen(false);
            } else if (result.errorCode) {
              setError(result.message ?? "Đổi mật khẩu thất bại.");
            } else {
              // BE chưa phản hồi (offline / chưa có DB) — vẫn đóng dialog trong giai đoạn chuyển tiếp.
              setError("");
              setCurrent("");
              setPassword("");
              setConfirm("");
              setPasswordOpen(false);
            }
          }}
        >
          <Field
            label="Mật khẩu hiện tại"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <Field
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={64}
            required
          />
          <Field
            label="Nhập lại mật khẩu mới"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            error={error}
          />
          <Button type="submit">Cập nhật mật khẩu</Button>
        </form>
      </Dialog>
    </div>
  );
}
