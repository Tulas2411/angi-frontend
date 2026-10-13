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
  Media,
  SelectField,
  Tabs,
  TextArea,
} from "@/components/ui/primitives";
import {
  RestaurantStatuses,
  ReviewContent,
  submissionLabels,
  visibilityLabels,
} from "@/components/domain/cards";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";
import {
  dateLabel,
  effectivePermission,
  money,
} from "@/features/platform/rules";
import type { AppData } from "@/features/platform/contracts";

function usePermission() {
  const { data } = usePlatform(),
    { user } = useWorkspace();
  return (code: string) => {
    if (user?.role === "ADMIN") return true;
    const p = data.permissions.find((p) => p.code === code),
      mod = data.moderators.find((m) => m.email === user?.email);
    return (
      !!p &&
      !!mod &&
      mod.active &&
      effectivePermission(
        p,
        mod.overrides.find((o) => o.permission === code)?.effect ?? "inherit",
      )
    );
  };
}
interface Decision {
  title: string;
  target: string;
  required?: boolean;
  destructive?: boolean;
  untilRequired?: boolean;
  update: (data: AppData, reason: string, until: string) => void;
}
function DecisionDialog({
  decision,
  onClose,
}: {
  decision: Decision | null;
  onClose: () => void;
}) {
  const { mutate, busy } = usePlatform(),
    { user } = useWorkspace(),
    [reason, setReason] = useState(""),
    [until, setUntil] = useState("2026-10-10T18:00"),
    [error, setError] = useState("");
  return (
    <Dialog
      open={!!decision}
      onClose={onClose}
      title={decision?.title ?? "Quyết định"}
    >
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (decision?.required !== false && !reason.trim()) {
            setError("Nhập lý do từ 1 đến 1.000 ký tự.");
            return;
          }
          if (
            decision?.untilRequired &&
            new Date(until + "+07:00") <= new Date("2026-10-09T00:00:00+07:00")
          ) {
            setError("Chọn thời gian đình chỉ trong tương lai.");
            return;
          }
          await mutate((d) => {
            decision!.update(d, reason.trim(), until);
            d.audit.unshift({
              id: crypto.randomUUID(),
              actor: user?.displayName ?? "Hoài An",
              role: user?.role === "ADMIN" ? "Quản trị viên" : "Mod",
              action: decision!.title,
              entity: "Kiểm duyệt",
              entityId: decision!.target,
              related: decision!.target,
              date: "2026-10-09T12:00:00+07:00",
              before: {},
              after: { decision: decision!.title },
              reason,
            });
          }, "Đã lưu quyết định kiểm duyệt minh họa.");
          onClose();
          setReason("");
          setError("");
        }}
      >
        <p>Đối tượng: {decision?.target}</p>
        <TextArea
          label="Lý do / ghi chú"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          required={decision?.required !== false}
          error={error}
        />
        {decision?.untilRequired && (
          <Field
            label="Đình chỉ đến (giờ Việt Nam)"
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            required
          />
        )}
        <div className="actions">
          <Button
            type="submit"
            variant={decision?.destructive ? "destructive" : "primary"}
            loading={busy}
          >
            Xác nhận quyết định
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function ModerationOverview() {
  const { data } = usePlatform(),
    { base } = useWorkspace(),
    allowed = usePermission();
  const queues = [
    {
      id: "verification",
      title: "Xác minh nhà hàng",
      count: data.submissions.filter(
        (s) => s.kind === "verification" && s.status === "pending",
      ).length,
      permission: "restaurant.verify",
    },
    {
      id: "menus",
      title: "Duyệt thực đơn",
      count: data.submissions.filter(
        (s) => s.kind === "menu" && s.status === "pending",
      ).length,
      permission: "menu.review",
    },
    {
      id: "reports",
      title: "Báo cáo vi phạm",
      count: data.reports.filter(
        (r) => r.status === "open" || r.status === "claimed",
      ).length,
      permission: "report.restaurant",
    },
  ].filter((q) => allowed(q.permission));
  const rows = [
    ...data.submissions
      .filter(
        (s) =>
          s.status === "pending" &&
          (s.kind === "verification"
            ? allowed("restaurant.verify")
            : allowed("menu.review")),
      )
      .map((s) => ({
        id: s.id,
        title: s.kind === "verification" ? "Xác minh" : "Thực đơn",
        target: "Bếp Nhà",
        status: "Chờ duyệt",
        date: s.date,
        href: `${base}/${s.kind === "verification" ? "verification" : "menus"}/bep-nha`,
      })),
    ...data.reports
      .filter((r) => r.status === "open" || r.status === "claimed")
      .map((r) => ({
        id: r.id,
        title:
          r.target === "restaurant" ? "Báo cáo nhà hàng" : "Báo cáo bài viết",
        target: r.target === "restaurant" ? "Bếp Nhà" : "Ăn ngon quanh phố cổ",
        status: r.status === "open" ? "Chưa nhận xử lý" : "Đang xử lý",
        date: r.date,
        href: `${base}/reports/${r.id}`,
      })),
  ];
  return (
    <div className="stack">
      <PageHeading
        title="Công việc kiểm duyệt"
        description="Chào Hoài An. Xem đúng ngữ cảnh, cân nhắc từng quyết định."
      />
      <Alert tone="warning">
        Ưu tiên hồ sơ đã chờ lâu. Chỉ những công việc bạn được phép truy cập mới
        xuất hiện trong không gian này.
      </Alert>
      <div className="grid-3">
        {queues.map((q) => (
          <Card className="elevated" title={q.title} key={q.id}>
            <strong className="stats-number">{q.count} đang chờ</strong>
            <p className="helper">Dữ liệu minh họa · Các hàng đợi độc lập</p>
            <ActionLink href={`${base}/${q.id}`}>Mở hàng đợi</ActionLink>
          </Card>
        ))}
      </div>
      <Card title="Tiếp tục trong đúng ngữ cảnh">
        <DataTable
          caption="Hàng đợi công việc"
          rows={rows}
          columns={[
            { label: "Công việc", render: (r) => r.title },
            { label: "Đối tượng", render: (r) => r.target },
            { label: "Trạng thái", render: (r) => r.status },
            { label: "Thời điểm", render: (r) => dateLabel(r.date) },
            {
              label: "Mở",
              render: (r) => (
                <ActionLink href={r.href} secondary>
                  Xem →
                </ActionLink>
              ),
            },
          ]}
        />
      </Card>
      <div className="grid-2">
        <Card title="Người dùng & nhà hàng">
          <p>
            Tra cứu trạng thái, lịch sử xử lý và thông tin liên quan trước khi
            hạn chế tài khoản.
          </p>
          <ActionLink href={`${base}/users`} secondary>
            Tra cứu người dùng
          </ActionLink>
        </Card>
        <Card title="Nội dung cộng đồng">
          <p>Bài viết, bình luận và đánh giá có thao tác riêng.</p>
          <ActionLink href={`${base}/community`} secondary>
            Mở nội dung cộng đồng
          </ActionLink>
        </Card>
      </div>
    </div>
  );
}
export function ModerationUsers({ id }: { id?: string }) {
  const { data } = usePlatform(),
    { base } = useWorkspace(),
    allowed = usePermission(),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [role, setRole] = useState("all"),
    [page, setPage] = useState(1),
    [decision, setDecision] = useState<Decision | null>(null);
  const person = data.people.find((p) => p.id === id),
    rows = data.people.filter(
      (p) =>
        `${p.name} ${p.email}`
          .toLocaleLowerCase("vi")
          .includes(query.toLocaleLowerCase("vi")) &&
        (status === "all" || p.status === status) &&
        (role === "all" || p.role === role),
    );
  const labels = {
    active: "Đang hoạt động",
    suspended: "Tạm đình chỉ",
    banned: "Bị cấm",
    pending_verification: "Chờ xác minh",
  };
  function sanction(
    action: "warn" | "suspend" | "ban" | "restore",
    title: string,
  ) {
    setDecision({
      title,
      target: person!.id,
      destructive: action !== "restore",
      untilRequired: action === "suspend",
      update: (d, reason, until) => {
        const p = d.people.find((p) => p.id === id)!;
        if (action === "suspend") {
          p.status = "suspended";
          p.suspendedUntil = until + "+07:00";
        }
        if (action === "ban") p.status = "banned";
        if (action === "restore") {
          p.status = "active";
          p.suspendedUntil = undefined;
        }
        p.history.unshift({
          action: title,
          reason,
          date: "2026-10-09",
          actor: "Hoài An",
        });
      },
    });
  }
  return (
    <div className="stack">
      <PageHeading
        title={person ? `Hồ sơ ${person.name}` : "Người dùng"}
        description="Tra cứu thực khách và chủ nhà hàng. Không có tài khoản nhân sự trong danh sách này."
      />
      {person ? (
        <>
          <Card title="Thông tin chỉ xem">
            <p>
              {person.name} · {person.email}
            </p>
            <Badge>{labels[person.status]}</Badge>
            {person.suspendedUntil && (
              <p>Đình chỉ đến {dateLabel(person.suspendedUntil)}</p>
            )}
            <div className="actions">
              {allowed("user.sanction") && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => sanction("warn", "Cảnh báo người dùng")}
                  >
                    Cảnh báo
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={person.status === "banned"}
                    onClick={() =>
                      sanction("suspend", "Tạm đình chỉ người dùng")
                    }
                  >
                    Tạm đình chỉ
                  </Button>
                </>
              )}
              {allowed("user.ban") && (
                <>
                  <Button
                    variant="destructive"
                    disabled={person.status === "banned"}
                    onClick={() => sanction("ban", "Cấm tài khoản")}
                  >
                    Cấm tài khoản
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={
                      person.status !== "banned" &&
                      person.status !== "suspended"
                    }
                    onClick={() => sanction("restore", "Gỡ hạn chế")}
                  >
                    Gỡ hạn chế
                  </Button>
                </>
              )}
            </div>
          </Card>
          <Card title="Lịch sử hạn chế">
            <DataTable
              caption="Lịch sử hạn chế"
              rows={person.history.map((h, i) => ({ ...h, id: String(i) }))}
              columns={[
                { label: "Hạn chế", render: (h) => h.action },
                { label: "Lý do", render: (h) => h.reason },
                { label: "Người ban hành", render: (h) => h.actor },
                { label: "Thời điểm", render: (h) => dateLabel(h.date) },
              ]}
            />
          </Card>
          {allowed("user.audit") ? (
            <Card title="Nhật ký liên quan">
              <DataTable
                rows={data.audit.filter((a) => a.entityId === person.id)}
                caption="Nhật ký người dùng"
                columns={[
                  { label: "Người thực hiện", render: (a) => a.actor },
                  { label: "Hành động", render: (a) => a.action },
                  { label: "Thời điểm", render: (a) => dateLabel(a.date) },
                ]}
              />
            </Card>
          ) : (
            <Alert tone="info">Bạn chưa có quyền xem nhật ký người dùng.</Alert>
          )}
        </>
      ) : (
        <>
          <div className="grid-3">
            <Field
              label="Tìm tên hoặc email"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            <SelectField
              label="Vai trò"
              value={role}
              onChange={(v) => {
                setRole(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Mọi vai trò" },
                { value: "TRAVELER", label: "Thực khách" },
                { value: "RESTAURANT_OWNER", label: "Chủ nhà hàng" },
              ]}
            />
            <SelectField
              label="Trạng thái"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Mọi trạng thái" },
                ...Object.entries(labels).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
            />
          </div>
          <Card title="Kết quả tra cứu">
            <DataTable
              rows={rows}
              page={page}
              onPage={setPage}
              caption="Người dùng"
              columns={[
                {
                  label: "Người dùng / Email",
                  render: (p) => (
                    <>
                      {p.name}
                      <p className="helper">{p.email}</p>
                    </>
                  ),
                },
                {
                  label: "Vai trò",
                  render: (p) =>
                    p.role === "TRAVELER" ? "Thực khách" : "Chủ nhà hàng",
                },
                {
                  label: "Trạng thái",
                  render: (p) => <Badge>{labels[p.status]}</Badge>,
                },
                {
                  label: "Chi tiết",
                  render: (p) => (
                    <ActionLink href={`${base}/users/${p.id}`} secondary>
                      Xem →
                    </ActionLink>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
      <DecisionDialog decision={decision} onClose={() => setDecision(null)} />
    </div>
  );
}
export function ModerationRestaurants({ id }: { id?: string }) {
  const { data } = usePlatform(),
    { base } = useWorkspace(),
    allowed = usePermission(),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [decision, setDecision] = useState<Decision | null>(null),
    [tab, setTab] = useState("information"),
    restaurant = data.restaurants.find((r) => r.id === id);
  const rows = data.restaurants.filter((r) =>
    `${r.name} ${r.address}`
      .toLocaleLowerCase("vi")
      .includes(query.toLocaleLowerCase("vi")),
  );
  return (
    <div className="stack">
      <PageHeading
        title={restaurant?.name ?? "Nhà hàng"}
        description="Kiểm duyệt không thay đổi giờ mở cửa hoặc kết quả xác minh."
      />
      {restaurant ? (
        <>
          <RestaurantStatuses restaurant={restaurant} />
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "information", label: "Thông tin nhà hàng" },
              { value: "menu", label: "Thực đơn" },
              { value: "owner", label: "Chủ nhà hàng" },
            ]}
          />
          {tab === "information" ? (
            <Card title="Thông tin nhà hàng · Chỉ xem">
              <p>{restaurant.address}</p>
              <p>{restaurant.description}</p>
              <p>
                {restaurant.phone} · {restaurant.email}
              </p>
              <p>
                {restaurant.rating} / 5 · Tọa độ {restaurant.latitude} /{" "}
                {restaurant.longitude}
              </p>
              {allowed("restaurant.moderate") && (
                <div className="actions">
                  {(["hidden", "suspended", "visible"] as const).map(
                    (status) => (
                      <Button
                        variant={
                          status === "visible" ? "secondary" : "destructive"
                        }
                        disabled={restaurant.moderation === status}
                        key={status}
                        onClick={() =>
                          setDecision({
                            title:
                              status === "visible"
                                ? "Hiển thị lại nhà hàng"
                                : status === "hidden"
                                  ? "Ẩn nhà hàng"
                                  : "Đình chỉ nhà hàng",
                            target: restaurant.id,
                            destructive: status !== "visible",
                            update: (d) => {
                              d.restaurants.find(
                                (r) => r.id === id,
                              )!.moderation = status;
                            },
                          })
                        }
                      >
                        {status === "visible"
                          ? "Hiển thị lại"
                          : status === "hidden"
                            ? "Ẩn nhà hàng"
                            : "Đình chỉ nhà hàng"}
                      </Button>
                    ),
                  )}
                </div>
              )}
            </Card>
          ) : tab === "owner" ? (
            <Card title="Chủ nhà hàng · Chỉ xem">
              {id === "bep-nha" ? (
                <>
                  <p>Mai Linh · linh@bepnha.example</p>
                  <ActionLink href={`${base}/users/user-3`} secondary>
                    Xem hồ sơ chủ nhà hàng
                  </ActionLink>
                </>
              ) : (
                <Alert tone="info">
                  Thông tin chủ nhà hàng chưa khả dụng trong ngữ cảnh này.
                </Alert>
              )}
            </Card>
          ) : (
            <Card title="Thực đơn · Gồm món bị ẩn">
              {data.dishes
                .filter((d) => d.restaurantId === id)
                .map((dish) => (
                  <div className="menu-row" key={dish.id}>
                    <div className="description">
                      <strong>{dish.name}</strong>
                      <p>
                        {money(dish.price)} ·{" "}
                        {dish.serving ? "Đang phục vụ" : "Tạm hết món"}
                      </p>
                      <p className="helper">
                        Không có mô tả / bộ ảnh cũ trong hợp đồng đọc kiểm
                        duyệt.
                      </p>
                    </div>
                    <Badge>{visibilityLabels[dish.moderation]}</Badge>
                    {allowed("restaurant.moderate") && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setDecision({
                            title:
                              dish.moderation === "visible"
                                ? "Ẩn món"
                                : "Hiển thị lại món",
                            target: dish.id,
                            destructive: dish.moderation === "visible",
                            update: (d) => {
                              const target = d.dishes.find(
                                (x) => x.id === dish.id,
                              )!;
                              target.moderation =
                                target.moderation === "visible"
                                  ? "hidden"
                                  : "visible";
                            },
                          })
                        }
                      >
                        {dish.moderation === "visible"
                          ? "Ẩn món"
                          : "Hiển thị lại"}
                      </Button>
                    )}
                  </div>
                ))}
            </Card>
          )}
        </>
      ) : (
        <>
          <Field
            label="Tìm nhà hàng"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <Card title="Nhà hàng">
            <DataTable
              rows={rows}
              page={page}
              onPage={setPage}
              caption="Danh sách nhà hàng"
              columns={[
                {
                  label: "Nhà hàng",
                  render: (r) => (
                    <>
                      {r.name}
                      <p className="helper">{r.address}</p>
                    </>
                  ),
                },
                {
                  label: "Xác minh",
                  render: (r) =>
                    r.verification === "verified"
                      ? "Đã xác minh"
                      : "Chưa xác minh",
                },
                {
                  label: "Hoạt động",
                  render: (r) =>
                    r.operating === "open" ? "Đang mở" : "Đang đóng",
                },
                {
                  label: "Kiểm duyệt",
                  render: (r) => visibilityLabels[r.moderation],
                },
                {
                  label: "Mở",
                  render: (r) => (
                    <ActionLink href={`${base}/restaurants/${r.id}`} secondary>
                      Xem →
                    </ActionLink>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
      <DecisionDialog decision={decision} onClose={() => setDecision(null)} />
    </div>
  );
}
export function SubmissionQueue({
  kind,
  id,
}: {
  kind: "verification" | "menu";
  id?: string;
}) {
  const { data } = usePlatform(),
    { base } = useWorkspace(),
    allowed = usePermission(),
    [filter, setFilter] = useState("pending"),
    [page, setPage] = useState(1),
    [decision, setDecision] = useState<Decision | null>(null),
    [document, setDocument] = useState(0);
  const records = data.submissions.filter(
      (s) => s.kind === kind && (filter === "all" || s.status === filter),
    ),
    submission = id
      ? data.submissions.find((s) => s.kind === kind && s.restaurantId === id)
      : undefined,
    canDecide =
      allowed(kind === "menu" ? "menu.review" : "restaurant.verify") &&
      submission?.status === "pending";
  function decide(status: "approved" | "rejected" | "needs_changes") {
    setDecision({
      title:
        (status === "approved"
          ? "Phê duyệt "
          : status === "rejected"
            ? "Từ chối "
            : "Yêu cầu bổ sung ") + (kind === "menu" ? "thực đơn" : "xác minh"),
      target: submission!.id,
      required: status !== "approved",
      destructive: status === "rejected",
      update: (d, note) => {
        const s = d.submissions.find((s) => s.id === submission!.id)!;
        if (s.status !== "pending")
          throw new Error("Hồ sơ không còn chờ duyệt.");
        s.status = status;
        s.note = note;
        if (kind === "menu" && status === "approved")
          d.dishes = [
            ...d.dishes.filter((dish) => dish.restaurantId !== s.restaurantId),
            ...structuredClone(d.menuDraft),
          ];
        if (kind === "verification")
          d.restaurants.find((r) => r.id === id)!.verification =
            status === "approved" ? "verified" : status;
      },
    });
  }
  return (
    <div className="stack">
      <PageHeading
        title={
          submission
            ? kind === "menu"
              ? "Đối chiếu thực đơn Bếp Nhà"
              : "Hồ sơ xác minh Bếp Nhà"
            : kind === "menu"
              ? "Duyệt thực đơn"
              : "Xác minh nhà hàng"
        }
        description="Đối chiếu toàn bộ thông tin trước khi quyết định. Nội dung do chủ nhà hàng cung cấp chỉ xem."
      />
      {submission ? (
        <>
          <Badge>{submissionLabels[submission.status]}</Badge>
          <Card title="Ghi chú của chủ nhà hàng">
            <p>{submission.note || "Không có ghi chú."}</p>
          </Card>
          {kind === "verification" ? (
            <>
              <Card title="Thông tin pháp lý">
                <Field
                  label="Tên pháp lý"
                  value={submission.legalName ?? ""}
                  readOnly
                />
                <Field
                  label="Số giấy phép kinh doanh"
                  value={submission.license ?? ""}
                  readOnly
                />
                <Field
                  label="Mã số thuế"
                  value={submission.taxCode ?? ""}
                  readOnly
                />
              </Card>
              <Card title="Tài liệu đính kèm">
                <div className="tabs">
                  {submission.documents?.map((doc, i) => (
                    <Button
                      variant="secondary"
                      key={doc.name}
                      onClick={() => setDocument(i)}
                    >
                      {doc.type}
                    </Button>
                  ))}
                </div>
                <div className="empty-state">
                  <h3>
                    {submission.documents?.[document]?.type ??
                      "Chưa có tài liệu"}
                  </h3>
                  <strong>
                    BẢN XEM MINH HỌA · KHÔNG PHẢI TÀI LIỆU PHÁP LÝ
                  </strong>
                  <p>
                    Hộ kinh doanh Bếp Nhà · 24 Nguyễn Hữu Huân, Hoàn Kiếm, Hà
                    Nội
                  </p>
                </div>
                <Alert tone="info">
                  Tài liệu thực cần liên kết riêng tư có thời hạn. Chưa có dịch
                  vụ đọc tài liệu trong repository.
                </Alert>
              </Card>
            </>
          ) : (
            <>
              <Card title="Đối chiếu bản thực đơn">
                {data.menuDraft.map((dish, index) => {
                  const old = data.dishes.find((d) => d.id === dish.id);
                  return (
                    <div className="stack" key={dish.id}>
                      <h3>
                        {old
                          ? old.price !== dish.price
                            ? "Món chỉnh sửa"
                            : "Món không đổi"
                          : "Món mới"}{" "}
                        · {dish.name}
                      </h3>
                      <div className="grid-2">
                        <Card
                          className="control"
                          title="Trước · Thực đơn hiện tại"
                        >
                          <p>
                            {old
                              ? `${old.name} · ${money(old.price)}`
                              : "Không có món trước."}
                          </p>
                          <p className="helper">
                            Không có mô tả cũ hoặc thứ tự cũ trong dữ liệu đối
                            chiếu.
                          </p>
                        </Card>
                        <Card className="control" title="Sau · Bản gửi duyệt">
                          <Media src={dish.image} alt={dish.name} />
                          <p>
                            {dish.name} · {money(dish.price)}
                          </p>
                          <p>{dish.description}</p>
                          <p className="helper">
                            {dish.tags.join(" · ")} · Thứ tự đề xuất {index + 1}
                          </p>
                        </Card>
                      </div>
                    </div>
                  );
                })}
              </Card>
              {data.dishes
                .filter((d) => !data.menuDraft.some((x) => x.id === d.id))
                .map((d) => (
                  <Alert tone="warning" key={d.id}>
                    Món sẽ bị gỡ: {d.name} · {money(d.price)}. Món chỉ bị bỏ sau
                    khi duyệt.
                  </Alert>
                ))}
            </>
          )}
          {canDecide ? (
            <div className="actions">
              <Button onClick={() => decide("approved")}>Phê duyệt</Button>
              {kind === "verification" && (
                <Button
                  variant="secondary"
                  onClick={() => decide("needs_changes")}
                >
                  Yêu cầu bổ sung hồ sơ
                </Button>
              )}
              <Button variant="destructive" onClick={() => decide("rejected")}>
                Từ chối
              </Button>
            </div>
          ) : (
            <Alert tone="info">
              {submission.status === "pending"
                ? "Bạn chưa có quyền quyết định. Ngữ cảnh được phép vẫn chỉ xem."
                : "Hồ sơ không còn chờ duyệt. Quyết định đã lưu chỉ xem."}
            </Alert>
          )}
        </>
      ) : (
        <>
          <Tabs
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
            items={[
              { value: "pending", label: "Chờ duyệt" },
              { value: "approved", label: "Đã duyệt" },
              { value: "rejected", label: "Từ chối" },
              { value: "all", label: "Tất cả" },
            ]}
          />
          <Card title="Hàng đợi">
            <DataTable
              rows={records}
              page={page}
              onPage={setPage}
              caption="Hàng đợi hồ sơ"
              columns={[
                { label: "Nhà hàng", render: () => "Bếp Nhà" },
                {
                  label: "Trạng thái",
                  render: (s) => submissionLabels[s.status],
                },
                { label: "Ngày gửi", render: (s) => dateLabel(s.date) },
                {
                  label: "Mở",
                  render: (s) => (
                    <ActionLink
                      href={`${base}/${kind === "menu" ? "menus" : "verification"}/${s.restaurantId}`}
                      secondary
                    >
                      {kind === "menu" ? "Đối chiếu →" : "Xem hồ sơ →"}
                    </ActionLink>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
      <DecisionDialog
        key={decision?.title}
        decision={decision}
        onClose={() => setDecision(null)}
      />
    </div>
  );
}
export function ReportsPage({ id }: { id?: string }) {
  const { data, mutate, busy } = usePlatform(),
    { base, user } = useWorkspace(),
    allowed = usePermission(),
    [status, setStatus] = useState("all"),
    [action, setAction] = useState("hide"),
    [note, setNote] = useState(""),
    [related, setRelated] = useState(false),
    [confirm, setConfirm] = useState(false);
  const report = data.reports.find((r) => r.id === id),
    rows = data.reports.filter((r) => status === "all" || r.status === status),
    canResolve =
      !!report &&
      report.status === "claimed" &&
      report.assignee === user?.displayName &&
      allowed(
        report.target === "restaurant" ? "report.restaurant" : "report.blog",
      );
  return (
    <div className="stack">
      <PageHeading
        title={
          report
            ? `Báo cáo ${report.target === "restaurant" ? "nhà hàng" : "bài viết"}`
            : "Báo cáo vi phạm"
        }
        description="Đọc nội dung và ngữ cảnh trước khi nhận xử lý. Mỗi kết luận chọn một hành động."
      />
      {report ? (
        <>
          <Card title="Thông tin báo cáo">
            <p>
              {report.reporter} · {dateLabel(report.date)}
            </p>
            <p>
              <strong>{report.reason}</strong>
            </p>
            <p>{report.description}</p>
            <Badge>
              {report.status === "open"
                ? "Chưa nhận xử lý"
                : report.status === "claimed"
                  ? `Đang xử lý · ${report.assignee}`
                  : "Đã đóng"}
            </Badge>
            {report.status === "open" &&
              allowed(
                report.target === "restaurant"
                  ? "report.restaurant"
                  : "report.blog",
              ) && (
                <Button
                  loading={busy}
                  onClick={() =>
                    void mutate((d) => {
                      const r = d.reports.find((r) => r.id === id)!;
                      r.status = "claimed";
                      r.assignee = user!.displayName;
                    }, "Đã nhận xử lý báo cáo minh họa.")
                  }
                >
                  Nhận xử lý
                </Button>
              )}
          </Card>
          <Card title="Ngữ cảnh chỉ xem">
            {report.target === "restaurant" ? (
              <>
                <p>Bếp Nhà · 24 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội</p>
                <ActionLink
                  href={`${base}/restaurants/${report.targetId}`}
                  secondary
                >
                  Xem nhà hàng
                </ActionLink>
              </>
            ) : (
              <>
                <p>
                  {data.blogs.find((b) => b.id === report.targetId)?.title ??
                    "Bài viết không còn khả dụng"}
                </p>
                <Alert tone="info">
                  Không có nguồn đọc riêng cho nội dung bài viết bị ẩn / bình
                  luận bị ẩn. Không suy diễn nội dung thiếu.
                </Alert>
              </>
            )}
          </Card>
          {canResolve ? (
            <Card title="Kết luận báo cáo">
              <SelectField
                label="Một hành động kết luận"
                value={action}
                onChange={setAction}
                options={[
                  {
                    value: "hide",
                    label:
                      report.target === "restaurant"
                        ? "Ẩn nhà hàng"
                        : "Ẩn bài viết",
                  },
                  { value: "dismiss", label: "Bác bỏ báo cáo" },
                ]}
              />
              <TextArea
                label="Ghi chú kết luận"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
              />
              <Choice
                label="Áp dụng kết luận cho các báo cáo đang mở cùng đối tượng"
                checked={related}
                onChange={setRelated}
              />
              <Button onClick={() => setConfirm(true)}>
                Kiểm tra và kết luận
              </Button>
            </Card>
          ) : report.conclusion ? (
            <Card title="Kết luận đã lưu">
              <p>{report.conclusion}</p>
            </Card>
          ) : (
            <Alert tone="info">
              Chỉ người đã nhận xử lý và có quyền mới có thể kết luận báo cáo.
            </Alert>
          )}
        </>
      ) : (
        <>
          <Tabs
            value={status}
            onChange={setStatus}
            items={[
              { value: "all", label: "Tất cả" },
              { value: "open", label: "Chưa nhận" },
              { value: "claimed", label: "Đang xử lý" },
              { value: "resolved", label: "Đã giải quyết" },
            ]}
          />
          <Card title="Báo cáo">
            <DataTable
              rows={rows}
              caption="Danh sách báo cáo"
              columns={[
                {
                  label: "Đối tượng",
                  render: (r) =>
                    r.target === "restaurant" ? "Nhà hàng" : "Bài viết",
                },
                { label: "Lý do", render: (r) => r.reason },
                { label: "Người báo cáo", render: (r) => r.reporter },
                {
                  label: "Trạng thái",
                  render: (r) =>
                    r.status === "open"
                      ? "Chưa nhận"
                      : r.status === "claimed"
                        ? "Đang xử lý"
                        : "Đã đóng",
                },
                {
                  label: "Mở",
                  render: (r) => (
                    <ActionLink href={`${base}/reports/${r.id}`} secondary>
                      Xem báo cáo →
                    </ActionLink>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        title="Xác nhận kết luận báo cáo?"
        destructive={action === "hide"}
        loading={busy}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await mutate((d) => {
            const target = d.reports.find((r) => r.id === id)!;
            if (
              target.status !== "claimed" ||
              target.assignee !== user?.displayName
            )
              throw new Error("Báo cáo không còn do bạn xử lý.");
            d.reports.forEach((r) => {
              if (
                r.id === id ||
                (related &&
                  r.target === target.target &&
                  r.targetId === target.targetId &&
                  (r.status === "open" || r.status === "claimed"))
              ) {
                r.status = action === "dismiss" ? "dismissed" : "resolved";
                r.conclusion = `${action === "dismiss" ? "Bác bỏ báo cáo" : "Ẩn nội dung"} · ${note || "Không có ghi chú"}`;
              }
            });
            if (action === "hide") {
              if (target.target === "restaurant")
                d.restaurants.find(
                  (r) => r.id === target.targetId,
                )!.moderation = "hidden";
              else
                d.blogs.find((b) => b.id === target.targetId)!.moderation =
                  "hidden";
            }
          }, "Đã kết luận báo cáo trong bản minh họa.");
          setConfirm(false);
        }}
      >
        <p>
          {action === "dismiss"
            ? "Bác bỏ báo cáo, giữ trạng thái nội dung."
            : "Ẩn đối tượng bị báo cáo."}{" "}
          {related && "Áp dụng cả các báo cáo đang mở cùng đối tượng."}
        </p>
        <p>{note}</p>
      </ConfirmDialog>
    </div>
  );
}
export function CommunityPage() {
  const { data } = usePlatform(),
    allowed = usePermission(),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [decision, setDecision] = useState<Decision | null>(null),
    blog = data.blogs.find((b) => b.id === selected);
  function change(kind: "blog" | "comment", id: string, hidden: boolean) {
    setDecision({
      title: hidden ? "Hiển thị lại nội dung" : "Ẩn nội dung cộng đồng",
      target: id,
      destructive: !hidden,
      update: (d) => {
        if (kind === "blog")
          d.blogs.find((b) => b.id === id)!.moderation = hidden
            ? "visible"
            : "hidden";
        else
          for (const b of d.blogs) {
            const c = b.comments.find((c) => c.id === id);
            if (c) c.moderation = hidden ? "visible" : "hidden";
          }
      },
    });
  }
  return (
    <div className="stack">
      <PageHeading
        title="Nội dung cộng đồng"
        description="Bài viết và bình luận có thao tác kiểm duyệt riêng. Không sửa lời người viết."
      />
      <Field
        label="Tìm tiêu đề hoặc tác giả"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Card title="Bài viết">
        <DataTable
          rows={data.blogs.filter((b) =>
            `${b.title} ${b.author}`
              .toLocaleLowerCase("vi")
              .includes(query.toLocaleLowerCase("vi")),
          )}
          caption="Bài viết cộng đồng"
          columns={[
            { label: "Bài viết", render: (b) => b.title },
            { label: "Tác giả", render: (b) => b.author },
            {
              label: "Trạng thái",
              render: (b) => visibilityLabels[b.moderation],
            },
            {
              label: "Ngữ cảnh",
              render: (b) => (
                <Button variant="secondary" onClick={() => setSelected(b.id)}>
                  Xem ngữ cảnh →
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Dialog
        open={!!blog}
        onClose={() => setSelected(null)}
        title="Ngữ cảnh bài viết"
        drawer
      >
        {blog && (
          <div className="stack">
            <h3>{blog.title}</h3>
            <p>{blog.author}</p>
            {blog.moderation === "visible" ? (
              <p>{blog.content}</p>
            ) : (
              <Alert tone="warning">
                Nội dung bị ẩn chưa có hợp đồng đọc riêng. Chỉ metadata được
                phép hiển thị.
              </Alert>
            )}
            {allowed("blog.moderate") && (
              <Button
                variant="secondary"
                onClick={() =>
                  change("blog", blog.id, blog.moderation !== "visible")
                }
              >
                {blog.moderation === "visible"
                  ? "Ẩn bài viết"
                  : "Hiển thị lại bài viết"}
              </Button>
            )}
            <h3>Bình luận</h3>
            {blog.comments
              .filter((c) => c.moderation === "visible")
              .map((c) => (
                <Card className="plain" key={c.id}>
                  <strong>{c.author}</strong>
                  <p>{c.text}</p>
                  {allowed("blog.moderate") && (
                    <Button
                      variant="secondary"
                      onClick={() => change("comment", c.id, false)}
                    >
                      Ẩn bình luận
                    </Button>
                  )}
                </Card>
              ))}
            <p className="helper">
              Không có nguồn đọc danh sách bình luận bị ẩn. Không dựng danh sách
              nội dung không được trả về.
            </p>
          </div>
        )}
      </Dialog>
      <DecisionDialog decision={decision} onClose={() => setDecision(null)} />
    </div>
  );
}
export function ModerationReviews() {
  const { data } = usePlatform(),
    allowed = usePermission(),
    [selected, setSelected] = useState<string | null>(null),
    [decision, setDecision] = useState<Decision | null>(null),
    review = data.reviews.find((r) => r.id === selected);
  function change(reply: boolean) {
    setDecision({
      title: reply
        ? review!.replyModeration === "hidden"
          ? "Hiển thị lại phản hồi"
          : "Ẩn phản hồi chủ nhà hàng"
        : review!.moderation === "visible"
          ? "Ẩn đánh giá"
          : "Hiển thị lại đánh giá",
      target: review!.id,
      destructive: true,
      update: (d) => {
        const r = d.reviews.find((r) => r.id === selected)!;
        if (reply)
          r.replyModeration =
            r.replyModeration === "hidden" ? "visible" : "hidden";
        else r.moderation = r.moderation === "visible" ? "hidden" : "visible";
      },
    });
  }
  return (
    <div className="stack">
      <PageHeading
        title="Đánh giá & phản hồi"
        description="Xử lý đánh giá và lời phản hồi của chủ nhà hàng trong đúng ngữ cảnh."
      />
      <Card title="Đánh giá">
        <DataTable
          rows={data.reviews}
          caption="Đánh giá và phản hồi"
          columns={[
            {
              label: "Nhà hàng / Người viết",
              render: (r) => (
                <>
                  Bếp Nhà<p className="helper">{r.author}</p>
                </>
              ),
            },
            { label: "Số sao", render: (r) => `${r.rating} / 5` },
            {
              label: "Trạng thái",
              render: (r) => visibilityLabels[r.moderation],
            },
            {
              label: "Phản hồi",
              render: (r) => (r.reply ? "Có phản hồi" : "Chưa có"),
            },
            {
              label: "Mở",
              render: (r) => (
                <Button variant="secondary" onClick={() => setSelected(r.id)}>
                  Mở →
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Dialog
        open={!!review}
        onClose={() => setSelected(null)}
        title="Chi tiết đánh giá"
        drawer
      >
        {review && (
          <div className="stack">
            <ReviewContent review={review} showHidden />
            {allowed("review.moderate") && (
              <div className="actions">
                <Button variant="secondary" onClick={() => change(false)}>
                  {review.moderation === "visible"
                    ? "Ẩn đánh giá"
                    : "Hiển thị lại đánh giá"}
                </Button>
                {review.reply && (
                  <Button variant="secondary" onClick={() => change(true)}>
                    {review.replyModeration === "hidden"
                      ? "Hiển thị lại phản hồi"
                      : "Ẩn phản hồi"}
                  </Button>
                )}
              </div>
            )}
            <Alert tone="info">
              Nội dung chỉ xem. Không chỉnh sửa đánh giá hoặc phản hồi thay
              người viết.
            </Alert>
          </div>
        )}
      </Dialog>
      <DecisionDialog decision={decision} onClose={() => setDecision(null)} />
    </div>
  );
}
