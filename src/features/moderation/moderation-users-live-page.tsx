"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  Avatar,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Pagination,
  SelectField,
  Skeleton,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/workspace";
import { getErrorMessage } from "@/shared/api/error";
import {
  canLiftRestriction,
  moderationUsersService,
  sanctionTypeLabels,
  userStatusLabels,
  type ModerationUsersService,
} from "./moderation-users-service";
import type {
  CreateSanctionRequestDto,
  ListModeratedUsersQuery,
  ModeratedUserDetailDto,
  ModeratedUserDto,
  SanctionType,
} from "./moderation-users-types";

const PAGE_SIZE = 20;

/** Nhãn tiếng Việt của vai trò người dùng. */
const roleLabels: Record<string, string> = {
  TRAVELER: "Thực khách",
  RESTAURANT_OWNER: "Chủ nhà hàng",
};

type StatusFilter = "all" | "active" | "suspended" | "banned";

/** Dòng bảng: `DataTable` yêu cầu `id` là chuỗi, nên giữ thêm `userId` gốc. */
type UserRow = Omit<ModeratedUserDto, "id"> & { id: string; userId: number };

/** Đối tượng bị xử phạt hoặc gỡ hạn chế. */
type RestrictionTarget = {
  userId: number;
  displayName: string;
  email: string;
  status: string;
};

/** Màu của badge trạng thái tài khoản. */
function statusTone(
  status: string,
): "neutral" | "success" | "error" | "warning" {
  if (status === "active") return "success";
  if (status === "banned") return "error";
  if (status === "suspended") return "warning";
  return "neutral";
}

/**
 * MOD-U1..MOD-U4 — tra cứu người dùng và áp dụng hạn chế.
 *
 * Màn hình đọc dữ liệu thật qua `/api/backend/mod/users`; access token của
 * kiểm duyệt viên không bao giờ tới trình duyệt.
 */
