"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CheckIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Alert, Badge, Button, Card, Input } from "@/shared/ui";
import {
  Avatar,
  Choice,
  ConfirmDialog,
  EmptyState,
  Pagination,
  SelectField,
  Skeleton,
  Tabs,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/workspace";
import { ApiError } from "@/shared/api/error";
import { useRemote } from "@/features/explore/use-remote";
import {
  codesDiff,
  effectivePermissions,
  groupPermissions,
  inCatalogOrder,
  isGrantable,
  overrideChoice,
  overridesBody,
  permissionError,
  sameCodes,
  withOverride,
  type OverrideChoice,
} from "./permission-rules";
import {
  permissionService,
  type PermissionService,
} from "./permission-service";
import type {
  AdminUserCardDto,
  PermissionCatalogDto,
  PermissionDto,
  PermissionOverrideDto,
} from "./permission-types";
import { SlidingSegment } from "@/components/ui/sliding-segment";
import "./permissions.css";

type PermissionTab = "role" | "mods";
const tabs: { value: PermissionTab; label: string }[] = [
  { value: "role", label: "Quyền mặc định của Mod" },
  { value: "mods", label: "Quyền của từng Mod" },
];

/** ADM-M1 page size in the Mod picker (BE allows 1..100). */
const modsPageSize = 20;

const modStatusLabels: Record<string, string> = {
  active: "Đang hoạt động",
  deactivated: "Đã vô hiệu hóa",
};
const statusOptions = [
  { value: "active", label: "Đang hoạt động" },
  { value: "deactivated", label: "Đã vô hiệu hóa" },
  { value: "", label: "Tất cả trạng thái" },
];

const choiceLabels: Record<OverrideChoice, string> = {
  inherit: "Theo mặc định",
  allow: "Cho phép",
  deny: "Chặn",
};

const describe = (
  permissions: readonly PermissionDto[],
  codes: readonly string[],
) =>
  codes
    .map(
      (code) =>
        permissions.find((item) => item.code === code)?.description ?? code,
    )
    .join(", ");

/** The bar that slides up while there are unsaved changes. */
function SaveBar({
  open,
  count,
  saving,
  saveLabel,
  onUndo,
  onSave,
}: {
  open: boolean;
  count: number;
  saving: boolean;
  saveLabel: string;
  onUndo: () => void;
  onSave: () => void;
}) {
  return (
    <div className="permission-savebar" data-open={open} inert={!open}>
      <p role="status">
        {open ? `${count} thay đổi chưa lưu` : "Không có thay đổi"}
      </p>
      <div className="actions">
        <Button variant="tertiary" disabled={saving} onClick={onUndo}>
          Hoàn tác
        </Button>
        <Button loading={saving} onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

/** ADM-P1 + ADM-P4: one switch per permission; the admin-only ones are shown locked. */
function RoleDefaultsPanel({
  catalog,
  service,
  onSaved,
}: {
  catalog: PermissionCatalogDto;
  service: PermissionService;
  onSaved: (codes: string[]) => void;
}) {
  const saved = catalog.roleDefaults.MOD;
  const [draft, setDraft] = useState<string[]>(saved);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const busy = useRef(false);
  const groups = useMemo(
    () => groupPermissions(catalog.permissions),
    [catalog.permissions],
  );
  const grantable = catalog.permissions.filter((item) =>
    isGrantable(item.code),
  );
  const dirty = !sameCodes(draft, saved);
  const diff = codesDiff(saved, draft);

  async function save() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setProblem("");
    try {
      const result = await service.replaceRoleDefaults(
        inCatalogOrder(draft, catalog.permissions),
      );
      setConfirming(false);
      setDraft(result.permissionCodes);
      onSaved(result.permissionCodes);
      setDone(
        "Đã lưu quyền mặc định. Mod không có ghi đè riêng dùng bộ quyền này từ lần thao tác kế tiếp.",
      );
    } catch (caught) {
      setProblem(permissionError(caught));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="permission-panel">
      <div className="permission-summary">
        <ShieldCheckIcon aria-hidden />
        <p>
          Mod mới và Mod không có ghi đè riêng có{" "}
          <strong>
            {draft.length}/{grantable.length}
          </strong>{" "}
          quyền có thể cấp. Quản trị viên luôn có mọi quyền.
        </p>
      </div>
      {done && !dirty && <Alert tone="success">{done}</Alert>}
      <div className="permission-groups">
        {groups.map((group) => {
          const on = group.permissions.filter((item) =>
            draft.includes(item.code),
          ).length;
          return (
            <section
              key={group.key}
              className="permission-group"
              aria-labelledby={`role-${group.key}`}
            >
              <header>
                <h3 id={`role-${group.key}`}>{group.title}</h3>
                <span>
                  {on}/{group.permissions.length} bật
                </span>
              </header>
              <ul>
                {group.permissions.map((item) => {
                  const locked = !isGrantable(item.code);
                  const checked = draft.includes(item.code);
                  return (
                    <li
                      key={item.code}
                      className="acl-row"
                      data-changed={checked !== saved.includes(item.code)}
                      data-locked={locked || undefined}
                    >
                      <div className="permission-text">
                        <strong>{item.description}</strong>
                        <code>{item.code}</code>
                      </div>
                      {locked ? (
                        <span className="permission-lock">
                          <LockClosedIcon aria-hidden /> Chỉ quản trị viên
                        </span>
                      ) : (
                        <Choice
                          kind="switch"
                          label={item.description}
                          checked={checked}
                          onChange={(value) => {
                            setDone("");
                            setDraft((current) =>
                              value
                                ? [...current, item.code]
                                : current.filter((code) => code !== item.code),
                            );
                          }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <SaveBar
        open={dirty}
        count={diff.added.length + diff.removed.length}
        saving={saving}
        saveLabel="Lưu quyền mặc định"
        onUndo={() => {
          setDraft(saved);
          setProblem("");
        }}
        onSave={() => {
          setProblem("");
          setConfirming(true);
        }}
      />
      <ConfirmDialog
        open={confirming}
        title="Đổi quyền mặc định của Mod?"
        label="Lưu thay đổi"
        loading={saving}
        onClose={() => {
          if (!saving) setConfirming(false);
        }}
        onConfirm={() => void save()}
      >
        <div className="stack-sm">
          <p>
            Thay đổi áp dụng cho mọi Mod, trừ quyền đã được ghi đè riêng cho
            từng người, từ lần thao tác kế tiếp của họ.
          </p>
          {diff.added.length > 0 && (
            <p>
              <strong>Bật thêm:</strong>{" "}
              {describe(catalog.permissions, diff.added)}
            </p>
          )}
          {diff.removed.length > 0 && (
            <p>
              <strong>Tắt:</strong>{" "}
              {describe(catalog.permissions, diff.removed)}
            </p>
          )}
          {problem && <Alert>Chưa lưu được. {problem}</Alert>}
        </div>
      </ConfirmDialog>
    </div>
  );
}

/** Three choices of one permission for one Mod, as a radio group that looks like a toggle. */
export function OverrideControl({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: OverrideChoice;
  onChange: (value: OverrideChoice) => void;
}) {
  return (
    <SlidingSegment
      className="permission-segmented"
      role="radiogroup"
      aria-label={label}
    >
      {(["inherit", "allow", "deny"] as const).map((choice) => (
        <label key={choice} data-choice={choice}>
          <input
            type="radio"
            name={name}
            value={choice}
            checked={value === choice}
            onChange={() => onChange(choice)}
          />
          <span>{choiceLabels[choice]}</span>
        </label>
      ))}
    </SlidingSegment>
  );
}

/** ADM-P2 + ADM-P3 for one Mod: defaults, overrides being edited and the effective result. */
function ModEditor({
  mod,
  catalog,
  service,
  onDirtyChange,
  onMissing,
}: {
  mod: AdminUserCardDto;
  catalog: PermissionCatalogDto;
  service: PermissionService;
  onDirtyChange: (dirty: boolean) => void;
  onMissing: () => void;
}) {
  const [version, setVersion] = useState(0);
  const [state, retry] = useRemote(
    () => service.modPermissions(mod.id),
    `${mod.id}:${version}`,
  );
  const [saved, setSaved] = useState<PermissionOverrideDto[] | null>(null);
  const [draft, setDraft] = useState<PermissionOverrideDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const busy = useRef(false);
  const name = useId();
  // A fresh ADM-P2 answer becomes both the saved state and the draft.
  const answer = state.status === "ready" ? state.data : null;
  const [seen, setSeen] = useState<typeof answer>(null);
  if (answer && answer !== seen) {
    setSeen(answer);
    setSaved(answer.overrides);
    setDraft(answer.overrides);
  }
  const groups = useMemo(
    () => groupPermissions(catalog.permissions),
    [catalog.permissions],
  );
  const body = overridesBody(draft, catalog.permissions);
  const before = saved ? overridesBody(saved, catalog.permissions) : [];
  const changes = catalog.permissions.filter(
    (item) =>
      overrideChoice(body, item.code) !== overrideChoice(before, item.code),
  ).length;
  const dirty = saved !== null && changes > 0;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const missing =
    state.status === "error" &&
    state.error instanceof ApiError &&
    state.error.errorCode === "MOD_NOT_FOUND";

  if (state.status === "loading" || (answer && saved === null))
    return <Skeleton rows={6} />;
  if (state.status === "error")
    return (
      <Card title="Chưa tải được quyền của Mod">
        <Alert>{permissionError(state.error)}</Alert>
        <div className="actions">
          {missing ? (
            <Button variant="secondary" onClick={onMissing}>
              Chọn Mod khác
            </Button>
          ) : (
            <Button onClick={retry}>Thử lại</Button>
          )}
        </div>
      </Card>
    );
  const roleDefaults = state.data.roleDefaults;
  const effective = effectivePermissions(roleDefaults, body);
  const grantable = catalog.permissions.filter((item) =>
    isGrantable(item.code),
  );

  async function save() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setProblem("");
    try {
      const result = await service.replaceModPermissions(mod.id, body);
      // `seen` stays the ADM-P2 answer: replacing it with this one made the next render take
      // the older ADM-P2 overrides for a fresh answer and put them back on screen.
      setSaved(result.overrides);
      setDraft(result.overrides);
      setDone(
        `Đã lưu quyền của ${mod.displayName}. Quyền mới có hiệu lực từ lần thao tác kế tiếp.`,
      );
    } catch (caught) {
      setProblem(permissionError(caught));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="permission-panel">
      <header className="permission-mod-head">
        <Avatar name={mod.displayName} image={mod.avatarUrl} />
        <div>
          <h3>{mod.displayName}</h3>
          <p className="helper">{mod.email}</p>
        </div>
        <div className="permission-mod-stats">
          <span>
            <strong>
              {[...effective].filter((code) => isGrantable(code)).length}/
              {grantable.length}
            </strong>{" "}
            quyền hiệu lực
          </span>
          <span>
            <strong>{body.length}</strong> ghi đè riêng
          </span>
        </div>
      </header>
      {mod.status !== "active" && (
        <Alert tone="warning">
          Tài khoản này đang bị vô hiệu hóa: quyền vẫn được lưu và áp dụng khi
          tài khoản được kích hoạt lại.
        </Alert>
      )}
      {done && !dirty && <Alert tone="success">{done}</Alert>}
      {problem && <Alert>Chưa lưu được. {problem}</Alert>}
      <div className="permission-groups">
        {groups.map((group) => (
          <section
            key={group.key}
            className="permission-group"
            aria-labelledby={`mod-${group.key}`}
          >
            <header>
              <h3 id={`mod-${group.key}`}>{group.title}</h3>
              <span>
                {
                  group.permissions.filter((item) => effective.has(item.code))
                    .length
                }
                /{group.permissions.length} hiệu lực
              </span>
            </header>
            <ul>
              {group.permissions.map((item) => {
                const locked = !isGrantable(item.code);
                const choice = overrideChoice(body, item.code);
                const isDefault = roleDefaults.includes(item.code);
                const on = effective.has(item.code);
                return (
                  <li
                    key={item.code}
                    className="acl-row is-mod"
                    data-changed={choice !== overrideChoice(before, item.code)}
                    data-locked={locked || undefined}
                  >
                    <div className="permission-text">
                      <strong>{item.description}</strong>
                      <code>{item.code}</code>
                    </div>
                    <div className="acl-controls">
                      <span
                        className="permission-default"
                        data-on={isDefault}
                        title="Quyền mặc định của role MOD"
                      >
                        {isDefault ? (
                          <CheckIcon aria-hidden />
                        ) : (
                          <MinusIcon aria-hidden />
                        )}
                        {isDefault ? "Mặc định có" : "Mặc định không"}
                      </span>
                      {locked ? (
                        <span className="permission-lock">
                          <LockClosedIcon aria-hidden /> Chỉ quản trị viên
                        </span>
                      ) : (
                        <OverrideControl
                          name={`${name}-${item.code}`}
                          label={`${item.description}: ghi đè cho ${mod.displayName}`}
                          value={choice}
                          onChange={(next) => {
                            setDone("");
                            setDraft((current) =>
                              withOverride(current, item.code, next),
                            );
                          }}
                        />
                      )}
                      <span
                        className="permission-effective"
                        data-on={on}
                        aria-label={on ? "Được dùng" : "Không được dùng"}
                      >
                        {on ? "Được dùng" : "Không"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className="permission-mod-foot">
        <Button
          variant="tertiary"
          disabled={body.length === 0 || saving}
          onClick={() => {
            setDone("");
            setDraft([]);
          }}
        >
          Bỏ mọi ghi đè, dùng quyền mặc định
        </Button>
        <Button variant="tertiary" onClick={() => setVersion((v) => v + 1)}>
          Tải lại
        </Button>
      </div>
      <SaveBar
        open={dirty}
        count={changes}
        saving={saving}
        saveLabel={`Lưu quyền của ${mod.displayName}`}
        onUndo={() => {
          setDraft(saved ?? []);
          setProblem("");
        }}
        onSave={() => void save()}
      />
    </div>
  );
}

/** ADM-M1 picker on the left, the chosen Mod's editor on the right. */
function ModPermissionsPanel({
  catalog,
  service,
  modId,
  onModChange,
}: {
  catalog: PermissionCatalogDto;
  service: PermissionService;
  modId: number | null;
  onModChange: (id: number | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "active" | "deactivated">("active");
  const [page, setPage] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [chosen, setChosen] = useState<AdminUserCardDto | null>(null);
  // The list is asked for 300 ms after the last key, not on every key.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [list, retry] = useRemote(
    () =>
      service.mods({
        q: q || undefined,
        status: status || undefined,
        page,
        pageSize: modsPageSize,
      }),
    `${q}:${status}:${page}`,
  );
  const items = list.status === "ready" ? list.data.items : [];
  const selected =
    (chosen && chosen.id === modId ? chosen : null) ??
    items.find((item) => item.id === modId) ??
    null;

  const pick = (mod: AdminUserCardDto) => {
    if (mod.id === modId) return;
    if (dirty) setPending(mod.id);
    else {
      setChosen(mod);
      onModChange(mod.id);
    }
  };
  const pendingMod = items.find((item) => item.id === pending) ?? null;

  return (
    <div className="permission-mods">
      <aside className="permission-picker" aria-label="Chọn Mod">
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
        <SelectField
          label="Trạng thái"
          value={status}
          options={statusOptions}
          onChange={(value) => {
            setStatus(value as typeof status);
            setPage(1);
          }}
        />
        {list.status === "loading" && <Skeleton rows={4} />}
        {list.status === "error" && (
          <div className="stack-sm">
            <Alert>{permissionError(list.error)}</Alert>
            <Button variant="secondary" onClick={retry}>
              Thử lại
            </Button>
          </div>
        )}
        {list.status === "ready" &&
          (items.length === 0 ? (
            <p className="helper">
              {q
                ? "Không có Mod khớp từ khóa này."
                : "Chưa có tài khoản Mod nào."}
            </p>
          ) : (
            <ul className="permission-mod-list">
              {items.map((mod) => (
                <li key={mod.id}>
                  <button
                    type="button"
                    aria-pressed={mod.id === modId}
                    onClick={() => pick(mod)}
                  >
                    <Avatar name={mod.displayName} image={mod.avatarUrl} />
                    <span>
                      <strong>{mod.displayName}</strong>
                      <small>{mod.email}</small>
                    </span>
                    {mod.status !== "active" && (
                      <Badge tone="warning">
                        {modStatusLabels[mod.status] ?? mod.status}
                      </Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ))}
        {list.status === "ready" && list.data.totalPages > 1 && (
          <Pagination
            total={list.data.totalItems}
            page={list.data.page}
            size={list.data.pageSize}
            onChange={setPage}
          />
        )}
      </aside>
      <div className="permission-detail">
        {modId === null || !selected ? (
          modId !== null && list.status === "loading" ? (
            <Skeleton rows={6} />
          ) : (
            <EmptyState title="Chọn một Mod">
              {modId !== null
                ? "Mod này không có trong danh sách đang lọc. Hãy đổi bộ lọc hoặc chọn Mod khác."
                : "Chọn một Mod ở danh sách bên trái để xem và chỉnh quyền riêng của người đó."}
            </EmptyState>
          )
        ) : (
          <ModEditor
            key={selected.id}
            mod={selected}
            catalog={catalog}
            service={service}
            onDirtyChange={setDirty}
            onMissing={() => onModChange(null)}
          />
        )}
      </div>
      <ConfirmDialog
        open={pending !== null}
        title="Bỏ thay đổi chưa lưu?"
        label="Bỏ thay đổi"
        cancelLabel="Tiếp tục chỉnh"
        destructive
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pendingMod) {
            setChosen(pendingMod);
            setDirty(false);
            onModChange(pendingMod.id);
          }
          setPending(null);
        }}
      >
        <p>
          Quyền đang chỉnh của Mod hiện tại chưa được lưu. Chuyển sang{" "}
          {pendingMod?.displayName ?? "Mod khác"} sẽ bỏ các thay đổi này.
        </p>
      </ConfirmDialog>
    </div>
  );
}

/**
 * F-66 Manage Permission (Admin): the MOD role defaults (ADM-P1, ADM-P4) and the overrides of
 * each Mod (ADM-M1, ADM-P2, ADM-P3). The tab and the chosen Mod live in the URL.
 */
export function PermissionsPage({
  initialModId,
  service = permissionService,
}: {
  initialModId?: number;
  service?: PermissionService;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const modParam = Number(params.get("mod"));
  const modId =
    Number.isInteger(modParam) && modParam > 0
      ? modParam
      : (initialModId ?? null);
  const tab: PermissionTab =
    tabParam === "mods" || tabParam === "role"
      ? tabParam
      : initialModId
        ? "mods"
        : "role";
  const [catalogState, retry] = useRemote(() => service.catalog(), "catalog");
  // ADM-P4's answer replaces the MOD defaults shown without asking ADM-P1 again.
  const [roleDefaults, setRoleDefaults] = useState<string[] | null>(null);

  const go = (next: { tab?: PermissionTab; mod?: number | null }) => {
    const query = new URLSearchParams(params.toString());
    if (next.tab) query.set("tab", next.tab);
    if (next.mod !== undefined) {
      if (next.mod === null) query.delete("mod");
      else query.set("mod", String(next.mod));
    }
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

  const heading = (
    <PageHeading
      title="Phân quyền"
      description="Quản lý quyền truy cập của Mod theo chính sách phân quyền của ANGI: bộ quyền mặc định của role MOD và ghi đè riêng cho từng người."
    />
  );
  if (catalogState.status === "loading")
    return (
      <div className="stack permission-page">
        {heading}
        <Skeleton rows={6} />
      </div>
    );
  if (catalogState.status === "error")
    return (
      <div className="stack permission-page">
        {heading}
        <Card title="Chưa tải được danh mục quyền">
          <Alert>{permissionError(catalogState.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      </div>
    );
  const catalog: PermissionCatalogDto = roleDefaults
    ? {
        ...catalogState.data,
        roleDefaults: { ...catalogState.data.roleDefaults, MOD: roleDefaults },
      }
    : catalogState.data;

  return (
    <div className="stack permission-page">
      {heading}
      <Tabs
        label="Phạm vi phân quyền"
        value={tab}
        items={tabs}
        onChange={(value) => go({ tab: value as PermissionTab })}
      />
      {tab === "role" ? (
        <RoleDefaultsPanel
          catalog={catalog}
          service={service}
          onSaved={setRoleDefaults}
        />
      ) : (
        <ModPermissionsPanel
          catalog={catalog}
          service={service}
          modId={modId}
          onModChange={(mod) => go({ mod })}
        />
      )}
    </div>
  );
}
