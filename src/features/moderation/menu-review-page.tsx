"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ClockIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ConfirmDialog,
  EmptyState,
  Media,
  Pagination,
  Skeleton,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { ApiError } from "@/shared/api/error";
import { money } from "@/shared/format";
import { useRemote } from "@/features/explore/use-remote";
import { exploreService } from "@/features/explore/explore-service";
import { verificationDateLabel } from "@/features/owner/verification-details";
import { dishFormLabels, menuStatusLabels } from "@/features/owner/menu-rules";
import type { MenuDishDto } from "@/features/owner/menu-types";
import { waitingFor } from "./verification-review-rules";
import {
  itemChanges,
  itemCounts,
  menuDecisionProblem,
  menuNoteMax,
  menuQueueTabs,
  menuReviewError,
  menuStatusTone,
  tagNamesOf,
  type ItemFilter,
  type MenuDecision,
} from "./menu-review-rules";
import {
  menuReviewService,
  type MenuReviewService,
} from "./menu-review-service";
import type {
  MenuQueueStatus,
  ModMenuItemDiffDto,
  ModRestaurantMiniDto,
} from "./menu-review-types";
import "./verification-review.css";
import "./menu-review.css";

const pageSize = 20;

const place = (restaurant: ModRestaurantMiniDto) =>
  [restaurant.ward, restaurant.provinceName].filter(Boolean).join(", ");

