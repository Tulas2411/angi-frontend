"use client";
import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BookOpenIcon,
  BuildingStorefrontIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ClockIcon,
  FlagIcon,
  HandRaisedIcon,
  StarIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { Badge, Button } from "@/shared/ui";
import { Skeleton } from "@/components/ui/primitives";
import { useWorkspace } from "@/components/layout/workspace";
import { ApiError } from "@/shared/api/error";
import { useRemote, type Remote } from "@/features/explore/use-remote";
import { verificationDateLabel } from "@/features/owner/verification-details";
import { waitingFor } from "./verification-review-rules";
import {
  verificationReviewService,
  type VerificationReviewService,
} from "./verification-review-service";
import {
  menuReviewService,
  type MenuReviewService,
} from "./menu-review-service";
import {
  moderationReportsService,
  reportStatusTone,
  type ModerationReportsService,
} from "./moderation-service";
import {
  restaurantModerationService,
  type RestaurantModerationService,
} from "./restaurant-moderation-service";
import { reasonLabel, reportStatusLabels } from "./report-handling-rules";
import type { ReportDto } from "./moderation-types";
import "./moderation-home.css";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** "Chào buổi sáng" … by the hour of the moderator's clock. */
export function greeting(hour: number) {
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/** A queue the account may not open (403) reads as such, not as an outage. */
const forbidden = (error: unknown) =>
  error instanceof ApiError && error.status === 403;

/** One headline number: the size of a queue, how long its oldest item waits, a link into it. */
function QueueTile({
  icon: TileIcon,
  label,
  href,
  state,
  count,
  oldest,
  tone,
  onRetry,
}: {
  icon: Icon;
  label: string;
  href: string;
  state: Remote<unknown>;
  count: number;
  oldest?: string | null;
  tone: "coral" | "amber" | "green" | "blue";
  onRetry: () => void;
}) {
  const failed = state.status === "error" && !forbidden(state.error);
  return (
    <li className="mh-tile-item">
      <Link className="mh-tile" data-tone={tone} href={href}>
        <span className="mh-tile-icon" aria-hidden>
          <TileIcon />
        </span>
        <span className="mh-tile-arrow" aria-hidden>
          <ArrowRightIcon />
        </span>
        <span className="mh-tile-label">{label}</span>
        {state.status === "loading" ? (
          <span className="mh-tile-skeleton" aria-label="Đang tải" />
        ) : state.status === "error" ? (
          <span className="mh-tile-note">
            {forbidden(state.error)
              ? "Tài khoản chưa có quyền xem"
              : "Chưa tải được số liệu"}
          </span>
        ) : (
          <>
            <strong className="mh-tile-count">{count}</strong>
            <span className="mh-tile-note">
              {count === 0
                ? "Không còn việc chờ"
                : oldest
                  ? `Cũ nhất đã chờ ${waitingFor(oldest)}`
                  : "Đang chờ xử lý"}
            </span>
          </>
        )}
      </Link>
      {failed && (
        <button type="button" className="mh-tile-retry" onClick={onRetry}>
          <ArrowPathIcon aria-hidden /> Thử lại
        </button>
      )}
    </li>
  );
}

/** A short list next to the tiles: the first items of a queue, each opening its review page. */
function QueueList({
  title,
  href,
  state,
  empty,
  children,
}: {
  title: string;
  href: string;
  state: Remote<unknown>;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <section className="mh-list" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <Link href={href}>
          Xem tất cả <ArrowRightIcon aria-hidden />
        </Link>
      </header>
      {state.status === "loading" ? (
        <Skeleton rows={3} />
      ) : state.status === "error" ? (
        <p className="helper">
          {forbidden(state.error)
            ? "Tài khoản của bạn chưa được cấp quyền cho hàng đợi này."
            : "Chưa tải được hàng đợi này."}
        </p>
      ) : empty ? (
        <p className="mh-list-empty">Không còn mục nào đang chờ.</p>
      ) : (
        <ul>{children}</ul>
      )}
    </section>
  );
}

function ReportRow({ report, base }: { report: ReportDto; base: string }) {
  return (
    <li>
      <Link href={`${base}/reports/${report.id}`} className="mh-row">
        <span className="mh-row-body">
          <strong>{report.targetName}</strong>
          <small>
            {reasonLabel(report.reasonCode)} ·{" "}
            {report.targetType === "restaurant" ? "Nhà hàng" : "Bài viết"} ·{" "}
            {verificationDateLabel(report.createdAt)}
          </small>
        </span>
        <Badge tone={reportStatusTone(report.status)}>
          {reportStatusLabels[report.status]}
        </Badge>
      </Link>
    </li>
  );
}

/**
 * The moderator's start page: how full each queue is (MOD-V1, MOD-M1, MOD-RP1, MOD-R1 read for
 * their `totalItems`), the reports the moderator is holding, and the next items to look at.
 */
export function ModerationHomePage({
  verifications = verificationReviewService,
  menus = menuReviewService,
  reports = moderationReportsService,
  restaurants = restaurantModerationService,
}: {
  verifications?: VerificationReviewService;
  menus?: MenuReviewService;
  reports?: ModerationReportsService;
  restaurants?: RestaurantModerationService;
}) {
  const { base, user } = useWorkspace();
  const [verification, retryVerification] = useRemote(
    () => verifications.list({ status: "pending", page: 1, pageSize: 3 }),
    "home:verifications",
  );
  const [menu, retryMenu] = useRemote(
    () => menus.list({ status: "pending", page: 1, pageSize: 3 }),
    "home:menus",
  );
  const [restaurantReports, retryRestaurantReports] = useRemote(
    () =>
      reports.list({
        targetType: "restaurant",
        status: "pending",
        page: 1,
        pageSize: 3,
      }),
    "home:reports:restaurant",
  );
  const [blogReports, retryBlogReports] = useRemote(
    () =>
      reports.list({
        targetType: "blog",
        status: "pending",
        page: 1,
        pageSize: 3,
      }),
    "home:reports:blog",
  );
  // The reports in review are few; the moderator's own are picked out by `handledBy`.
  const [inReview, retryInReview] = useRemote(
    () =>
      Promise.all(
        (["restaurant", "blog"] as const).map((targetType) =>
          reports.list({
            targetType,
            status: "in_review",
            page: 1,
            pageSize: 50,
          }),
        ),
      ),
    "home:reports:in_review",
  );
  const [reported, retryReported] = useRemote(
    () => restaurants.list({ hasPendingReports: true, page: 1, pageSize: 1 }),
    "home:restaurants:reported",
  );

  const ready = <T,>(state: Remote<T>) =>
    state.status === "ready" ? state.data : null;
  const v = ready(verification);
  const m = ready(menu);
  const rr = ready(restaurantReports);
  const br = ready(blogReports);
  const pendingReports = (rr?.totalItems ?? 0) + (br?.totalItems ?? 0);
  // Both report queues answer together for the tile; either failing shows the failure.
  const reportsState: Remote<unknown> =
    restaurantReports.status !== "ready"
      ? restaurantReports
      : blogReports.status !== "ready"
        ? blogReports
        : restaurantReports;
  const latestReports = [...(rr?.items ?? []), ...(br?.items ?? [])]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 3);
  const mine =
    inReview.status === "ready"
      ? inReview.data
          .flatMap((page) => page.items)
          .filter((item) => user && item.handledBy?.id === user.id)
      : [];
  const now = new Date();

  return (
    <div className="mh-page">
      <header className="mh-hero">
        <div>
          <p className="mh-eyebrow">
            {now.toLocaleDateString("vi-VN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1>
            {greeting(now.getHours())}
            {user ? `, ${user.displayName}` : ""}
          </h1>
          <p className="mh-lead">
            Đây là những việc đang chờ trong các hàng đợi kiểm duyệt. Mục chờ
            lâu nhất nên được xử lý trước.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            retryVerification();
            retryMenu();
            retryRestaurantReports();
            retryBlogReports();
            retryInReview();
            retryReported();
          }}
        >
          <ArrowPathIcon className="mh-icon" aria-hidden /> Làm mới
        </Button>
      </header>

      <ul className="mh-tiles" aria-label="Hàng đợi kiểm duyệt">
        <QueueTile
          icon={CheckBadgeIcon}
          label="Hồ sơ xác minh chờ duyệt"
          href={`${base}/verification`}
          state={verification}
          count={v?.totalItems ?? 0}
          oldest={v?.items[0]?.submittedAt}
          tone="green"
          onRetry={retryVerification}
        />
        <QueueTile
          icon={BookOpenIcon}
          label="Thực đơn chờ duyệt"
          href={`${base}/menus`}
          state={menu}
          count={m?.totalItems ?? 0}
          oldest={m?.items[0]?.submittedAt}
          tone="amber"
          onRetry={retryMenu}
        />
        <QueueTile
          icon={FlagIcon}
          label="Báo cáo chưa ai nhận"
          href={`${base}/reports`}
          state={reportsState}
          count={pendingReports}
          tone="coral"
          onRetry={() => {
            retryRestaurantReports();
            retryBlogReports();
          }}
        />
        <QueueTile
          icon={BuildingStorefrontIcon}
          label="Nhà hàng đang bị báo cáo"
          href={`${base}/restaurants`}
          state={reported}
          count={reported.status === "ready" ? reported.data.totalItems : 0}
          tone="blue"
          onRetry={retryReported}
        />
      </ul>

      <section className="mh-mine" aria-label="Báo cáo bạn đang xử lý">
        <header>
          <span className="mh-mine-icon" aria-hidden>
            <HandRaisedIcon />
          </span>
          <div>
            <h2>Báo cáo bạn đang xử lý</h2>
            <p>
              Bạn đã nhận các báo cáo này, Mod khác sẽ không xử lý trùng. Nhớ
              kết luận khi xem xong.
            </p>
          </div>
        </header>
        {inReview.status === "loading" ? (
          <Skeleton rows={2} />
        ) : inReview.status === "error" ? (
          <p className="helper">Chưa tải được các báo cáo đang xử lý.</p>
        ) : mine.length === 0 ? (
          <p className="mh-list-empty">
            Bạn không giữ báo cáo nào. Nhận một báo cáo trong hàng đợi để bắt
            đầu.
          </p>
        ) : (
          <ul className="mh-mine-list">
            {mine.map((report) => (
              <ReportRow key={report.id} report={report} base={base} />
            ))}
          </ul>
        )}
      </section>

      <div className="mh-lists">
        <QueueList
          title="Hồ sơ xác minh gửi sớm nhất"
          href={`${base}/verification`}
          state={verification}
          empty={!v?.items.length}
        >
          {v?.items.map((item) => (
            <li key={item.id}>
              <Link href={`${base}/verification/${item.id}`} className="mh-row">
                <span className="mh-row-body">
                  <strong>{item.restaurant.name}</strong>
                  <small>
                    {item.previousId ? "Nộp lại · " : ""}
                    {verificationDateLabel(item.submittedAt)}
                  </small>
                </span>
                <span className="mh-wait">
                  <ClockIcon aria-hidden />
                  {waitingFor(item.submittedAt)}
                </span>
              </Link>
            </li>
          ))}
        </QueueList>
        <QueueList
          title="Thực đơn gửi sớm nhất"
          href={`${base}/menus`}
          state={menu}
          empty={!m?.items.length}
        >
          {m?.items.map((item) => (
            <li key={item.id}>
              <Link href={`${base}/menus/${item.id}`} className="mh-row">
                <span className="mh-row-body">
                  <strong>{item.restaurant.name}</strong>
                  <small>
                    +{item.newCount} mới · {item.editedCount} sửa ·{" "}
                    {item.removedCount} gỡ
                  </small>
                </span>
                {item.submittedAt && (
                  <span className="mh-wait">
                    <ClockIcon aria-hidden />
                    {waitingFor(item.submittedAt)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </QueueList>
        <QueueList
          title="Báo cáo mới nhất chưa ai nhận"
          href={`${base}/reports`}
          state={reportsState}
          empty={!latestReports.length}
        >
          {latestReports.map((report) => (
            <ReportRow key={report.id} report={report} base={base} />
          ))}
        </QueueList>
      </div>

      <nav className="mh-shortcuts" aria-label="Lối tắt">
        <Link href={`${base}/users`}>
          <UsersIcon aria-hidden />
          <span>
            <strong>Người dùng</strong>
            <small>Tra cứu, cảnh cáo, tạm khóa tài khoản</small>
          </span>
        </Link>
        <Link href={`${base}/community`}>
          <ChatBubbleLeftRightIcon aria-hidden />
          <span>
            <strong>Nội dung cộng đồng</strong>
            <small>Bài viết và bình luận</small>
          </span>
        </Link>
        <Link href={`${base}/reviews`}>
          <StarIcon aria-hidden />
          <span>
            <strong>Đánh giá &amp; phản hồi</strong>
            <small>Đánh giá quán và phản hồi của chủ quán</small>
          </span>
        </Link>
      </nav>
    </div>
  );
}
