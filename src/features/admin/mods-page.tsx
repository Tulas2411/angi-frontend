"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CheckBadgeIcon,
  EnvelopeIcon,
  FlagIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Alert, Badge, Button, Card, Input } from "@/shared/ui";
import {
  Avatar,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Pagination,
  Skeleton,
} from "@/components/ui/primitives";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { ApiError } from "@/shared/api/error";
import { useRemote } from "@/features/explore/use-remote";
import {
  createModBody,
  displayNameProblem,
  modDateTime,
  modError,
  modFieldErrors,
  modStatusLabels,
  modStatusTone,
  validateModForm,
  type ModForm,
} from "./mod-rules";
import { modService, type ModService } from "./mod-service";
import {
  groupPermissions,
  isGrantable,
  overrideChoice,
  overridesBody,
  withOverride,
} from "./permission-rules";
import {
  permissionService,
  type PermissionService,
} from "./permission-service";
import type { PermissionOverrideDto } from "./permission-types";
import { OverrideControl } from "./permissions-page";
import "./permissions.css";
import "./mods.css";

/** ADM-M1 page size (BE allows 1..100). */
const pageSize = 20;

const statusFilters = [
  { value: "active", label: "Đang hoạt động" },
  { value: "deactivated", label: "Đã vô hiệu hóa" },
  { value: "", label: "Tất cả" },
] as const;
type StatusFilter = (typeof statusFilters)[number]["value"];

const emptyForm: ModForm = { email: "", displayName: "" };

