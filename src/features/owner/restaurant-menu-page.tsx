"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  ConfirmDialog,
  EmptyState,
  Media,
  Skeleton,
  Tabs,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/page-heading";
import { dateLabel, money } from "@/shared/format";
import { ApiError } from "@/shared/api/error";
import { ownerRoutes, ownerVerificationHref } from "./routes";
import type { OwnerRestaurantDto } from "./restaurant-types";
import type {
  MenuDetailDto,
  MenuItemDto,
  OwnerMenuDishDto,
  OwnerMenuDto,
  MenuSubmissionDto,
} from "./menu-types";
import { restaurantMenuService } from "./menu-service";
import {
  dishFormLabels,
  menuErrorMessage,
  menuStatusLabels,
  openMenuId,
} from "./menu-rules";
import { MenuItemEditor } from "./menu-item-editor";
import { MenuHistory } from "./menu-history";
import { MenuApprovalSubmit } from "./menu-approval-submit";
import "./restaurant-menu.css";

type Confirmation =
  | { kind: "availability"; dish: OwnerMenuDishDto }
  | { kind: "remove"; item: MenuItemDto; submissionId: number }
  | { kind: "cancel"; submissionId: number };
export function RestaurantMenuPage() {
  const service = restaurantMenuService;
  const [state, setState] = useState<{
    loading: boolean;
    restaurant?: OwnerRestaurantDto;
    menu?: OwnerMenuDto;
    error?: unknown;
  }>({ loading: true });
  const [tab, setTab] = useState("current"),
    [detail, setDetail] = useState<MenuDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false),
    [detailError, setDetailError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null),
    [existingId, setExistingId] = useState<number | null>(null);
  const [problem, setProblem] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirmation | null>(null),
    [editor, setEditor] = useState<{ item?: MenuItemDto } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [approvalNotes, setApprovalNotes] = useState<Record<number, string>>(
    {},
  );
  const active = useRef(true),
    locked = useRef(false),
    detailSequence = useRef(0);
  const editorTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const load = useCallback(async () => {
    setState({ loading: true });
    try {
      const [restaurant, menu] = await Promise.all([
        service.getRestaurant(),
        service.getMenu(),
      ]);
      if (active.current) setState({ loading: false, restaurant, menu });
    } catch (error) {
      if (active.current) setState({ loading: false, error });
    }
  }, [service]);
  useEffect(() => {
    let ignore = false;
    Promise.all([service.getRestaurant(), service.getMenu()])
      .then(([restaurant, menu]) => {
        if (!ignore) setState({ loading: false, restaurant, menu });
      })
      .catch((error) => {
        if (!ignore) setState({ loading: false, error });
      });
    return () => {
      ignore = true;
    };
  }, [service]);
  async function open(id: number) {
    const sequence = ++detailSequence.current;
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setDetailError("");
    setTab("draft");
    try {
      const result = await service.detail(id);
      if (active.current && sequence === detailSequence.current)
        setDetail(result);
    } catch (error) {
      if (active.current && sequence === detailSequence.current)
        setDetailError(menuErrorMessage(error));
    } finally {
      if (active.current && sequence === detailSequence.current)
        setDetailLoading(false);
    }
  }
  function updateMenu(update: (value: OwnerMenuDto) => OwnerMenuDto) {
    setState((previous) =>
      previous.menu ? { ...previous, menu: update(previous.menu) } : previous,
    );
  }
  async function act(operation: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setProblem("");
    setSuccess("");
    setExistingId(null);
    try {
      await operation();
    } catch (error) {
      if (active.current) {
        setProblem(menuErrorMessage(error));
        setExistingId(openMenuId(error));
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  function create() {
    void act(async () => {
      const result = await service.create();
      if (!active.current) return;
      updateMenu((menu) => ({
        ...menu,
        openSubmission: { id: result.id, status: "draft" },
      }));
      setHistoryVersion((value) => value + 1);
      setSuccess("Đã tạo bản nháp từ thực đơn hiện tại.");
      await open(result.id);
    });
  }
  function executeConfirm() {
    if (!confirm) return;
    const action = confirm;
    void act(async () => {
      if (action.kind === "availability") {
        const result = await service.availability(
          action.dish.id,
          !action.dish.isAvailable,
        );
        if (!active.current) return;
        updateMenu((menu) => ({
          ...menu,
          dishes: menu.dishes.map((dish) =>
            dish.id === result.dishId
              ? { ...dish, isAvailable: result.isAvailable }
              : dish,
          ),
        }));
        setSuccess("Đã cập nhật tình trạng phục vụ món.");
      } else if (action.kind === "remove") {
        await service.remove(action.submissionId, action.item.id);
        if (!active.current) return;
        setSuccess(
          "Đã xóa món khỏi bản nháp. Thực đơn đang bán vẫn được giữ nguyên.",
        );
        await open(action.submissionId);
      } else {
        const result = await service.cancel(action.submissionId);
        if (!active.current) return;
        updateMenu((menu) => ({ ...menu, openSubmission: null }));
        setDetail((previous) =>
          previous?.id === result.id ? { ...previous, ...result } : previous,
        );
        setSuccess(
          "Đã hủy bản thực đơn. Thực đơn đang bán vẫn được giữ nguyên.",
        );
      }
      if (active.current) {
        setConfirm(null);
        setHistoryVersion((value) => value + 1);
      }
    });
  }
  function submitted(result: MenuSubmissionDto) {
    setDetail((previous) =>
      previous?.id === result.id ? { ...previous, ...result } : previous,
    );
    updateMenu((menu) => ({
      ...menu,
      openSubmission:
        result.status === "draft" || result.status === "pending"
          ? { id: result.id, status: result.status }
          : null,
    }));
    setApprovalNotes((previous) => {
      const next = { ...previous };
      delete next[result.id];
      return next;
    });
    setHistoryVersion((value) => value + 1);
    setProblem("");
    setSuccess(
      result.status === "pending"
        ? "Đã gửi thực đơn để duyệt. Trạng thái: Chờ duyệt."
        : `Trạng thái thực đơn: ${menuStatusLabels[result.status]}.`,
    );
  }
  const menu = state.menu,
    restaurant = state.restaurant,
    disabled = busy || detailLoading;
  const editable = detail?.status === "draft";
  return (
    <div className="stack form-page menu-workspace">
      <PageHeading
        eyebrow="Nhà hàng của tôi"
        title="Quản lý thực đơn"
        description="Quản lý món đang bán và chuẩn bị thay đổi trong bản nháp riêng."
      />
      {state.loading ? (
        <Skeleton />
      ) : state.error ? (
        <Card>
          <div className="stack">
            <Alert tone="error">{menuErrorMessage(state.error)}</Alert>
            {state.error instanceof ApiError &&
            state.error.errorCode === "RESTAURANT_NOT_FOUND" ? (
              <ActionLink href={ownerRoutes.register}>
                Đăng ký nhà hàng
              </ActionLink>
            ) : (
              <Button onClick={() => void load()}>Thử lại thực đơn</Button>
            )}
          </div>
        </Card>
      ) : (
        menu &&
        restaurant && (
          <>
            {problem && <Alert tone="error">{problem}</Alert>}
            {existingId && (
              <Button
                variant="secondary"
                disabled={disabled}
                onClick={() => {
                  setExistingId(null);
                  void open(existingId);
                }}
              >
                Mở bản thực đơn hiện có
              </Button>
            )}
            {success && <p role="status">{success}</p>}
            <div className="between menu-pagination">
              <strong>{restaurant.name}</strong>
              <Button
                variant="secondary"
                disabled={disabled}
                onClick={() => {
                  void load();
                  if (selectedId) void open(selectedId);
                  setHistoryVersion((value) => value + 1);
                }}
              >
                Tải lại dữ liệu
              </Button>
            </div>
            {restaurant.verificationStatus !== "verified" && (
              <Alert tone="warning">
                Nhà hàng cần được xác minh trước khi tạo bản nháp thực đơn.{" "}
                <Link href={ownerVerificationHref()} className="text-link">
                  Xem hồ sơ xác minh
                </Link>
              </Alert>
            )}
            <Tabs
              label="Quản lý thực đơn"
              value={tab}
              onChange={(value) => {
                if (!disabled) setTab(value);
              }}
              items={[
                { value: "current", label: "Đang bán" },
                { value: "draft", label: "Bản thực đơn" },
                { value: "history", label: "Lịch sử" },
              ]}
            />
            {tab === "current" && (
              <Card title={`Thực đơn đang bán · ${menu.dishes.length} món`}>
                <div className="stack">
                  {menu.openSubmission ? (
                    <div className="between menu-pagination">
                      <p>
                        {menuStatusLabels[menu.openSubmission.status]} #
                        {menu.openSubmission.id}. Bạn chỉ có thể mở một bản thực
                        đơn tại một thời điểm.
                      </p>
                      <Button
                        disabled={disabled}
                        onClick={() => void open(menu.openSubmission!.id)}
                      >
                        Mở bản thực đơn
                      </Button>
                    </div>
                  ) : (
                    <Button
                      disabled={
                        disabled || restaurant.verificationStatus !== "verified"
                      }
                      loading={busy}
                      onClick={create}
                    >
                      Tạo bản nháp
                    </Button>
                  )}
                  {!menu.dishes.length ? (
                    <EmptyState title="Thực đơn đang bán chưa có món">
                      Tạo bản nháp để chuẩn bị các món ăn của nhà hàng.
                    </EmptyState>
                  ) : (
                    <ul className="menu-list">
                      {menu.dishes.map((dish) => (
                        <li className="menu-dish-row" key={dish.id}>
                          <Media
                            src={dish.coverUrl ?? undefined}
                            alt={dish.name}
                          />
                          <div className="menu-dish-copy">
                            <h3>{dish.name}</h3>
                            <p>
                              {money(dish.price)} ·{" "}
                              {dishFormLabels[dish.dishForm]}
                            </p>
                            <p>
                              {dish.tags.map((tag) => tag.name).join(" · ")}
                            </p>
                            <div className="actions">
                              <Badge>
                                {dish.isAvailable ? "Còn món" : "Hết món"}
                              </Badge>
                              {dish.status === "hidden" && (
                                <Badge>Đang ẩn</Badge>
                              )}
                            </div>
                          </div>
                          <div className="actions">
                            <Button
                              variant="secondary"
                              disabled={disabled}
                              aria-label={`${dish.isAvailable ? "Đánh dấu hết món" : "Đánh dấu còn món"}: ${dish.name}`}
                              onClick={() =>
                                setConfirm({ kind: "availability", dish })
                              }
                            >
                              {dish.isAvailable
                                ? "Đánh dấu hết món"
                                : "Đánh dấu còn món"}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            )}
            {tab === "history" && (
              <MenuHistory
                key={historyVersion}
                service={service}
                onOpen={(id) => void open(id)}
                disabled={disabled}
              />
            )}
            {tab === "draft" && (
              <Card
                title={detail ? `Bản thực đơn #${detail.id}` : "Bản thực đơn"}
              >
                <div className="stack">
                  {detailLoading ? (
                    <Skeleton />
                  ) : detailError ? (
                    <>
                      <Alert tone="error">{detailError}</Alert>
                      <Button
                        onClick={() => {
                          if (selectedId) void open(selectedId);
                        }}
                      >
                        Tải lại bản thực đơn
                      </Button>
                    </>
                  ) : detail ? (
                    <>
                      <div className="between menu-pagination">
                        <Badge>{menuStatusLabels[detail.status]}</Badge>
                        <div className="actions">
                          {editable && (
                            <Button
                              disabled={disabled}
                              onClick={(event) => {
                                editorTrigger.current = event.currentTarget;
                                setEditor({});
                              }}
                            >
                              Thêm món
                            </Button>
                          )}
                          {["draft", "pending"].includes(detail.status) && (
                            <Button
                              variant="destructive"
                              disabled={disabled}
                              onClick={() =>
                                setConfirm({
                                  kind: "cancel",
                                  submissionId: detail.id,
                                })
                              }
                            >
                              Hủy bản thực đơn
                            </Button>
                          )}
                        </div>
                      </div>
                      <Alert tone="info">
                        {editable
                          ? "Bạn đang chỉnh sửa bản nháp. Các thay đổi chỉ được áp dụng vào thực đơn đang bán sau khi được nộp và duyệt."
                          : "Bản thực đơn này chỉ được xem, không thể sửa món."}
                      </Alert>
                      {editable && (
                        <MenuApprovalSubmit
                          detail={detail}
                          note={
                            approvalNotes[detail.id] ?? detail.ownerNote ?? ""
                          }
                          onNoteChange={(value) =>
                            setApprovalNotes((previous) => ({
                              ...previous,
                              [detail.id]: value,
                            }))
                          }
                          service={service}
                          disabled={disabled}
                          onSubmitted={submitted}
                          onRefresh={() => {
                            void open(detail.id);
                            void service
                              .getMenu()
                              .then((menu) => {
                                if (active.current)
                                  setState((previous) => ({
                                    ...previous,
                                    menu,
                                  }));
                              })
                              .catch((error) => {
                                if (active.current)
                                  setProblem(menuErrorMessage(error));
                              });
                          }}
                        />
                      )}
                      <dl className="menu-meta">
                        <div>
                          <dt>Ngày tạo</dt>
                          <dd>{dateLabel(detail.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>Ngày nộp</dt>
                          <dd>
                            {detail.submittedAt
                              ? dateLabel(detail.submittedAt)
                              : "Chưa nộp"}
                          </dd>
                        </div>
                        <div>
                          <dt>Người duyệt</dt>
                          <dd>{detail.reviewedBy?.displayName ?? "Chưa có"}</dd>
                        </div>
                        <div>
                          <dt>Ngày duyệt</dt>
                          <dd>
                            {detail.reviewedAt
                              ? dateLabel(detail.reviewedAt)
                              : "Chưa duyệt"}
                          </dd>
                        </div>
                        <div>
                          <dt>Ghi chú của bạn</dt>
                          <dd>{detail.ownerNote ?? "Không có"}</dd>
                        </div>
                        <div>
                          <dt>Phản hồi kiểm duyệt</dt>
                          <dd>{detail.reviewNote ?? "Chưa có phản hồi"}</dd>
                        </div>
                      </dl>
                      {!detail.items.length ? (
                        <EmptyState title="Bản thực đơn chưa có món" />
                      ) : (
                        <ul className="menu-list">
                          {[...detail.items]
                            .sort(
                              (a, b) =>
                                a.sortOrder - b.sortOrder || a.id - b.id,
                            )
                            .map((item) => (
                              <li className="menu-dish-row" key={item.id}>
                                <Media
                                  src={item.coverUrl ?? undefined}
                                  alt={item.name}
                                />
                                <div className="menu-dish-copy">
                                  <h3>{item.name}</h3>
                                  <p>
                                    {money(item.price)} ·{" "}
                                    {dishFormLabels[item.dishForm]} · Thứ tự{" "}
                                    {item.sortOrder}
                                  </p>
                                  <Badge>
                                    {
                                      {
                                        new: "Món mới",
                                        edited: "Đã sửa",
                                        unchanged: "Không đổi",
                                      }[item.change]
                                    }
                                  </Badge>
                                  <p>{item.description ?? "Chưa có mô tả"}</p>
                                </div>
                                {editable && (
                                  <div className="actions">
                                    <Button
                                      variant="secondary"
                                      disabled={disabled}
                                      aria-label={`Sửa ${item.name}`}
                                      onClick={(event) => {
                                        editorTrigger.current =
                                          event.currentTarget;
                                        setEditor({ item });
                                      }}
                                    >
                                      Sửa
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      disabled={disabled}
                                      aria-label={`Xóa ${item.name}`}
                                      onClick={() =>
                                        setConfirm({
                                          kind: "remove",
                                          item,
                                          submissionId: detail.id,
                                        })
                                      }
                                    >
                                      Xóa
                                    </Button>
                                  </div>
                                )}
                              </li>
                            ))}
                        </ul>
                      )}
                      {!!detail.removedDishes.length && (
                        <section className="stack-sm">
                          <h3>Món đã bỏ so với thực đơn đang bán</h3>
                          <ul>
                            {detail.removedDishes.map((dish) => (
                              <li key={dish.id}>
                                {dish.name} · {money(dish.price)}
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </>
                  ) : menu.openSubmission ? (
                    <Button
                      disabled={disabled}
                      onClick={() => void open(menu.openSubmission!.id)}
                    >
                      Mở bản thực đơn
                    </Button>
                  ) : (
                    <EmptyState
                      title="Chưa có bản thực đơn đang mở"
                      action={
                        <Button
                          disabled={
                            disabled ||
                            restaurant.verificationStatus !== "verified"
                          }
                          onClick={create}
                        >
                          Tạo bản nháp
                        </Button>
                      }
                    />
                  )}
                </div>
              </Card>
            )}
          </>
        )
      )}
      {editor && detail && (
        <MenuItemEditor
          item={editor.item}
          submissionId={detail.id}
          service={service}
          onClose={() => {
            setEditor(null);
            requestAnimationFrame(() => {
              if (editorTrigger.current?.isConnected)
                editorTrigger.current.focus();
            });
          }}
          onSaved={() => {
            setEditor(null);
            setSuccess("Đã lưu món vào bản nháp.");
            setHistoryVersion((value) => value + 1);
            void open(detail.id);
          }}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === "remove"
            ? "Xóa món khỏi bản nháp?"
            : confirm?.kind === "cancel"
              ? "Hủy bản thực đơn?"
              : "Cập nhật tình trạng phục vụ?"
        }
        destructive={confirm?.kind !== "availability"}
        loading={busy}
        onClose={() => {
          if (!locked.current) setConfirm(null);
        }}
        onConfirm={executeConfirm}
      >
        <p>
          {confirm?.kind === "remove"
            ? `Xóa “${confirm.item.name}” khỏi bản nháp. Món đang bán chưa bị xóa.`
            : confirm?.kind === "cancel"
              ? "Các thay đổi trong bản này sẽ không được áp dụng. Thực đơn đang bán được giữ nguyên."
              : confirm
                ? `Đánh dấu “${confirm.dish.name}” là ${confirm.dish.isAvailable ? "hết món" : "còn món"}. Thay đổi này có hiệu lực ngay.`
                : ""}
        </p>
        {problem && <Alert tone="error">{problem}</Alert>}
      </ConfirmDialog>
    </div>
  );
}
