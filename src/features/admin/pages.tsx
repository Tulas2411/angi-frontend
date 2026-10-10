"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  Choice,
  ConfirmDialog,
  DataTable,
  Dialog,
  Field,
  SelectField,
  Tabs,
} from "@/components/ui/primitives";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";
import {
  dateLabel,
  effectivePermission,
  retrySyncEvent,
  serializeOverrides,
  tripDates,
  validateDateRange,
} from "@/features/platform/rules";
import type { OverrideValue, Moderator } from "@/features/platform/contracts";

export function AdminDashboard() {
  const { base } = useWorkspace();
  const { data } = usePlatform(),
    [period, setPeriod] = useState("30"),
    [start, setStart] = useState("2026-09-09"),
    [end, setEnd] = useState("2026-10-08"),
    [applied, setApplied] = useState({ start, end }),
    [error, setError] = useState(""),
    [metric, setMetric] = useState("content"),
    [group, setGroup] = useState("day");
  const dates = tripDates(applied.start, applied.end),
    records =
      metric === "content"
        ? [
            ...data.blogs.map((b) => b.date),
            ...data.reviews.map((r) => r.date.slice(0, 10)),
          ]
        : data.audit.map((a) => a.date.slice(0, 10));
  const buckets =
    group === "day"
      ? dates.map((date) => ({
          date,
          count: records.filter((d) => d === date).length,
        }))
      : Array.from(
          { length: Math.ceil(dates.length / (group === "week" ? 7 : 30)) },
          (_, i) => {
            const days = dates.slice(
              i * (group === "week" ? 7 : 30),
              (i + 1) * (group === "week" ? 7 : 30),
            );
            return {
              date: days[0],
              count: records.filter((d) => days.includes(d)).length,
            };
          },
        );
  const maximum = Math.max(1, ...buckets.map((b) => b.count));
  const users = [
    {
      id: "traveler",
      role: "Thực khách",
      count: data.people.filter((p) => p.role === "TRAVELER").length,
    },
    {
      id: "owner",
      role: "Chủ nhà hàng",
      count: data.people.filter((p) => p.role === "RESTAURANT_OWNER").length,
    },
    { id: "mod", role: "Mod", count: data.moderators.length },
    { id: "admin", role: "Quản trị viên", count: 1 },
  ];
  return (
    <div className="stack">
      <PageHeading
        title="Tổng quan"
        description="Chào Hoài An. Theo dõi hoạt động và mở đúng hàng đợi cần xử lý."
      />
      <Card title="Trong kỳ đã chọn">
        <Tabs
          value={period}
          onChange={(v) => {
            setPeriod(v);
            if (v !== "custom") {
              const date = new Date("2026-10-08T00:00:00Z");
              date.setUTCDate(date.getUTCDate() - Number(v) + 1);
              setStart(date.toISOString().slice(0, 10));
              setEnd("2026-10-08");
            }
          }}
          items={[
            { value: "7", label: "7 ngày" },
            { value: "30", label: "30 ngày" },
            { value: "90", label: "90 ngày" },
            { value: "custom", label: "Tùy chọn" },
          ]}
        />
        <form
          className="grid-3"
          onSubmit={(e) => {
            e.preventDefault();
            const problem = validateDateRange(start, end);
            if (problem) {
              setError(problem);
              return;
            }
            if (tripDates(start, end).length > 366) {
              setError("Biểu đồ minh họa hỗ trợ tối đa 366 ngày.");
              return;
            }
            setApplied({ start, end });
            setError("");
          }}
        >
          <Field
            label="Từ ngày"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
          <Field
            label="Đến ngày"
            type="date"
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
          <Button type="submit">Áp dụng</Button>
        </form>
        {error && <Alert>{error}</Alert>}
        <p className="helper">
          Bộ lọc áp dụng số liệu trong kỳ và biểu đồ. Tổng hiện tại và hàng đợi
          được tính độc lập.
        </p>
        <div className="grid-3">
          <div>
            <span>Nội dung được tạo</span>
            <p className="stats-number">
              {
                [
                  ...data.blogs.map((b) => b.date),
                  ...data.reviews.map((r) => r.date.slice(0, 10)),
                ].filter((d) => dates.includes(d)).length
              }
            </p>
            <p className="helper">Bài viết và đánh giá minh họa trong kỳ</p>
          </div>
          <div>
            <span>Hoạt động hệ thống</span>
            <p className="stats-number">
              {
                data.audit.filter((a) => dates.includes(a.date.slice(0, 10)))
                  .length
              }
            </p>
            <p className="helper">Nhật ký được tạo trong kỳ</p>
          </div>
          <div>
            <span>Phản hồi món ăn</span>
            <p className="stats-number">
              {
                data.trips
                  .flatMap((t) =>
                    t.days.flatMap((day) =>
                      dates.includes(day.date) ? day.items : [],
                    ),
                  )
                  .filter((i) => i.feedback !== null).length
              }
            </p>
            <p className="helper">Thích / không thích trong kỳ</p>
          </div>
        </div>
      </Card>
      <div className="grid-2">
        <Card title="Người dùng hiện tại">
          <span>Tổng tài khoản minh họa</span>
          <strong className="stats-number">
            {users.reduce((sum, u) => sum + u.count, 0)}
          </strong>
          <DataTable
            caption="Theo vai trò"
            rows={users}
            columns={[
              { label: "Theo vai trò", render: (u) => u.role },
              { label: "Số lượng", render: (u) => u.count },
            ]}
          />
        </Card>
        <Card title="Nhà hàng hiện tại">
          <span>Tổng nhà hàng</span>
          <strong className="stats-number">{data.restaurants.length}</strong>
          <DataTable
            caption="Trạng thái xác minh"
            rows={["verified", "pending", "unverified", "rejected"].map(
              (id) => ({
                id,
                count: data.restaurants.filter((r) => r.verification === id)
                  .length,
              }),
            )}
            columns={[
              {
                label: "Xác minh",
                render: (r) =>
                  ({
                    verified: "Đã xác minh",
                    pending: "Chờ xác minh",
                    unverified: "Chưa xác minh",
                    rejected: "Bị từ chối",
                  })[r.id as "verified"],
              },
              { label: "Số lượng", render: (r) => r.count },
            ]}
          />
          <p className="helper">
            Kiểm duyệt:{" "}
            {data.restaurants.filter((r) => r.moderation === "visible").length}{" "}
            hiển thị ·{" "}
            {data.restaurants.filter((r) => r.moderation === "hidden").length}{" "}
            bị ẩn ·{" "}
            {
              data.restaurants.filter((r) => r.moderation === "suspended")
                .length
            }{" "}
            đình chỉ
          </p>
        </Card>
      </div>
      <Card title="Diễn biến trong kỳ">
        <div className="grid-2">
          <SelectField
            label="Chỉ số"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "content", label: "Nội dung mới" },
              { value: "audit", label: "Hoạt động hệ thống" },
            ]}
          />
          <Tabs
            value={group}
            onChange={setGroup}
            items={[
              { value: "day", label: "Ngày" },
              { value: "week", label: "Tuần" },
              { value: "month", label: "Tháng" },
            ]}
          />
        </div>
        <p className="helper">
          {dateLabel(applied.start)}–{dateLabel(applied.end)} · Bao gồm các ngày
          có giá trị 0
        </p>
        <div
          className="chart"
          role="img"
          aria-label={`Biểu đồ: ${buckets.map((b) => b.date + ": " + b.count).join(", ")}`}
        >
          {buckets.map((b) => (
            <div
              className="chart-column"
              key={b.date}
              title={`${b.date}: ${b.count}`}
            >
              <span>{b.count}</span>
              <div
                className="chart-bar"
                style={{ height: (170 * b.count) / maximum }}
              />
            </div>
          ))}
        </div>
        <div className="between helper">
          <span>{dateLabel(applied.start)}</span>
          <span>{dateLabel(applied.end)}</span>
        </div>
      </Card>
      <div className="grid-2">
        <Card title="Hàng đợi cần xử lý">
          <ActionLink href={`${base}/moderation/verification`} secondary>
            Xác minh ·{" "}
            {
              data.submissions.filter(
                (s) => s.kind === "verification" && s.status === "pending",
              ).length
            }{" "}
            hồ sơ
          </ActionLink>
          <ActionLink href={`${base}/moderation/reports`} secondary>
            Báo cáo ·{" "}
            {
              data.reports.filter(
                (r) => r.status === "open" || r.status === "claimed",
              ).length
            }{" "}
            đang mở
          </ActionLink>
        </Card>
        <Card title="Quán được đánh giá cao">
          <DataTable
            caption="Xếp hạng minh họa"
            rows={[...data.restaurants].sort((a, b) => b.rating - a.rating)}
            columns={[
              { label: "Nhà hàng", render: (r) => r.name },
              { label: "Điểm đánh giá", render: (r) => r.rating },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
function ModeratorForm({
  moderator,
  onClose,
}: {
  moderator?: Moderator;
  onClose: () => void;
}) {
  const { data, mutate, busy } = usePlatform(),
    [name, setName] = useState(moderator?.name ?? ""),
    [email, setEmail] = useState(moderator?.email ?? ""),
    [expanded, setExpanded] = useState(false),
    [overrides, setOverrides] = useState<Record<string, OverrideValue>>({}),
    [error, setError] = useState("");
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          !moderator &&
          data.moderators.some(
            (m) => m.email.toLowerCase() === email.trim().toLowerCase(),
          )
        ) {
          setError("Email đã có tài khoản Mod trong bản minh họa.");
          return;
        }
        await mutate(
          (d) => {
            if (moderator)
              d.moderators.find((m) => m.id === moderator.id)!.name =
                name.trim();
            else
              d.moderators.unshift({
                id: crypto.randomUUID(),
                name: name.trim(),
                email: email.trim(),
                active: true,
                created: "2026-10-09",
                lastLogin: null,
                invitation: "pending",
                overrides: serializeOverrides(overrides, d.permissions),
              });
          },
          moderator
            ? "Đã cập nhật tên hiển thị."
            : "Đã tạo Mod minh họa với lời mời thiết lập mật khẩu đang chờ. Không có email thực được gửi.",
        );
        onClose();
      }}
    >
      <Field
        label="Tên hiển thị"
        minLength={2}
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Field
        label="Email"
        type="email"
        maxLength={255}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        readOnly={!!moderator}
      />
      {!moderator && (
        <Alert tone="info">
          Mod tự thiết lập mật khẩu qua lời mời. Quản trị viên không đặt mật
          khẩu cho Mod.
        </Alert>
      )}
      {!moderator && (
        <>
          <Choice
            label="Ghi đè riêng (tùy chọn)"
            checked={expanded}
            onChange={setExpanded}
          />
          {expanded && (
            <div className="stack-sm">
              {data.permissions.map((p) => (
                <div className="permission-row" key={p.code}>
                  <div>
                    <strong>{p.label}</strong>
                    <p className="helper">{p.description}</p>
                  </div>
                  <SelectField
                    label={`Quyền riêng: ${p.label}`}
                    disabled={!p.grantable}
                    value={overrides[p.code] ?? "inherit"}
                    onChange={(value) =>
                      setOverrides((v) => ({
                        ...v,
                        [p.code]: value as OverrideValue,
                      }))
                    }
                    options={[
                      { value: "inherit", label: "Kế thừa" },
                      { value: "allow", label: "Cho phép" },
                      { value: "deny", label: "Từ chối" },
                    ]}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {error && <Alert>{error}</Alert>}
      <Button type="submit" loading={busy}>
        {moderator ? "Lưu tên hiển thị" : "Tạo Mod và lời mời minh họa"}
      </Button>
    </form>
  );
}
export function ModeratorDirectory({ id }: { id?: string }) {
  const { data, mutate } = usePlatform(),
    { base } = useWorkspace(),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1),
    [create, setCreate] = useState(false),
    [edit, setEdit] = useState<Moderator | null>(null),
    [activation, setActivation] = useState<Moderator | null>(null);
  const current = data.moderators.find((m) => m.id === id),
    rows = data.moderators.filter(
      (m) =>
        `${m.name} ${m.email}`
          .toLocaleLowerCase("vi")
          .includes(query.toLocaleLowerCase("vi")) &&
        (filter === "all" || (filter === "active") === m.active),
    );
  return (
    <div className="stack">
      <PageHeading
        title="Mod và phân quyền"
        description="Quản lý tài khoản Mod và quyền truy cập trong cùng một không gian."
        action={<Button onClick={() => setCreate(true)}>Thêm Mod</Button>}
      />
      <div className="actions">
        <ActionLink href={`${base}/moderators`} secondary>
          Danh sách Mod
        </ActionLink>
        <ActionLink href={`${base}/permissions`} secondary>
          Quyền mặc định Mod
        </ActionLink>
      </div>
      {current ? (
        <Card title={current.name}>
          <p>
            {current.email} · Mod ·{" "}
            {current.active ? "Đang hoạt động" : "Đã vô hiệu hóa"}
          </p>
          <p>Ngày tạo: {dateLabel(current.created)}</p>
          <p>
            Đăng nhập gần nhất:{" "}
            {current.lastLogin
              ? dateLabel(current.lastLogin)
              : "Chưa đăng nhập"}
          </p>
          <p>
            Lời mời:{" "}
            {current.invitation === "pending"
              ? "Đang chờ thiết lập mật khẩu"
              : "Đã thiết lập"}
          </p>
          <div className="actions">
            <Button variant="secondary" onClick={() => setEdit(current)}>
              Chỉnh sửa tên
            </Button>
            <Button variant="secondary" onClick={() => setActivation(current)}>
              {current.active ? "Vô hiệu hóa" : "Kích hoạt lại"}
            </Button>
            <ActionLink href={`${base}/moderators/${current.id}/permissions`}>
              Quyền truy cập
            </ActionLink>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid-2">
            <Field
              label="Tìm theo tên hoặc email"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            <SelectField
              label="Trạng thái"
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Tất cả" },
                { value: "active", label: "Đang hoạt động" },
                { value: "inactive", label: "Đã vô hiệu hóa" },
              ]}
            />
          </div>
          <Card title={`Danh sách Mod · ${rows.length} tài khoản`}>
            <DataTable
              rows={rows}
              page={page}
              onPage={setPage}
              caption="Danh sách Mod"
              columns={[
                {
                  label: "Tên hiển thị / Email",
                  render: (m) => (
                    <>
                      <strong>{m.name}</strong>
                      <p className="helper">{m.email}</p>
                    </>
                  ),
                },
                {
                  label: "Trạng thái",
                  render: (m) => (
                    <Badge>
                      {m.active ? "● Đang hoạt động" : "Đã vô hiệu hóa"}
                    </Badge>
                  ),
                },
                {
                  label: "Đăng nhập gần nhất",
                  render: (m) =>
                    m.lastLogin ? dateLabel(m.lastLogin) : "Chưa đăng nhập",
                },
                { label: "Ngày tạo", render: (m) => dateLabel(m.created) },
                {
                  label: "Thao tác",
                  render: (m) => (
                    <div className="stack-sm">
                      <ActionLink href={`${base}/moderators/${m.id}`} secondary>
                        Xem chi tiết →
                      </ActionLink>
                      <Button variant="tertiary" onClick={() => setEdit(m)}>
                        Chỉnh sửa tên
                      </Button>
                      <Button
                        variant="tertiary"
                        onClick={() => setActivation(m)}
                      >
                        {m.active ? "Vô hiệu hóa" : "Kích hoạt lại"}
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
      <p className="helper">
        Chỉ quản lý tài khoản Mod. Không đổi vai trò, không xóa tài khoản nhân
        sự.
      </p>
      <Dialog
        open={create || !!edit}
        onClose={() => {
          setCreate(false);
          setEdit(null);
        }}
        title={edit ? "Chỉnh sửa tên Mod" : "Thêm Mod"}
      >
        <ModeratorForm
          key={edit?.id ?? "create"}
          moderator={edit ?? undefined}
          onClose={() => {
            setCreate(false);
            setEdit(null);
          }}
        />
      </Dialog>
      <ConfirmDialog
        open={!!activation}
        title={
          activation?.active
            ? "Vô hiệu hóa tài khoản Mod?"
            : "Kích hoạt lại tài khoản Mod?"
        }
        onClose={() => setActivation(null)}
        destructive={activation?.active}
        onConfirm={async () => {
          await mutate((d) => {
            const m = d.moderators.find((m) => m.id === activation!.id)!;
            const before = m.active;
            m.active = !m.active;
            d.audit.unshift({
              id: crypto.randomUUID(),
              actor: "Hoài An",
              role: "Quản trị viên",
              action: m.active ? "Kích hoạt Mod" : "Vô hiệu hóa Mod",
              entity: "Tài khoản",
              entityId: m.id,
              related: m.name,
              date: "2026-10-09T12:00:00+07:00",
              before: { active: before },
              after: { active: m.active },
            });
          });
          setActivation(null);
        }}
      >
        <p>
          {activation?.name} · Trạng thái mới có hiệu lực trong bản minh họa.
        </p>
      </ConfirmDialog>
    </div>
  );
}
export function PermissionEditor({ id }: { id?: string }) {
  const { data, mutate, busy } = usePlatform(),
    current = data.moderators.find((m) => m.id === id),
    [values, setValues] = useState<Record<string, OverrideValue>>(() =>
      Object.fromEntries(
        data.permissions.map((p) => [
          p.code,
          current?.overrides.find((o) => o.permission === p.code)?.effect ??
            "inherit",
        ]),
      ),
    ),
    [defaults, setDefaults] = useState<Record<string, boolean>>(() =>
      Object.fromEntries(
        data.permissions.map((p) => [p.code, p.defaultAllowed]),
      ),
    ),
    [confirm, setConfirm] = useState(false);
  return (
    <div className="stack">
      <PageHeading
        title={
          id
            ? `Quyền truy cập · ${current?.name ?? "Mod không còn khả dụng"}`
            : "Quyền mặc định Mod"
        }
        description={
          id
            ? "Chọn Kế thừa để bỏ ghi đè riêng. Quyền hiệu lực là bản xem trước."
            : "Quyền kế thừa của Mod. Ghi đè riêng của từng người luôn được giữ."
        }
      />
      <Alert tone="info">
        Thay đổi có hiệu lực ở yêu cầu tiếp theo. Các trang dành riêng cho Quản
        trị viên không thể cấp cho Mod.
      </Alert>
      <Card title="Quyền và mô tả">
        <div className="table-scroll">
          <table className="permission-table">
            <caption className="sr-only">Chỉnh sửa quyền Mod</caption>
            <thead>
              <tr>
                <th>Quyền và mô tả</th>
                <th>Mặc định vai trò</th>
                <th>{id ? "Ghi đè riêng" : "Sau thay đổi"}</th>
                <th>Hiệu lực dự kiến · Chỉ xem</th>
              </tr>
            </thead>
            <tbody>
              {data.permissions.map((p) => (
                <tr key={p.code}>
                  <td>
                    <strong>{p.label}</strong>
                    <p>{p.description}</p>
                  </td>
                  <td>
                    {p.grantable
                      ? p.defaultAllowed
                        ? "Cho phép"
                        : "Chưa cho phép"
                      : "Chỉ Quản trị viên"}
                  </td>
                  <td>
                    {id ? (
                      <SelectField
                        label={`Ghi đè ${p.label}`}
                        value={values[p.code] ?? "inherit"}
                        disabled={!p.grantable}
                        onChange={(v) =>
                          setValues((s) => ({
                            ...s,
                            [p.code]: v as OverrideValue,
                          }))
                        }
                        options={[
                          { value: "inherit", label: "Kế thừa" },
                          { value: "allow", label: "Cho phép" },
                          { value: "deny", label: "Từ chối" },
                        ]}
                      />
                    ) : (
                      <Choice
                        label={`Cho phép ${p.label}`}
                        checked={p.grantable && defaults[p.code]}
                        disabled={!p.grantable}
                        onChange={(v) =>
                          setDefaults((s) => ({ ...s, [p.code]: v }))
                        }
                      />
                    )}
                  </td>
                  <td>
                    {p.grantable
                      ? (
                          id
                            ? effectivePermission(
                                p,
                                values[p.code] ?? "inherit",
                              )
                            : defaults[p.code]
                        )
                        ? "Cho phép"
                        : "Không có quyền"
                      : "Chỉ Quản trị viên"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <Button disabled={!!id && !current} onClick={() => setConfirm(true)}>
            Lưu quyền
          </Button>
          {id && (
            <Button
              variant="secondary"
              onClick={() =>
                setValues(
                  Object.fromEntries(
                    data.permissions.map((p) => [p.code, "inherit"]),
                  ),
                )
              }
            >
              Kế thừa tất cả
            </Button>
          )}
        </div>
      </Card>
      <ConfirmDialog
        open={confirm}
        title="Lưu thay đổi quyền?"
        loading={busy}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await mutate((d) => {
            if (id) {
              const m = d.moderators.find((m) => m.id === id)!;
              m.overrides = serializeOverrides(values, d.permissions);
            } else
              d.permissions.forEach((p) => {
                if (p.grantable) p.defaultAllowed = defaults[p.code];
              });
          }, "Đã lưu quyền trong bản minh họa. Danh sách ghi đè được thay thế toàn bộ.");
          setConfirm(false);
        }}
      >
        <p>
          {id
            ? "Lưu thay thế toàn bộ danh sách ghi đè. Danh sách rỗng nghĩa là kế thừa mặc định."
            : "Thay đổi quyền kế thừa của tất cả Mod. Ghi đè riêng vẫn được giữ."}
        </p>
        <p className="helper">
          {id
            ? serializeOverrides(values, data.permissions).length +
              " quyền ghi đè sẽ được gửi trong hợp đồng minh họa."
            : "Quyền Quản trị viên giữ chế độ chỉ xem."}
        </p>
      </ConfirmDialog>
    </div>
  );
}
export function AuditPage() {
  const { data } = usePlatform(),
    [query, setQuery] = useState(""),
    [action, setAction] = useState("all"),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null);
  const rows = data.audit.filter(
      (a) =>
        `${a.actor} ${a.entityId} ${a.related}`
          .toLocaleLowerCase("vi")
          .includes(query.toLocaleLowerCase("vi")) &&
        (action === "all" || a.action === action),
    ),
    event = data.audit.find((a) => a.id === selected);
  return (
    <div className="stack">
      <PageHeading
        title="Nhật ký hệ thống"
        description="Tra cứu hoạt động quản trị và kiểm duyệt. Nhật ký chỉ xem, không chỉnh sửa hoặc hoàn tác."
      />
      <Card title="Bộ lọc hoạt động">
        <div className="grid-2">
          <Field
            label="Người thực hiện hoặc mã đối tượng"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <SelectField
            label="Hành động"
            value={action}
            onChange={(v) => {
              setAction(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Tất cả" },
              ...Array.from(new Set(data.audit.map((a) => a.action))).map(
                (v) => ({ value: v, label: v }),
              ),
            ]}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setQuery("");
            setAction("all");
            setPage(1);
          }}
        >
          Xóa bộ lọc
        </Button>
      </Card>
      <Card title="Hoạt động hệ thống">
        <DataTable
          rows={rows}
          page={page}
          onPage={setPage}
          caption="Nhật ký hệ thống chỉ xem"
          columns={[
            { label: "Thời điểm", render: (a) => dateLabel(a.date) },
            {
              label: "Người thực hiện / Vai trò",
              render: (a) => (
                <>
                  {a.actor}
                  <p className="helper">{a.role}</p>
                </>
              ),
            },
            { label: "Hành động", render: (a) => a.action },
            {
              label: "Loại / Mã đối tượng",
              render: (a) => (
                <>
                  {a.entity}
                  <p className="helper">{a.entityId}</p>
                </>
              ),
            },
            { label: "Người liên quan", render: (a) => a.related },
            {
              label: "Chi tiết",
              render: (a) => (
                <Button variant="tertiary" onClick={() => setSelected(a.id)}>
                  Xem chi tiết →
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Dialog
        open={!!event}
        onClose={() => setSelected(null)}
        title="Chi tiết hoạt động"
        drawer
      >
        {event && (
          <div className="stack">
            <p>{event.action}</p>
            <p>
              {event.actor} · {event.role} · {dateLabel(event.date)}
            </p>
            <Field
              label="Loại và mã đối tượng"
              value={`${event.entity} · ${event.entityId}`}
              readOnly
            />
            <Field label="Người liên quan" value={event.related} readOnly />
            <p>{event.reason}</p>
            <h3>Trước thay đổi</h3>
            <pre className="code-block">
              {JSON.stringify(event.before, null, 2)}
            </pre>
            <h3>Sau thay đổi</h3>
            <pre className="code-block">
              {JSON.stringify(event.after, null, 2)}
            </pre>
            <Alert tone="info">
              Dữ liệu chỉ xem. Không có thao tác hoàn tác nhật ký.
            </Alert>
          </div>
        )}
      </Dialog>
    </div>
  );
}
export function SyncPage() {
  const { data, mutate, busy } = usePlatform(),
    [status, setStatus] = useState("dead"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [retry, setRetry] = useState<string | null>(null),
    [page, setPage] = useState(1);
  const rows = data.sync.filter(
      (s) =>
        (status === "all" || s.status === status) &&
        `${s.type} ${s.entityId} ${s.id}`
          .toLocaleLowerCase("vi")
          .includes(query.toLocaleLowerCase("vi")),
    ),
    event = data.sync.find((s) => s.id === selected);
  const labels = {
    dead: "Lỗi cần thử lại",
    pending: "Đang chờ",
    processing: "Đang xử lý",
    completed: "Đã đồng bộ",
  };
  return (
    <div className="stack">
      <PageHeading
        title="Đồng bộ dữ liệu"
        description="Xem sự kiện đang chờ đồng bộ. Chỉ thử lại từng sự kiện đang lỗi."
      />
      <Tabs
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        items={[
          { value: "dead", label: "Lỗi cần thử lại" },
          { value: "pending", label: "Đang chờ" },
          { value: "completed", label: "Đã đồng bộ" },
          { value: "all", label: "Tất cả" },
        ]}
      />
      <Field
        label="Loại sự kiện hoặc mã đối tượng"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
      />
      <Card title="Sự kiện đồng bộ">
        <DataTable
          caption="Sự kiện đồng bộ"
          rows={rows}
          page={page}
          onPage={setPage}
          columns={[
            {
              label: "Loại / Đối tượng",
              render: (s) => (
                <>
                  {s.type}
                  <p className="helper">{s.entityId}</p>
                </>
              ),
            },
            {
              label: "Trạng thái",
              render: (s) => <Badge>{labels[s.status]}</Badge>,
            },
            { label: "Số lần thử", render: (s) => s.attempts },
            { label: "Ngày tạo", render: (s) => dateLabel(s.date) },
            {
              label: "Lần thử tiếp",
              render: (s) =>
                s.nextAttempt ? dateLabel(s.nextAttempt) : "Không có",
            },
            { label: "Lỗi gần nhất", render: (s) => s.error ?? "Không có" },
            {
              label: "Thao tác",
              render: (s) => (
                <div className="actions">
                  <Button variant="tertiary" onClick={() => setSelected(s.id)}>
                    Xem
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={s.status !== "dead"}
                    onClick={() => setRetry(s.id)}
                  >
                    Thử lại
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Dialog
        open={!!event}
        onClose={() => setSelected(null)}
        title="Chi tiết sự kiện"
        drawer
      >
        {event && (
          <div className="stack">
            <p>
              {event.id} · {event.entityId} · {event.type}
            </p>
            <Badge>{labels[event.status]}</Badge>
            <p>{event.attempts} lần thử</p>
            <pre className="code-block">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
            <p>{event.error}</p>
            <Button
              disabled={event.status !== "dead"}
              onClick={() => setRetry(event.id)}
            >
              Thử lại sự kiện này
            </Button>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={!!retry}
        title="Đưa sự kiện vào hàng đợi thử lại?"
        loading={busy}
        label="Đưa vào hàng đợi"
        onClose={() => setRetry(null)}
        onConfirm={async () => {
          await mutate((d) => {
            const i = d.sync.findIndex((s) => s.id === retry);
            d.sync[i] = retrySyncEvent(d.sync[i]);
          }, "Đã đưa sự kiện vào hàng đợi đang chờ. Chưa hoàn tất đồng bộ.");
          setRetry(null);
        }}
      >
        <p>
          Chỉ sự kiện {retry} được thử lại. Thành công ở bước này nghĩa là
          chuyển sang đang chờ, chưa phải đã đồng bộ.
        </p>
      </ConfirmDialog>
    </div>
  );
}