/** ADM-M2 with the optional overrides; ADM-P1 is read only once the overrides are opened. */
function CreateModDialog({
  service,
  permissions,
  onClose,
  onCreated,
}: {
  service: ModService;
  permissions: PermissionService;
  onClose: () => void;
  onCreated: (name: string, email: string) => void;
}) {
  const formId = useId();
  const [form, setForm] = useState<ModForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);
  const [overrides, setOverrides] = useState<PermissionOverrideDto[]>([]);
  const busy = useRef(false);
  const [catalog, retryCatalog] = useRemote(
    () =>
      showOverrides
        ? permissions.catalog()
        : new Promise<never>(() => undefined),
    `catalog:${showOverrides}`,
  );
  const set = (next: Partial<ModForm>) => {
    setForm((current) => ({ ...current, ...next }));
    setErrors((current) => {
      const copy = { ...current };
      for (const key of Object.keys(next)) delete copy[key];
      return copy;
    });
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const found = validateModForm(form);
    setErrors(found);
    setProblem("");
    if (Object.keys(found).length) return;
    busy.current = true;
    setSaving(true);
    try {
      const body = createModBody(
        form,
        catalog.status === "ready"
          ? overridesBody(overrides, catalog.data.permissions)
          : overrides,
      );
      const created = await service.create(body);
      onCreated(created.displayName, created.email);
    } catch (caught) {
      const fields = modFieldErrors(caught);
      setErrors(fields);
      if (!Object.keys(fields).length) setProblem(modError(caught));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      focusField
      title="Tạo tài khoản Mod"
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Tạo tài khoản
          </Button>
        </>
      }
    >
      <form id={formId} className="mod-create" onSubmit={submit} noValidate>
        <p className="helper">
          ANGI tạo tài khoản với vai trò Mod và gửi email mời đặt mật khẩu tới
          địa chỉ bên dưới.
        </p>
        <Field
          label="Email"
          type="email"
          required
          autoComplete="off"
          placeholder="Ví dụ: linh.mod@angi.vn"
          value={form.email}
          error={errors.email}
          helper="Email chưa có tài khoản ANGI; dùng để đăng nhập."
          onChange={(event) => set({ email: event.target.value })}
        />
        <Field
          label="Tên hiển thị"
          required
          autoComplete="off"
          placeholder="Ví dụ: Mod Linh"
          value={form.displayName}
          error={errors.displayName}
          helper="Từ 2 đến 100 ký tự."
          onChange={(event) => set({ displayName: event.target.value })}
        />
        <details
          className="mod-create-overrides"
          onToggle={(event) => setShowOverrides(event.currentTarget.open)}
        >
          <summary>
            Ghi đè quyền ngay khi tạo <span>(không bắt buộc)</span>
            {overrides.length > 0 && (
              <Badge tone="warning">{overrides.length} ghi đè</Badge>
            )}
          </summary>
          <p className="helper">
            Để trống thì Mod dùng bộ quyền mặc định của role MOD. Có thể chỉnh
            sau ở trang Phân quyền.
          </p>
          {catalog.status === "loading" && showOverrides && (
            <Skeleton rows={3} />
          )}
          {catalog.status === "error" && (
            <div className="stack-sm">
              <Alert>{modError(catalog.error)}</Alert>
              <Button variant="secondary" onClick={retryCatalog}>
                Thử lại
              </Button>
            </div>
          )}
          {catalog.status === "ready" && (
            <div className="mod-create-groups">
              {groupPermissions(
                catalog.data.permissions.filter((item) =>
                  isGrantable(item.code),
                ),
              ).map((group) => (
                <section key={group.key} aria-label={group.title}>
                  <h3>{group.title}</h3>
                  <ul>
                    {group.permissions.map((item) => (
                      <li key={item.code}>
                        <span>
                          <strong>{item.description}</strong>
                          <small>
                            {catalog.data.roleDefaults.MOD.includes(item.code)
                              ? "Mặc định có"
                              : "Mặc định không"}
                          </small>
                        </span>
                        <OverrideControl
                          name={`${formId}-${item.code}`}
                          label={`${item.description}: ghi đè cho Mod mới`}
                          value={overrideChoice(overrides, item.code)}
                          onChange={(next) =>
                            setOverrides((current) =>
                              withOverride(current, item.code, next),
                            )
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </details>
        {problem && <Alert>Chưa tạo được tài khoản. {problem}</Alert>}
      </form>
    </Dialog>
  );
}

/** F-65: ADM-M1 list with search and status, ADM-M2 create. */
export function ModsPage({
  service = modService,
  permissions = permissionService,
}: {
  service?: ModService;
  permissions?: PermissionService;
}) {
  const { base } = useWorkspace();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [list, retry] = useRemote(
    () =>
      service.list({
        q: q || undefined,
        status: status || undefined,
        page,
        pageSize,
      }),
    `${q}:${status}:${page}:${version}`,
  );

  return (
    <div className="stack mod-page">
      <PageHeading
        title="Quản lý Mod"
        description="Tạo tài khoản kiểm duyệt viên, theo dõi việc họ đã xử lý, đổi tên hoặc vô hiệu hóa tài khoản."
        action={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon className="mod-button-icon" aria-hidden /> Tạo tài khoản
            Mod
          </Button>
        }
      />
      {notice && <Alert tone="success">{notice}</Alert>}
      <div className="mod-toolbar">
        <label className="permission-search">
          <MagnifyingGlassIcon aria-hidden />
          <span className="sr-only">Tìm Mod</span>
          <Input
            type="search"
            value={search}
            placeholder="Nhập tên hoặc email Mod…"
            autoComplete="off"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div
          className="mod-status-filter"
          role="group"
          aria-label="Lọc theo trạng thái"
        >
          {statusFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={status === item.value}
              onClick={() => {
                setStatus(item.value);
                setPage(1);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {list.status === "loading" && <Skeleton rows={5} />}
      {list.status === "error" && (
        <Card title="Chưa tải được danh sách Mod">
          <Alert>{modError(list.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      )}
      {list.status === "ready" &&
        (list.data.items.length === 0 ? (
          <EmptyState
            title={q ? "Không có Mod khớp từ khóa" : "Chưa có tài khoản Mod"}
            action={
              !q && (
                <Button onClick={() => setCreating(true)}>
                  Tạo tài khoản Mod
                </Button>
              )
            }
          >
            {q
              ? "Thử tên hoặc email khác, hoặc đổi bộ lọc trạng thái."
              : "Tạo tài khoản đầu tiên để giao việc kiểm duyệt."}
          </EmptyState>
        ) : (
          <section className="mod-list" aria-label="Danh sách Mod">
            <p className="helper" role="status">
              {list.data.totalItems} tài khoản Mod
            </p>
            <div className="mod-table" role="table" aria-label="Tài khoản Mod">
              <div className="mod-table-head" role="row">
                <span role="columnheader">Mod</span>
                <span role="columnheader">Trạng thái</span>
                <span role="columnheader">Đăng nhập gần nhất</span>
                <span role="columnheader">Ngày tạo</span>
                <span role="columnheader">
                  <span className="sr-only">Thao tác</span>
                </span>
              </div>
              {list.data.items.map((mod) => (
                <div key={mod.id} className="mod-table-row" role="row">
                  <span role="cell" className="mod-who">
                    <Avatar name={mod.displayName} image={mod.avatarUrl} />
                    <span>
                      <Link href={`${base}/moderators/${mod.id}`}>
                        {mod.displayName}
                      </Link>
                      <small>{mod.email}</small>
                    </span>
                  </span>
                  <span role="cell" data-label="Trạng thái">
                    <Badge tone={modStatusTone(mod.status)}>
                      {modStatusLabels[mod.status] ?? mod.status}
                    </Badge>
                  </span>
                  <span role="cell" data-label="Đăng nhập gần nhất">
                    {modDateTime(mod.lastLoginAt)}
                  </span>
                  <span role="cell" data-label="Ngày tạo">
                    {modDateTime(mod.createdAt, "—")}
                  </span>
                  <span role="cell" className="mod-actions">
                    <Link
                      className="mod-link"
                      href={`${base}/permissions?tab=mods&mod=${mod.id}`}
                    >
                      <ShieldCheckIcon aria-hidden /> Phân quyền
                    </Link>
                    <Link
                      className="button button-secondary"
                      href={`${base}/moderators/${mod.id}`}
                      aria-label={`Xem chi tiết ${mod.displayName}`}
                    >
                      Chi tiết
                    </Link>
                  </span>
                </div>
              ))}
            </div>
            {list.data.totalPages > 1 && (
              <Pagination
                total={list.data.totalItems}
                page={list.data.page}
                size={list.data.pageSize}
                onChange={setPage}
              />
            )}
          </section>
        ))}
      {creating && (
        <CreateModDialog
          service={service}
          permissions={permissions}
          onClose={() => setCreating(false)}
          onCreated={(name, email) => {
            setCreating(false);
            setNotice(
              `Đã tạo tài khoản ${name}. ANGI đã gửi email mời đặt mật khẩu tới ${email}.`,
            );
            setStatus("active");
            setPage(1);
            setVersion((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}

/** F-65: ADM-M3 detail and ADM-M4 rename / deactivate / reactivate. */
export function ModDetailPage({
  userId,
  service = modService,
  permissions = permissionService,
}: {
  userId: number;
  service?: ModService;
  permissions?: PermissionService;
}) {
  const { base } = useWorkspace();
  const [version, setVersion] = useState(0);
  const [state, retry] = useRemote(
    () => service.detail(userId),
    `${userId}:${version}`,
  );
  const [catalog] = useRemote(() => permissions.catalog(), "catalog");
  const [name, setName] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState<"name" | "status" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("");
  const busy = useRef(false);

  const back = (
    <Link className="mod-back" href={`${base}/moderators`}>
      <ArrowLeftIcon aria-hidden /> Tất cả Mod
    </Link>
  );
  if (state.status === "loading")
    return (
      <div className="stack mod-page">
        {back}
        <Skeleton rows={6} />
      </div>
    );
  if (state.status === "error") {
    const missing =
      state.error instanceof ApiError &&
      state.error.errorCode === "MOD_NOT_FOUND";
    return (
      <div className="stack mod-page">
        {back}
        <Card title={missing ? "Không tìm thấy Mod" : "Chưa tải được Mod"}>
          <Alert>{modError(state.error)}</Alert>
          {!missing && <Button onClick={retry}>Thử lại</Button>}
        </Card>
      </div>
    );
  }
  const mod = state.data;
  const draftName = name ?? mod.displayName;
  const nameChanged = draftName.trim() !== mod.displayName;
  const active = mod.status === "active";
  const descriptions = new Map(
    catalog.status === "ready"
      ? catalog.data.permissions.map((item) => [item.code, item.description])
      : [],
  );

  async function save(
    kind: "name" | "status",
    request: Parameters<ModService["update"]>[1],
    done: string,
  ) {
    if (busy.current) return;
    busy.current = true;
    setSaving(kind);
    setProblem("");
    try {
      await service.update(userId, request);
      setNotice(done);
      setName(null);
      setConfirming(false);
      setVersion((value) => value + 1);
    } catch (caught) {
      const fields = modFieldErrors(caught);
      if (kind === "name" && fields.displayName)
        setNameError(fields.displayName);
      else setProblem(modError(caught));
    } finally {
      busy.current = false;
      setSaving(null);
    }
  }

  return (
    <div className="stack mod-page">
      {back}
      <header className="mod-hero">
        <Avatar name={mod.displayName} image={mod.avatarUrl} />
        <div>
          <h1>{mod.displayName}</h1>
          <p>
            <EnvelopeIcon aria-hidden /> {mod.email}
          </p>
        </div>
        <Badge tone={modStatusTone(mod.status)}>
          {modStatusLabels[mod.status] ?? mod.status}
        </Badge>
      </header>
      {notice && <Alert tone="success">{notice}</Alert>}
      {problem && <Alert>{problem}</Alert>}

      <div className="mod-stats" aria-label="Việc đã xử lý">
        <div>
          <CheckBadgeIcon aria-hidden />
          <strong>{mod.handled.verifications.toLocaleString("vi-VN")}</strong>
          <span>Hồ sơ xác minh đã duyệt</span>
        </div>
        <div>
          <BookOpenIcon aria-hidden />
          <strong>{mod.handled.menus.toLocaleString("vi-VN")}</strong>
          <span>Bản thực đơn đã duyệt</span>
        </div>
        <div>
          <FlagIcon aria-hidden />
          <strong>{mod.handled.reports.toLocaleString("vi-VN")}</strong>
          <span>Báo cáo đã xử lý</span>
        </div>
      </div>

      <div className="mod-columns">
        <Card title="Thông tin tài khoản">
          <dl className="mod-facts">
            <div>
              <dt>Vai trò</dt>
              <dd>Mod (kiểm duyệt viên)</dd>
            </div>
            <div>
              <dt>Ngày tạo</dt>
              <dd>{modDateTime(mod.createdAt, "—")}</dd>
            </div>
            <div>
              <dt>Đăng nhập gần nhất</dt>
              <dd>{modDateTime(mod.lastLoginAt)}</dd>
            </div>
          </dl>
          <form
            className="mod-rename"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const found = displayNameProblem(draftName);
              setNameError(found);
              if (found || !nameChanged) return;
              void save(
                "name",
                { displayName: draftName.trim() },
                `Đã đổi tên hiển thị thành “${draftName.trim()}”.`,
              );
            }}
          >
            <Field
              label="Tên hiển thị"
              placeholder="Ví dụ: Mod Linh"
              value={draftName}
              error={nameError}
              helper="Từ 2 đến 100 ký tự."
              onChange={(event) => {
                setName(event.target.value);
                setNameError("");
              }}
            />
            <div className="actions">
              <Button
                type="submit"
                variant="secondary"
                disabled={!nameChanged}
                loading={saving === "name"}
              >
                Lưu tên
              </Button>
              {nameChanged && (
                <Button
                  variant="tertiary"
                  onClick={() => {
                    setName(null);
                    setNameError("");
                  }}
                >
                  Hoàn tác
                </Button>
              )}
            </div>
          </form>
          <p className="helper">
            Mỗi tài khoản chỉ có một vai trò nên không đổi Mod sang vai trò
            khác. Muốn thôi giao việc kiểm duyệt, hãy vô hiệu hóa tài khoản.
          </p>
        </Card>

        <Card title="Quyền đang có">
          <p className="mod-permission-count">
            <strong>{mod.permissions.effective.length}</strong> quyền hiệu lực ·{" "}
            {mod.permissions.overrides.length} ghi đè riêng
          </p>
          {mod.permissions.effective.length ? (
            <ul className="mod-chips">
              {mod.permissions.effective.map((code) => (
                <li key={code} title={code}>
                  {descriptions.get(code) ?? code}
                </li>
              ))}
            </ul>
          ) : (
            <p className="helper">Mod này hiện không có quyền nào.</p>
          )}
          <Link
            className="button button-secondary"
            href={`${base}/permissions?tab=mods&mod=${mod.id}`}
          >
            <ShieldCheckIcon className="mod-button-icon" aria-hidden /> Chỉnh
            phân quyền
          </Link>
        </Card>
      </div>

      <Card
        title={active ? "Vô hiệu hóa tài khoản" : "Kích hoạt lại tài khoản"}
      >
        <p>
          {active
            ? "Mod sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được cho tới khi được kích hoạt lại. Việc đã xử lý và phân quyền vẫn được giữ."
            : "Mod đăng nhập lại được với mật khẩu cũ và dùng các quyền đã cấp như trước."}
        </p>
        {(active || mod.status === "deactivated") && (
          <div className="actions">
            <Button
              variant={active ? "destructive" : "primary"}
              onClick={() => {
                setProblem("");
                setConfirming(true);
              }}
            >
              {active ? "Vô hiệu hóa tài khoản" : "Kích hoạt lại"}
            </Button>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirming}
        title={
          active
            ? `Vô hiệu hóa ${mod.displayName}?`
            : `Kích hoạt lại ${mod.displayName}?`
        }
        danger={active}
        label={active ? "Vô hiệu hóa" : "Kích hoạt lại"}
        loading={saving === "status"}
        onClose={() => {
          if (!saving) setConfirming(false);
        }}
        onConfirm={() =>
          void save(
            "status",
            { status: active ? "deactivated" : "active" },
            active
              ? `Đã vô hiệu hóa ${mod.displayName}; mọi phiên đăng nhập đã bị thu hồi.`
              : `Đã kích hoạt lại ${mod.displayName}.`,
          )
        }
      >
        <p>
          {active
            ? "Mod bị đăng xuất ngay trên mọi thiết bị. Bạn có thể kích hoạt lại bất cứ lúc nào."
            : "Mod sẽ đăng nhập lại được ngay."}
        </p>
        {problem && <Alert>Chưa lưu được. {problem}</Alert>}
      </ConfirmDialog>
    </div>
  );
}