/** F-58 queue (MOD-M1): one tab per status, with what each submission changes. */
export function MenuQueuePage({
  service = menuReviewService,
}: {
  service?: MenuReviewService;
}) {
  const { base } = useWorkspace();
  const [status, setStatus] = useState<MenuQueueStatus>("pending");
  const [page, setPage] = useState(1);
  const [list, retry] = useRemote(
    () => service.list({ status, page, pageSize }),
    `${status}:${page}`,
  );

  return (
    <div className="stack vr-page">
      <PageHeading
        title="Duyệt thực đơn"
        description="Xem bản thực đơn chủ quán gửi lên, so với thực đơn đang bán, rồi duyệt hoặc từ chối."
      />
      <div className="vr-toolbar">
        <div
          className="vr-tabs"
          role="group"
          aria-label="Trạng thái bản thực đơn"
        >
          {menuQueueTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={status === tab.value}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {list.status === "loading" && <Skeleton rows={4} />}
      {list.status === "error" && (
        <Card title="Chưa tải được hàng đợi thực đơn">
          <Alert>{menuReviewError(list.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      )}
      {list.status === "ready" &&
        (list.data.items.length === 0 ? (
          <EmptyState title="Không có bản thực đơn nào">
            {status === "pending"
              ? "Mọi bản thực đơn chờ duyệt đã được xử lý."
              : "Chưa có bản thực đơn nào ở trạng thái này."}
          </EmptyState>
        ) : (
          <section className="stack-sm" aria-label="Bản thực đơn">
            <p className="helper" role="status">
              {list.data.totalItems} bản thực đơn
            </p>
            <ul className="vr-queue">
              {list.data.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`${base}/menus/${item.id}`}
                    className="vr-card mr-card"
                  >
                    <span className="vr-card-body">
                      <span className="vr-card-head">
                        <strong>{item.restaurant.name}</strong>
                        <Badge tone={menuStatusTone(item.status)}>
                          {menuStatusLabels[item.status]}
                        </Badge>
                        <span className="helper">Bản #{item.id}</span>
                      </span>
                      {place(item.restaurant) && (
                        <small>
                          <MapPinIcon aria-hidden />
                          {place(item.restaurant)}
                        </small>
                      )}
                      <span className="mr-counts">
                        <span data-change="new">+{item.newCount} món mới</span>
                        <span data-change="edited">
                          {item.editedCount} món sửa
                        </span>
                        <span data-change="removed">
                          {item.removedCount} món gỡ
                        </span>
                      </span>
                      {item.ownerNote && (
                        <span className="mr-note">“{item.ownerNote}”</span>
                      )}
                    </span>
                    <span className="vr-card-wait">
                      <ClockIcon aria-hidden />
                      <strong>
                        {item.submittedAt ? waitingFor(item.submittedAt) : "—"}
                      </strong>
                      <small>{verificationDateLabel(item.submittedAt)}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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
    </div>
  );
}

function TagChips({
  ids,
  names,
}: {
  ids: readonly number[];
  names: ReadonlyMap<number, string>;
}) {
  if (!ids.length) return null;
  return (
    <span className="mr-tags">
      {ids.map((id) => (
        <span key={id}>{names.get(id) ?? `Thẻ #${id}`}</span>
      ))}
    </span>
  );
}

/** One submitted dish: new, edited (old → new for what changed) or unchanged. */
function ItemRow({
  item,
  names,
}: {
  item: ModMenuItemDiffDto;
  names: ReadonlyMap<number, string>;
}) {
  const changes = item.change === "edited" ? itemChanges(item, names) : [];
  const coverChanged = changes.some((row) => row.label === "Ảnh món");
  return (
    <li className="mr-item" data-change={item.change}>
      <div className="mr-photos">
        {coverChanged && item.before ? (
          <>
            <Media
              className="mr-photo is-before"
              src={item.before.coverUrl ?? undefined}
              alt={`Ảnh cũ của ${item.before.name}`}
            />
            <ArrowRightIcon aria-hidden />
            <Media
              className="mr-photo"
              src={item.coverUrl ?? undefined}
              alt={`Ảnh mới của ${item.name}`}
            />
          </>
        ) : (
          <Media
            className="mr-photo"
            src={item.coverUrl ?? undefined}
            alt={item.name}
          />
        )}
      </div>
      <div className="mr-item-body">
        <div className="mr-item-head">
          <strong>{item.name}</strong>
          <Badge
            tone={
              item.change === "new"
                ? "success"
                : item.change === "edited"
                  ? "warning"
                  : "neutral"
            }
          >
            {item.change === "new"
              ? "Món mới"
              : item.change === "edited"
                ? "Đã sửa"
                : "Không đổi"}
          </Badge>
        </div>
        <p className="mr-item-meta">
          <strong>{money(item.price)}</strong> · {dishFormLabels[item.dishForm]}
        </p>
        <TagChips ids={item.tagIds} names={names} />
        {item.description && (
          <p className="mr-description">{item.description}</p>
        )}
        {changes.length > 0 && (
          <dl className="mr-changes" aria-label={`Thay đổi của ${item.name}`}>
            {changes.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  <del>{row.before}</del>
                  <ArrowRightIcon aria-hidden />
                  <ins>{row.after}</ins>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </li>
  );
}

function RemovedRow({ dish }: { dish: MenuDishDto }) {
  return (
    <li className="mr-item" data-change="removed">
      <div className="mr-photos">
        <Media
          className="mr-photo"
          src={dish.coverUrl ?? undefined}
          alt={dish.name}
        />
      </div>
      <div className="mr-item-body">
        <div className="mr-item-head">
          <strong>{dish.name}</strong>
          <Badge tone="error">Gỡ khỏi thực đơn</Badge>
        </div>
        <p className="mr-item-meta">
          <strong>{money(dish.price)}</strong> · {dishFormLabels[dish.dishForm]}{" "}
          · {dish.likeCount} lượt thích
        </p>
      </div>
    </li>
  );
}

/** F-58 review (MOD-M2 + MOD-M3/MOD-M4): the comparison with the running menu, then the decision. */
export function MenuReviewPage({
  submissionId,
  service = menuReviewService,
}: {
  submissionId: number;
  service?: MenuReviewService;
}) {
  const { base } = useWorkspace();
  const [version, setVersion] = useState(0);
  const [state, retry] = useRemote(
    () => service.detail(submissionId),
    `${submissionId}:${version}`,
  );
  const [tags] = useRemote(() => exploreService.tags(), "tags");
  const [filter, setFilter] = useState<ItemFilter>("all");
  const [decision, setDecision] = useState<MenuDecision>("approve");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const busy = useRef(false);

  const back = (
    <Link className="vr-back" href={`${base}/menus`}>
      <ArrowLeftIcon aria-hidden /> Hàng đợi thực đơn
    </Link>
  );
  if (state.status === "loading")
    return (
      <div className="stack vr-page">
        {back}
        <Skeleton rows={6} />
      </div>
    );
  if (state.status === "error") {
    const missing =
      state.error instanceof ApiError &&
      state.error.errorCode === "SUBMISSION_NOT_FOUND";
    return (
      <div className="stack vr-page">
        {back}
        <Card
          title={
            missing
              ? "Không tìm thấy bản thực đơn"
              : "Chưa tải được bản thực đơn"
          }
        >
          <Alert>{menuReviewError(state.error)}</Alert>
          {!missing && <Button onClick={retry}>Thử lại</Button>}
        </Card>
      </div>
    );
  }
  const item = state.data;
  const names = tagNamesOf(tags.status === "ready" ? tags.data : []);
  const counts = itemCounts(item.items, item.removedDishes.length);
  const open = item.status === "pending";
  const shownItems =
    filter === "all"
      ? item.items
      : filter === "removed"
        ? []
        : item.items.filter((entry) => entry.change === filter);
  const showRemoved = filter === "all" || filter === "removed";
  const filters: { value: ItemFilter; label: string }[] = [
    { value: "all", label: `Tất cả (${counts.all})` },
    { value: "new", label: `Mới (${counts.new})` },
    { value: "edited", label: `Sửa (${counts.edited})` },
    { value: "removed", label: `Gỡ (${counts.removed})` },
    { value: "unchanged", label: `Không đổi (${counts.unchanged})` },
  ];

  function ask() {
    const found = menuDecisionProblem(decision, note);
    setNoteError(found);
    setProblem("");
    if (!found) setConfirming(true);
  }

  async function decide() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setProblem("");
    try {
      const text = note.trim();
      if (decision === "approve") {
        const result = await service.approve(submissionId, text || undefined);
        setDone(
          `Đã duyệt thực đơn của ${item.restaurant.name}: ${result.createdDishIds.length} món mới, ${result.updatedDishIds.length} món cập nhật, ${result.removedDishIds.length} món gỡ. Chủ quán đã nhận thông báo.`,
        );
      } else {
        await service.reject(submissionId, text);
        setDone(
          "Đã từ chối bản thực đơn. Thực đơn đang bán giữ nguyên và chủ quán đã nhận lý do của bạn.",
        );
      }
      setConfirming(false);
      setNote("");
      setVersion((value) => value + 1);
    } catch (caught) {
      setProblem(menuReviewError(caught));
      if (
        caught instanceof ApiError &&
        caught.errorCode === "SUBMISSION_NOT_PENDING"
      ) {
        setConfirming(false);
        setVersion((value) => value + 1);
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="stack vr-page">
      {back}
      <header className="vr-hero mr-hero">
        <div>
          <p className="vr-eyebrow">Bản thực đơn #{item.id}</p>
          <h1>{item.restaurant.name}</h1>
          <p className="vr-hero-meta">
            <Badge tone={menuStatusTone(item.status)}>
              {menuStatusLabels[item.status]}
            </Badge>
            {place(item.restaurant) && (
              <span>
                <MapPinIcon aria-hidden /> {place(item.restaurant)}
              </span>
            )}
            <span>
              <ClockIcon aria-hidden /> Gửi{" "}
              {verificationDateLabel(item.submittedAt)}
              {open &&
                item.submittedAt &&
                ` · đã chờ ${waitingFor(item.submittedAt)}`}
            </span>
          </p>
        </div>
        <span className="mr-counts">
          <span data-change="new">+{counts.new} món mới</span>
          <span data-change="edited">{counts.edited} món sửa</span>
          <span data-change="removed">{counts.removed} món gỡ</span>
        </span>
      </header>
      {done && <Alert tone="success">{done}</Alert>}
      {problem && !confirming && <Alert>{problem}</Alert>}

      <div className="vr-layout">
        <div className="vr-main">
          {item.ownerNote && (
            <div className="vr-previous-note">
              <strong>Ghi chú của chủ quán</strong>
              <p>{item.ownerNote}</p>
            </div>
          )}
          <Card title="So với thực đơn đang bán">
            <div
              className="vr-tabs mr-filter"
              role="group"
              aria-label="Lọc theo thay đổi"
            >
              {filters.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {shownItems.length === 0 &&
            !(showRemoved && item.removedDishes.length) ? (
              <p className="helper">Không có món nào trong mục này.</p>
            ) : (
              <ul className="mr-items">
                {shownItems.map((entry) => (
                  <ItemRow key={entry.id} item={entry} names={names} />
                ))}
                {showRemoved &&
                  item.removedDishes.map((dish) => (
                    <RemovedRow key={`removed-${dish.id}`} dish={dish} />
                  ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="vr-side" aria-label="Quyết định">
          {open ? (
            <Card title="Quyết định">
              <div
                className="vr-decisions"
                role="radiogroup"
                aria-label="Quyết định cho bản thực đơn"
              >
                <label data-choice="approve">
                  <input
                    type="radio"
                    name="menu-decision"
                    checked={decision === "approve"}
                    onChange={() => {
                      setDecision("approve");
                      setNoteError("");
                    }}
                  />
                  <span>
                    <strong>Duyệt thực đơn</strong>
                    <small>
                      Thực đơn mới thay thực đơn đang bán ngay; món sửa giữ
                      nguyên lượt thích.
                    </small>
                  </span>
                </label>
                <label data-choice="reject">
                  <input
                    type="radio"
                    name="menu-decision"
                    checked={decision === "reject"}
                    onChange={() => {
                      setDecision("reject");
                      setNoteError("");
                    }}
                  />
                  <span>
                    <strong>Từ chối</strong>
                    <small>
                      Thực đơn đang bán giữ nguyên; chủ quán nhận lý do và sửa
                      lại.
                    </small>
                  </span>
                </label>
              </div>
              <TextArea
                label={
                  decision === "approve"
                    ? "Ghi chú cho chủ quán (không bắt buộc)"
                    : "Lý do từ chối"
                }
                required={decision === "reject"}
                value={note}
                maxLength={menuNoteMax}
                placeholder={
                  decision === "approve"
                    ? "Ví dụ: Thực đơn rõ ràng, ảnh món đẹp."
                    : "Ví dụ: Ảnh món Bún bò bị mờ, giá Phở gà chưa đúng."
                }
                error={noteError}
                helper={`${note.trim().length}/${menuNoteMax} ký tự. Chủ quán sẽ thấy nội dung này.`}
                onChange={(event) => {
                  setNote(event.target.value);
                  setNoteError("");
                }}
              />
              <Button
                variant={decision === "reject" ? "destructive" : "primary"}
                onClick={ask}
              >
                {decision === "approve" ? "Duyệt thực đơn" : "Từ chối thực đơn"}
              </Button>
            </Card>
          ) : (
            <Card title="Kết quả xử lý">
              <p>
                <Badge tone={menuStatusTone(item.status)}>
                  {menuStatusLabels[item.status]}
                </Badge>
              </p>
              <dl className="vr-facts">
                <div>
                  <dt>Người duyệt</dt>
                  <dd>{item.reviewedBy?.displayName || "Chưa có"}</dd>
                </div>
                <div>
                  <dt>Thời điểm</dt>
                  <dd>{verificationDateLabel(item.reviewedAt)}</dd>
                </div>
              </dl>
              {item.reviewNote && (
                <div className="vr-previous-note">
                  <strong>Ghi chú gửi chủ quán</strong>
                  <p>{item.reviewNote}</p>
                </div>
              )}
              <Button
                variant="tertiary"
                onClick={() => setVersion((value) => value + 1)}
              >
                <ArrowPathIcon className="vr-icon" aria-hidden /> Tải lại
              </Button>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        title={
          decision === "approve"
            ? `Duyệt thực đơn của ${item.restaurant.name}?`
            : `Từ chối thực đơn của ${item.restaurant.name}?`
        }
        label={decision === "approve" ? "Duyệt thực đơn" : "Từ chối thực đơn"}
        danger={decision === "reject"}
        loading={saving}
        onClose={() => {
          if (!saving) setConfirming(false);
        }}
        onConfirm={() => void decide()}
      >
        <div className="stack-sm">
          <p>
            {decision === "approve"
              ? `Thực đơn mới (${counts.new} món mới, ${counts.edited} món sửa, ${counts.removed} món gỡ) sẽ thay thực đơn đang bán ngay.`
              : "Thực đơn đang bán giữ nguyên; chủ quán nhận lý do bạn ghi."}
          </p>
          {note.trim() && (
            <div className="vr-previous-note">
              <strong>Ghi chú gửi chủ quán</strong>
              <p>{note.trim()}</p>
            </div>
          )}
          {problem && <Alert>Chưa lưu được. {problem}</Alert>}
        </div>
      </ConfirmDialog>
    </div>
  );
}
