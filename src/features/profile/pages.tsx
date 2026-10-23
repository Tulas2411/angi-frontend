"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input } from "@/shared/ui";
import {
  ActionLink,
  Breadcrumbs,
  Choice,
  ConfirmDialog,
  Dialog,
  Field,
  UploadField,
  Avatar,
  Icon,
  type UploadedFile,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";
import {
  dateLabel,
  relativeTimeLabel,
  validateUpload,
} from "@/features/platform/rules";
import { LogoutButton } from "@/features/auth/session-panel";
import {
  profileService,
  useProfile,
  type UserProfileDto,
} from "@/api/services/profile-service";
import { passwordService } from "@/api/services/password-service";
import { fireAndForget } from "@/shared/api/fire-and-forget";
import { notificationService } from "@/api/services/notification-service";

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

/* === Ô NHẬP MẬT KHẨU CÓ NÚT HIỆN/ẨN === */
function PasswordField({
  label,
  value,
  onChange,
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      <div className="password-row">
        <Input
          type={shown ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShown((s) => !s)}
        >
          {shown ? "Ẩn" : "Hiện"}
        </Button>
      </div>
    </div>
  );
}

/* === TRANG HỒ SƠ CỦA TÔI (READ-ONLY) === */
export function ProfileViewPage() {
  const { data, busy } = usePlatform(),
    { user, base, demo } = useWorkspace();
  // Match AccountPage: only fall back to mock when the BE has no profile
  // (i.e. the user is not signed in). Once /me returns a real profile,
  // use it regardless of the route.
  const live = useProfile();
  const useMock = demo && !live.profile;
  const source: UserProfileDto | null = useMock ? null : live.profile;
  const displayName = useMock
    ? data.profile.name
    : (source?.displayName ?? user?.displayName ?? "");
  const email = useMock
    ? (user?.email ?? "")
    : (source?.email ?? user?.email ?? "");
  const avatar = useMock
    ? data.profile.avatar
    : (source?.avatarUrl ?? null);
  const [tab, setTab] = useState<"trips" | "guides">("trips");

  // Popup đổi mật khẩu
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  function openPwDialog() {
    setPwCurrent("");
    setPwNew("");
    setPwConfirm("");
    setPwError("");
    setPwSuccess(false);
    setPwOpen(true);
  }
  function closePwDialog() {
    setPwOpen(false);
  }
  async function submitPw(e: FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);
    if (!pwCurrent) {
      setPwError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    if (pwNew.length < 8) {
      setPwError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("Mật khẩu nhập lại không khớp.");
      return;
    }
    setPwError("Đang gửi yêu cầu đổi mật khẩu…");
    const result = await passwordService.changePassword({
      currentPassword: pwCurrent,
      newPassword: pwNew,
    });
    if (result.ok) {
      setPwSuccess(true);
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    } else if (result.errorCode) {
      setPwError(result.message ?? "Đổi mật khẩu thất bại.");
    } else {
      // BE offline — vẫn xử lý thành công local trong giai đoạn chuyển tiếp.
      setPwSuccess(true);
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    }
  }

  // Đếm số cẩm nang của user hiện tại
  const myGuides = data.blogs.filter((b) => b.author === displayName);

  return (
    <div className="container workspace stack">
      <Breadcrumbs
        items={[
          { label: "Trang chủ", href: base || "/" },
          { label: "Hồ sơ của tôi" },
        ]}
      />

      {/* HERO: card trái (avatar + tên/email/nút) + card phải (Lịch trình ăn) */}
      <div className="split-content profile-columns">
        {/* CỘT TRÁI: card hình chữ nhật chứa avatar + tên + email + nút */}
        <Card>
          <div className="profile-side-card">
            <span className="profile-avatar-xl" aria-hidden>
              <Avatar name={displayName} image={avatar ?? undefined} />
            </span>
            <div className="profile-side-identity">
              <h2>{displayName}</h2>
              <p className="helper">{email}</p>
            </div>
            <div className="profile-side-actions actions">
              <ActionLink href={`${base}/profile/edit`}>
                Chỉnh sửa hồ sơ
              </ActionLink>
              <Button variant="secondary" onClick={openPwDialog}>
                Đổi mật khẩu
              </Button>
            </div>
          </div>
        </Card>

        {/* CỘT PHẢI: Card "Lịch trình ăn" hoặc "Hướng dẫn" với tabs */}
        <div className="stack">
          <div className="profile-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "trips"}
              className={`profile-tab ${tab === "trips" ? "active" : ""}`}
              onClick={() => setTab("trips")}
            >
              Lịch trình ăn của tôi
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "guides"}
              className={`profile-tab ${tab === "guides" ? "active" : ""}`}
              onClick={() => setTab("guides")}
            >
              Hướng dẫn
            </button>
          </div>

          {tab === "trips" ? (
            <Card title="Lịch trình ăn của tôi">
              {data.trips.length > 0 ? (
                <div className="stack">
                  {data.trips.map((trip) => (
                    <article className="profile-trip" key={trip.id}>
                      <span className="profile-trip-thumb" aria-hidden>
                        <Icon name="calendar" />
                      </span>
                      <div className="profile-trip-body">
                        <div className="between">
                          <strong>{trip.name}</strong>
                          <span className="helper">
                            Cập nhật {dateLabel(trip.end)}
                          </span>
                        </div>
                        <p className="helper">{trip.destination}</p>
                        <p className="helper">
                          Lên kế hoạch từ {trip.days?.length ?? 5} ngày
                        </p>
                        <div className="actions">
                          <ActionLink href={`${base}/roadmaps/${trip.id}`}>
                            Mở lịch ăn
                          </ActionLink>
                        </div>
                      </div>
                    </article>
                  ))}
                  <ActionLink href={`${base}/roadmaps`} secondary>
                    Xem tất cả lịch ăn
                  </ActionLink>
                </div>
              ) : (
                <div className="empty-state">
                  <span aria-hidden className="empty-symbol">
                    ◎
                  </span>
                  <h3>Chưa có lịch ăn</h3>
                  <p>
                    Tạo lịch ăn đầu tiên để ANGI gợi ý món phù hợp theo khu
                    vực.
                  </p>
                  <ActionLink href={`${base}/roadmaps/new`}>
                    Tạo lịch ăn
                  </ActionLink>
                </div>
              )}
            </Card>
          ) : (
            <Card title="Hướng dẫn của tôi">
              {myGuides.length > 0 ? (
                <div className="stack">
                  {myGuides.map((blog) => (
                    <article className="profile-trip" key={blog.id}>
                      <span className="profile-trip-thumb" aria-hidden>
                        <Icon name="Plus" />
                      </span>
                      <div className="profile-trip-body">
                        <div className="between">
                          <strong>{blog.title}</strong>
                          <span className="helper">
                            Cập nhật {dateLabel(blog.date)}
                          </span>
                        </div>
                        <p className="helper">
                          {blog.content.slice(0, 120)}
                          {blog.content.length > 120 ? "…" : ""}
                        </p>
                        <div className="actions">
                          <ActionLink href={`${base}/guides/${blog.id}`}>
                            Mở bài viết
                          </ActionLink>
                        </div>
                      </div>
                    </article>
                  ))}
                  <ActionLink href={`${base}/my-guides`} secondary>
                    Xem tất cả bài viết
                  </ActionLink>
                </div>
              ) : (
                <div className="empty-state">
                  <span aria-hidden className="empty-symbol">
                    ◎
                  </span>
                  <h3>Chưa có bài viết</h3>
                  <p>
                    Chia sẻ trải nghiệm ẩm thực của bạn với cộng đồng ANGI.
                  </p>
                  <ActionLink href={`${base}/guides/new`}>
                    Viết cẩm nang
                  </ActionLink>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Popup đổi mật khẩu */}
      <Dialog
        open={pwOpen}
        onClose={closePwDialog}
        title="Đổi mật khẩu"
        footer={
          <div className="dialog-actions-pw">
            <Button type="submit" form="pw-form" loading={busy}>
              Đổi mật khẩu
            </Button>
            <Button variant="secondary" onClick={closePwDialog}>
              Hủy
            </Button>
          </div>
        }
      >
        <form id="pw-form" className="stack" onSubmit={submitPw}>
          <Alert
            tone={pwError ? "error" : pwSuccess ? "success" : "info"}
          >
            {pwError ||
              (pwSuccess
                ? "Đổi mật khẩu thành công. Bạn có thể đóng cửa sổ."
                : "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 8 ký tự).")}
          </Alert>
          <PasswordField
            label="Mật khẩu hiện tại"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
          <PasswordField
            label="Mật khẩu mới"
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
            autoComplete="new-password"
            required
          />
          <PasswordField
            label="Nhập lại mật khẩu mới"
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </form>
      </Dialog>
    </div>
  );
}

export function PreferencesPage({ survey = false }: { survey?: boolean }) {
  const { data, mutate, busy } = usePlatform(),
    { base } = useWorkspace(),
    [selected, setSelected] = useState(data.preferences),
    [confirm, setConfirm] = useState<"submit" | "skip" | null>(null),
    [strength, setStrength] = useState("0.5");
  if (survey && data.surveyFinished)
    return (
      <div className="container workspace">
        <Card title="Khảo sát đã kết thúc">
          <p>
            Khảo sát ban đầu chỉ thực hiện một lần. Bạn vẫn có thể cập nhật khẩu
            vị.
          </p>
          <ActionLink href={`${base}/preferences`}>Cập nhật khẩu vị</ActionLink>
        </Card>
      </div>
    );
  return (
    <div className="container workspace stack">
      <PageHeading
        title={survey ? "Khảo sát ban đầu" : "Khẩu vị của bạn"}
        description={
          survey
            ? "Giúp ANGI hiểu sở thích ăn uống của bạn qua một khảo sát ngắn, chỉ thực hiện một lần."
            : "Chọn những hương vị bạn muốn khám phá."
        }
      />
      <Card
        className="soft"
        title="Bạn thường thích trải nghiệm món ăn theo cách nào?"
      >
        <div className="grid-3">
          {[
            "Món Việt",
            "Ít cay",
            "Ăn chay",
            "Món nước",
            "Món khô",
            "Đồ uống",
          ].map((label) => (
            <Choice
              key={label}
              label={label}
              checked={selected.includes(label)}
              onChange={(v) =>
                setSelected((s) =>
                  v ? [...s, label] : s.filter((x) => x !== label),
                )
              }
            />
          ))}
        </div>
        <Field
          label="Mức vị đậm đà"
          type="range"
          min={0}
          max={1}
          step={0.25}
          value={strength}
          onChange={(e) => setStrength(e.target.value)}
          helper={`Đang chọn ${strength} · Từ nhẹ đến đậm`}
        />
        {survey && (
          <Alert tone="warning">
            Gửi câu trả lời hoặc bỏ qua sẽ kết thúc khảo sát vĩnh viễn. Bạn sẽ
            không thể làm lại khảo sát này.
          </Alert>
        )}
        <div className="actions">
          <Button
            disabled={selected.length === 0}
            loading={busy}
            onClick={() =>
              survey
                ? setConfirm("submit")
                : void mutate((d) => {
                    d.preferences = selected;
                  })
            }
          >
            {survey ? "Gửi câu trả lời" : "Lưu khẩu vị"}
          </Button>
          {survey && (
            <Button variant="secondary" onClick={() => setConfirm("skip")}>
              Bỏ qua khảo sát
            </Button>
          )}
        </div>
      </Card>
      <ConfirmDialog
        open={!!confirm}
        title="Kết thúc khảo sát?"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await mutate((d) => {
            d.surveyFinished = true;
            if (confirm === "submit") d.preferences = selected;
          });
          setConfirm(null);
        }}
      >
        <p>Thao tác này kết thúc khảo sát ban đầu trong bản minh họa.</p>
      </ConfirmDialog>
    </div>
  );
}

export function NotificationsPage() {
  const { mutate } = usePlatform(),
    { user, base } = useWorkspace();
  // Map role workspace sang key nhóm trong mock (mặc định TRAVELER nếu GUEST)
  const roleKey: "TRAVELER" | "RESTAURANT_OWNER" | "MOD" | "ADMIN" =
    !user || user.role === "TRAVELER"
      ? "TRAVELER"
      : (user.role as Exclude<typeof user.role, "TRAVELER">);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<
    import("@/api/services/notification-service").NotificationItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  /** Số thông báo trên mỗi trang. */
  const PAGE_SIZE = 10;
  // Mọi request có id để bỏ qua response cũ khi user đổi tab nhanh.
  const requestIdRef = useRef(0);
  // Tải lần đầu + khi đổi tab.
  // Lưu ý: chỉ setState SAU await (react-hooks/set-state-in-effect),
  // `loading` được bật ở event handler khi đổi tab.
  useEffect(() => {
    const id = ++requestIdRef.current;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await notificationService.list({
          page: 1,
          pageSize: PAGE_SIZE,
          read: tab === "unread" ? false : undefined,
        });
        if (cancelled || id !== requestIdRef.current) return;
        setItems(res.items);
        setPage(1);
        setTotalPages(res.totalPages);
        setTotalItems(res.totalItems);
      } catch {
        if (cancelled || id !== requestIdRef.current) return;
        setItems([]);
        setTotalPages(1);
        setTotalItems(0);
      } finally {
        if (!cancelled && id === requestIdRef.current) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [tab, roleKey]);
  /** Đổi tab: bật loading ngay rồi để effect fetch nạp lại trang 1. */
  function changeTab(next: "all" | "unread") {
    if (next === tab) return;
    setLoading(true);
    setTab(next);
  }
  /** Chuyển trang (gọi từ event handler nên setState đồng bộ ở đây OK). */
  async function load(p: number) {
    const total = totalPages;
    if (p < 1 || p > total) return;
    const id = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = await notificationService.list({
        page: p,
        pageSize: PAGE_SIZE,
        read: tab === "unread" ? false : undefined,
      });
      if (id !== requestIdRef.current) return;
      setItems(res.items);
      setPage(p);
      setTotalPages(res.totalPages);
      setTotalItems(res.totalItems);
    } catch {
      if (id !== requestIdRef.current) return;
      setItems([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }
  const unread = items.filter((n) => !n.read).length;
  const canPrev = page > 1;
  const canNext = page < totalPages;
  async function markRead(ids: number[]) {
    if (ids.length === 0) return;
    setItems((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
    );
    try {
      await notificationService.markRead({ notificationIds: ids });
    } catch {
      // fallback mock — bỏ qua.
    }
  }
  async function markAllRead() {
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    await markRead(ids);
    void mutate((d) => {
      const myRole = roleKey;
      d.notices.forEach((n) => {
        if (n.role === myRole && (ids as unknown as string[]).includes(n.id))
          n.read = true;
      });
    }, "Đã đánh dấu thông báo đã đọc.");
  }
  return (
    <div className="container workspace notifications-page stack">
      <header className="notifications-head">
        <div>
          <h1>Thông báo</h1>
          <p>
            {unread > 0
              ? `${unread} thông báo chưa đọc`
              : "Bạn đã xem hết thông báo"}
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={unread === 0 || loading}
          onClick={() => void markAllRead()}
        >
          Đánh dấu tất cả đã đọc
        </Button>
      </header>

      <div className="notifications-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          className={`notifications-tab ${tab === "all" ? "is-active" : ""}`}
          onClick={() => changeTab("all")}
        >
          Tất cả
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "unread"}
          className={`notifications-tab ${tab === "unread" ? "is-active" : ""}`}
          onClick={() => changeTab("unread")}
        >
          Chưa đọc
        </button>
      </div>

      <ul className="notifications-list" role="list">
        {loading && (
          <li className="notifications-empty">Đang tải thông báo…</li>
        )}
        {!loading && items.length === 0 && (
          <li className="notifications-empty">
            {tab === "unread"
              ? "Bạn đã xem hết thông báo."
              : "Chưa có thông báo nào."}
          </li>
        )}
        {!loading &&
          items.map((n) => (
            <NotificationRow
              key={n.id}
              item={n}
              base={base}
              onMarkRead={() => void markRead([n.id])}
            />
          ))}
      </ul>

      {!loading && items.length > 0 && (
        <nav className="notifications-pagination" aria-label="Phân trang">
          <button
            type="button"
            onClick={() => void load(page - 1)}
            disabled={!canPrev}
          >
            ‹ Trang trước
          </button>
          <span className="page-info">
            Trang {page} / {totalPages}
            <span className="page-info-meta">
              {" "}· {totalItems} thông báo · mỗi trang {PAGE_SIZE}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void load(page + 1)}
            disabled={!canNext}
          >
            Trang sau ›
          </button>
        </nav>
      )}
    </div>
  );
}

function NotificationRow({
  item,
  base,
  onMarkRead,
}: {
  item: import("@/api/services/notification-service").NotificationItem;
  base: string;
  onMarkRead: () => void;
}) {
  const href = item.destination
    ? `${base}/${item.destination}`
    : `${base}/notifications`;
  // Nhãn + đích cho CTA chính tuỳ loại thông báo
  const ctaLabel = (() => {
    const dest = item.destination ?? "";
    if (dest.startsWith("roadmaps/")) return "Xem lịch ăn";
    if (dest.startsWith("reviews/")) return "Xem đánh giá";
    if (dest.startsWith("guides/")) return "Xem bài viết";
    if (dest.startsWith("verification")) return "Xem hồ sơ";
    if (dest.startsWith("menu")) return "Xem thực đơn";
    if (dest.startsWith("restaurants/")) return "Xem nhà hàng";
    return "Mở";
  })();
  return (
    <li className={`notifications-item ${item.read ? "is-read" : "is-unread"}`}>
      <div className="notifications-row">
        <Link href={href} className="notifications-link" onClick={onMarkRead}>
          <div className="notifications-inner">
            <div className="notifications-body">
              <span className="notifications-title">
                {!item.read && <span className="notifications-dot" aria-hidden />}
                {item.title}
              </span>
              <span className="notifications-text">{item.body}</span>
              <span className="notifications-meta">
                {relativeTimeLabel(item.createdAt)}
                <span aria-hidden> · </span>
                {dateLabel(item.createdAt)}
              </span>
            </div>
          </div>
        </Link>
        <div className="notifications-actions">
          <Link href={href} className="notifications-cta" onClick={onMarkRead}>
            {ctaLabel}
          </Link>
          {!item.read && (
            <button
              type="button"
              className="notifications-mark"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMarkRead();
              }}
            >
              Đánh dấu đã đọc
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
