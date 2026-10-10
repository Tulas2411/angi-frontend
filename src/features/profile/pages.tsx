"use client";
import { useState } from "react";
import { Alert, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  Choice,
  ConfirmDialog,
  Dialog,
  Field,
  Tabs,
  UploadField,
  Avatar,
  type UploadedFile,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";
import { dateLabel } from "@/features/platform/rules";

export function AccountPage({ profile = false }: { profile?: boolean }) {
  const { data, mutate, busy } = usePlatform(),
    { user, base } = useWorkspace(),
    [name, setName] = useState(
      profile ? data.profile.name : (user?.displayName ?? ""),
    ),
    [phone, setPhone] = useState(data.profile.phone),
    [bio, setBio] = useState(data.profile.bio ?? ""),
    [files, setFiles] = useState<UploadedFile[]>([]),
    [passwordOpen, setPasswordOpen] = useState(false),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState("");
  return (
    <div className={profile ? "container workspace stack" : "stack"}>
      <PageHeading
        title={profile ? "Hồ sơ của tôi" : "Tài khoản của bạn"}
        description="Cập nhật thông tin cá nhân và bảo vệ tài khoản của bạn."
      />
      <div className="split-content">
        <Card className="soft" title="Thông tin cá nhân">
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              await mutate((d) => {
                if (user?.role === "TRAVELER")
                  for (const blog of d.blogs) {
                    if (blog.author === user.displayName)
                      blog.author = name.trim();
                    for (const comment of blog.comments)
                      if (comment.author === user.displayName)
                        comment.author = name.trim();
                  }
                d.profile = {
                  name: name.trim(),
                  phone,
                  bio,
                  avatar: files[0]?.url ?? d.profile.avatar,
                };
              });
            }}
          >
            <Field
              label="Tên hiển thị"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={100}
              required
              helper="Từ 2 đến 100 ký tự."
            />
            <Field
              label="Email"
              value={user?.email ?? ""}
              readOnly
              helper="Email tài khoản · Chỉ xem"
            />
            <Field
              label="Số điện thoại"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
            />
            <UploadField
              label="Ảnh đại diện"
              files={files}
              onChange={setFiles}
            />
            <TextArea
              label="Giới thiệu"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              helper="Không bắt buộc."
            />
            <div className="actions">
              <Button type="submit" loading={busy}>
                Lưu hồ sơ
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setName(
                    profile ? data.profile.name : (user?.displayName ?? ""),
                  );
                  setPhone(data.profile.phone);
                  setBio(data.profile.bio ?? "");
                  setFiles([]);
                }}
              >
                Hủy thay đổi
              </Button>
            </div>
          </form>
        </Card>
        <div className="stack">
          <Card title="Tài khoản">
            <div className="actions">
              <Avatar
                name={name}
                image={files[0]?.url ?? data.profile.avatar}
              />
              <strong>{name}</strong>
            </div>
            <p className="helper">Đang hoạt động · Dữ liệu minh họa</p>
            <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
              Đổi mật khẩu
            </Button>
          </Card>
          {profile && (
            <Card title="Lịch trình ăn uống">
              <p>{data.trips.length} lịch ăn trong bản minh họa.</p>
              <ActionLink href={`${base}/roadmaps`} secondary>
                Xem lịch ăn của tôi
              </ActionLink>
            </Card>
          )}
        </div>
      </div>
      <Dialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Đổi mật khẩu"
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError(
              password !== confirm
                ? "Mật khẩu xác nhận chưa trùng khớp."
                : "Chưa có hợp đồng API đổi mật khẩu. Bản minh họa không thay mật khẩu tài khoản.",
            );
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
  const { data, mutate, busy } = usePlatform(),
    { user, base } = useWorkspace(),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<string[]>([]);
  const notices = data.notices.filter((n) => n.role === user?.role),
    unread = notices.filter((n) => !n.read).length,
    shown = notices.filter((n) => filter !== "unread" || !n.read);
  async function read(ids: string[]) {
    await mutate((d) => {
      d.notices.forEach((n) => {
        if (ids.includes(n.id)) n.read = true;
      });
    }, "Đã đánh dấu thông báo đã đọc.");
    setSelected([]);
  }
  return (
    <div
      className={
        user?.role === "TRAVELER" ? "container workspace stack" : "stack"
      }
    >
      <PageHeading
        title="Thông báo của bạn"
        description="Cập nhật mới nhất xuất hiện trước."
        action={
          <Button
            variant="secondary"
            disabled={!unread || busy}
            onClick={() => void read(notices.map((n) => n.id))}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />
      <div className="between">
        <span>{unread} chưa đọc</span>
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { value: "all", label: "Tất cả" },
            { value: "unread", label: "Chưa đọc" },
          ]}
        />
      </div>
      {selected.length > 0 && (
        <Button onClick={() => void read(selected)} disabled={busy}>
          Đánh dấu {selected.length} mục đã đọc
        </Button>
      )}
      <Card title="Thông báo mới nhất">
        {shown.map((n) => (
          <article className="review" key={n.id}>
            <div className="between">
              <Choice
                label={n.title}
                checked={selected.includes(n.id)}
                onChange={(v) =>
                  setSelected((s) =>
                    v ? [...s, n.id] : s.filter((x) => x !== n.id),
                  )
                }
              />
              {!n.read && <strong className="helper">● Chưa đọc</strong>}
            </div>
            <p>{n.body}</p>
            <p className="helper">{dateLabel(n.date)}</p>
            <div className="actions">
              {n.destination && (
                <ActionLink href={`${base}/${n.destination}`} secondary>
                  Xem nội dung liên quan
                </ActionLink>
              )}
              {!n.read && (
                <Button variant="tertiary" onClick={() => void read([n.id])}>
                  Đánh dấu đã đọc
                </Button>
              )}
              {!n.destination && (
                <span className="helper">Thông báo này chưa có điểm đến.</span>
              )}
            </div>
          </article>
        ))}
        {shown.length === 0 && <p>Không còn thông báo chưa đọc.</p>}
      </Card>
    </div>
  );
}