export function ModerationUsersLivePage({ base }: { base: string }) {
  const service: ModerationUsersService = moderationUsersService;
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    key: string;
    data: { items: ModeratedUserDto[]; totalItems: number };
  } | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [sanctioning, setSanctioning] = useState<RestrictionTarget | null>(null);
  const [lifting, setLifting] = useState<RestrictionTarget | null>(null);
  const [busy, setBusy] = useState(false);

  /** Bộ lọc hiện tại là chìa khoá của lần tải; tải xong mới hiện dữ liệu. */
  const queryKey = `${query}|${role}|${status}|${page}|${attempt}`;
  const loading = result?.key !== queryKey;
  const rows = result?.key === queryKey ? result.data.items : [];
  const totalItems = result?.key === queryKey ? result.data.totalItems : 0;

  useEffect(() => {
    let ignore = false;
    const listQuery: ListModeratedUsersQuery = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (query.trim()) listQuery.q = query.trim();
    if (role !== "all") listQuery.role = role as "TRAVELER";
    if (status !== "all") listQuery.status = status as "active";
    service
      .list(listQuery)
      .then((response) => {
        if (ignore) return;
        setResult({
          key: `${query}|${role}|${status}|${page}|${attempt}`,
          data: { items: response.items, totalItems: response.totalItems },
        });
      })
      .catch((caught) => {
        if (ignore) return;
        setError(getErrorMessage(caught));
        // Không để màn hình kẹt ở trạng thái đang tải khi lần tải thất bại.
        setResult({
          key: `${query}|${role}|${status}|${page}|${attempt}`,
          data: { items: [], totalItems: 0 },
        });
      });
    return () => {
      ignore = true;
    };
  }, [service, query, role, status, page, attempt]);

  return (
    <div className="stack">
      <PageHeading
        title="Người dùng"
        description="Tra cứu tài khoản, lịch sử xử phạt và hạn chế vi phạm."
      />

      {error && <Alert tone="warning">{error}</Alert>}
      {saved && <Alert tone="success">{saved}</Alert>}

      <Card title="Bộ lọc">
        <div className="grid-3">
          <Field
            label="Tìm theo tên hoặc email"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <SelectField
            label="Vai trò"
            value={role}
            onChange={(value) => {
              setRole(value);
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
            onChange={(value) => {
              setStatus(value as StatusFilter);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Mọi trạng thái" },
              { value: "active", label: "Đang hoạt động" },
              { value: "suspended", label: "Tạm đình chỉ" },
              { value: "banned", label: "Bị cấm" },
            ]}
          />
        </div>
      </Card>

      <Card title={`Kết quả tra cứu · ${totalItems} tài khoản`}>
        {loading ? (
          <Skeleton rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState title="Không có tài khoản phù hợp">
            Thử đổi bộ lọc để xem thêm người dùng.
          </EmptyState>
        ) : (
          <DataTable
            rows={rows.map((person): UserRow => ({
              ...person,
              id: String(person.id),
              userId: person.id,
            }))}
            caption="Danh sách người dùng"
            columns={[
              {
                label: "Người dùng / Email",
                render: (person) => (
                  <>
                    <strong>{person.displayName}</strong>
                    <p className="helper">{person.email}</p>
                  </>
                ),
              },
              {
                label: "Vai trò",
                render: (person) => roleLabels[person.role] ?? person.role,
              },
              {
                label: "Trạng thái",
                render: (person) => (
                  <Badge tone={statusTone(person.status)}>
                    {userStatusLabels[person.status] ?? person.status}
                  </Badge>
                ),
              },
              {
                label: "Đình chỉ đến",
                render: (person) =>
                  person.suspendedUntil
                    ? new Date(person.suspendedUntil).toLocaleString("vi-VN")
                    : "Không có",
              },
              {
                label: "Thao tác",
                render: (person) => (
                  <div className="actions">
                    <ActionLink href={`${base}/users/${person.userId}`} secondary>
                      Hồ sơ →
                    </ActionLink>
                    <Button
                      variant="tertiary"
                      onClick={() =>
                        setSanctioning({
                          userId: person.userId,
                          displayName: person.displayName,
                          email: person.email,
                          status: person.status,
                        })
                      }
                    >
                      Xử phạt
                    </Button>
                    {canLiftRestriction(person.status) && (
                      <Button
                        variant="tertiary"
                        onClick={() =>
                          setLifting({
                            userId: person.userId,
                            displayName: person.displayName,
                            email: person.email,
                            status: person.status,
                          })
                        }
                      >
                        Gỡ hạn chế
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      {totalItems > PAGE_SIZE && (
        <Pagination
          total={totalItems}
          page={page}
          size={PAGE_SIZE}
          onChange={setPage}
        />
      )}

      <SanctionDialog
        key={sanctioning?.userId ?? "sanction"}
        person={sanctioning}
        busy={busy}
        onClose={() => setSanctioning(null)}
        onSubmit={async (request) => {
          if (!sanctioning) return;
          setBusy(true);
          setError("");
          try {
            await service.sanction(sanctioning.userId, request);
            setSaved(`Đã ghi nhận xử phạt với ${sanctioning.displayName}.`);
            setSanctioning(null);
            setAttempt((value) => value + 1);
          } catch (caught) {
            setError(getErrorMessage(caught));
          } finally {
            setBusy(false);
          }
        }}
      />

      <LiftDialog
        key={lifting?.userId ?? "lift"}
        person={lifting}
        open={!!lifting}
        busy={busy}
        onClose={() => setLifting(null)}
        onSubmit={async (liftReason) => {
          if (!lifting) return;
          setBusy(true);
          setError("");
          try {
            await service.unban(lifting.userId, { liftReason });
            setSaved(`Đã gỡ hạn chế cho ${lifting.displayName}.`);
            setLifting(null);
            setAttempt((value) => value + 1);
          } catch (caught) {
            setError(getErrorMessage(caught));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** MOD-U3 — chọn hình thức xử phạt và nhập lý do. */
function SanctionDialog({
  person,
  busy,
  onClose,
  onSubmit,
}: {
  person: RestrictionTarget | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (request: CreateSanctionRequestDto) => void;
}) {
  const [type, setType] = useState<SanctionType>("warn");
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [fieldError, setFieldError] = useState("");

  return (
    <ConfirmDialog
      open={!!person}
      title={`Xử phạt ${person?.displayName ?? ""}`}
      destructive={type !== "warn"}
      loading={busy}
      label="Gửi xử phạt"
      onClose={onClose}
      onConfirm={() => {
        if (!reason.trim()) {
          setFieldError("Vui lòng nhập lý do xử phạt.");
          return;
        }
        if (type === "suspend" && !until) {
          setFieldError("Vui lòng chọn thời điểm hết hạn tạm khóa.");
          return;
        }
        const request: CreateSanctionRequestDto = {
          type,
          reason: reason.trim(),
        };
        if (type === "suspend" && until)
          request.endsAt = new Date(`${until}:00+07:00`).toISOString();
        onSubmit(request);
      }}
    >
      <p>
        Đối tượng: <strong>{person?.email}</strong>
      </p>
      <SelectField
        label="Hình thức xử phạt"
        value={type}
        onChange={(value) => setType(value as SanctionType)}
        options={[
          { value: "warn", label: sanctionTypeLabels.warn },
          { value: "suspend", label: sanctionTypeLabels.suspend },
          { value: "ban", label: sanctionTypeLabels.ban },
        ]}
      />
      {type === "suspend" && (
        <Field
          label="Tạm khóa đến (giờ Việt Nam)"
          type="datetime-local"
          value={until}
          onChange={(event) => setUntil(event.target.value)}
          required
        />
      )}
      <TextArea
        label="Lý do xử phạt"
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          if (fieldError) setFieldError("");
        }}
        maxLength={1000}
        required
        error={fieldError}
      />
    </ConfirmDialog>
  );
}

/** MOD-U4 — gỡ hạn chế kèm lý do. */
function LiftDialog({
  person,
  open,
  busy,
  onClose,
  onSubmit,
}: {
  person: RestrictionTarget | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (liftReason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState("");

  return (
    <ConfirmDialog
      open={open}
      title={`Gỡ hạn chế cho ${person?.displayName ?? ""}`}
      loading={busy}
      label="Gỡ hạn chế"
      onClose={onClose}
      onConfirm={() => {
        if (!reason.trim()) {
          setFieldError("Vui lòng nhập lý do gỡ hạn chế.");
          return;
        }
        onSubmit(reason.trim());
      }}
    >
      <p>
        Tài khoản sẽ trở lại trạng thái <strong>Đang hoạt động</strong>.
      </p>
      <TextArea
        label="Lý do gỡ hạn chế"
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          if (fieldError) setFieldError("");
        }}
        maxLength={1000}
        required
        error={fieldError}
      />
    </ConfirmDialog>
  );
}

/**
 * MOD-U2 — hồ sơ chi tiết của một người dùng: thông tin, lịch sử xử phạt và
 * nhà hàng của chủ nhà hàng.
 */
export function ModerationUserDetailPage({
  userId,
}: {
  userId: number;
}) {
  const service: ModerationUsersService = moderationUsersService;
  const [detail, setDetail] = useState<ModeratedUserDetailDto | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [lifting, setLifting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let ignore = false;
    service
      .detail(userId)
      .then((response) => {
        if (ignore) return;
        setDetail(response);
      })
      .catch((caught) => {
        if (ignore) return;
        setError(getErrorMessage(caught));
      });
    return () => {
      ignore = true;
    };
  }, [service, userId, attempt]);

  if (!detail)
    return (
      <div className="stack">
        {error ? (
          <Card title="Chưa tải được hồ sơ">
            <Alert>{error}</Alert>
            <Button
              onClick={() => {
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              Thử lại
            </Button>
          </Card>
        ) : (
          <Skeleton rows={4} />
        )}
      </div>
    );

  return (
    <div className="stack">
      <PageHeading
        title={`Hồ sơ ${detail.displayName}`}
        description="Thông tin tài khoản, lịch sử xử phạt và nội dung liên quan."
      />

      {error && <Alert tone="warning">{error}</Alert>}
      {saved && <Alert tone="success">{saved}</Alert>}

      <Card title="Thông tin tài khoản">
        <div className="actions">
          <Avatar name={detail.displayName} image={detail.avatarUrl} />
          <div>
            <strong>{detail.displayName}</strong>
            <p className="helper">{detail.email}</p>
          </div>
        </div>
        <p>
          {roleLabels[detail.role] ?? detail.role} ·{" "}
          <Badge tone={statusTone(detail.status)}>
            {userStatusLabels[detail.status] ?? detail.status}
          </Badge>
        </p>
        {detail.suspendedUntil && (
          <p>
            Đình chỉ đến{" "}
            {new Date(detail.suspendedUntil).toLocaleString("vi-VN")}
          </p>
        )}
        <p className="helper">
          Ngày tạo {new Date(detail.createdAt).toLocaleDateString("vi-VN")}
          {detail.lastLoginAt
            ? ` · Đăng nhập gần nhất ${new Date(detail.lastLoginAt).toLocaleString("vi-VN")}`
            : " · Chưa đăng nhập"}
        </p>
        <p className="helper">
          {detail.blogCount} bài viết · {detail.reviewCount} đánh giá ·{" "}
          {detail.reportsAgainstContent} báo cáo liên quan
        </p>
        {detail.restaurant && (
          <p>
            Nhà hàng: <strong>{detail.restaurant.name}</strong> ·{" "}
            {detail.restaurant.addressLine}
          </p>
        )}
        {canLiftRestriction(detail.status) && (
          <Button variant="secondary" onClick={() => setLifting(true)}>
            Gỡ hạn chế
          </Button>
        )}
      </Card>

      <Card title="Lịch sử xử phạt">
        {detail.sanctions.length === 0 ? (
          <EmptyState title="Chưa có lệnh xử phạt">
            Tài khoản chưa từng bị cảnh báo, tạm khóa hay cấm.
          </EmptyState>
        ) : (
          <DataTable
            rows={detail.sanctions.map((sanction) => ({
              ...sanction,
              id: String(sanction.id),
            }))}
            caption="Lịch sử xử phạt"
            columns={[
              {
                label: "Hình thức",
                render: (sanction) =>
                  sanctionTypeLabels[sanction.type] ?? sanction.type,
              },
              { label: "Lý do", render: (sanction) => sanction.reason },
              {
                label: "Người ban hành",
                render: (sanction) => sanction.issuedBy.displayName,
              },
              {
                label: "Bắt đầu",
                render: (sanction) =>
                  new Date(sanction.startsAt).toLocaleString("vi-VN"),
              },
              {
                label: "Kết thúc",
                render: (sanction) =>
                  sanction.endsAt
                    ? new Date(sanction.endsAt).toLocaleString("vi-VN")
                    : "Không có",
              },
              {
                label: "Đã gỡ",
                render: (sanction) =>
                  sanction.liftedAt
                    ? new Date(sanction.liftedAt).toLocaleString("vi-VN")
                    : "Chưa",
              },
            ]}
          />
        )}
      </Card>

      <LiftDialog
        key={detail?.id ?? "lift-detail"}
        person={{
          userId: detail.id,
          displayName: detail.displayName,
          email: detail.email,
          status: detail.status,
        }}
        open={lifting}
        busy={busy}
        onClose={() => setLifting(false)}
        onSubmit={async (liftReason) => {
          setBusy(true);
          setError("");
          try {
            await service.unban(detail.id, { liftReason });
            setSaved("Đã gỡ hạn chế cho tài khoản.");
            setLifting(false);
            setAttempt((value) => value + 1);
          } catch (caught) {
            setError(getErrorMessage(caught));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
