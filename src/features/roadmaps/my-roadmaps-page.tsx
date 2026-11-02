"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  EmptyState,
  Media,
  Pagination,
  Skeleton,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/page-heading";
import { getErrorMessage } from "@/shared/api/error";
import {
  isOverBudget,
  roadmapCountdown,
  roadmapItemsLabel,
  roadmapListPageSize,
  roadmapShortRange,
} from "./roadmap-list-rules";
import { roadmapService, type RoadmapListService } from "./roadmap-service";
import { roadmapDetailHref, roadmapListHref, roadmapRoutes } from "./routes";
import type { RoadmapPageDto, RoadmapSummaryDto } from "./roadmap-types";
import "./my-roadmaps.css";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: RoadmapPageDto };

const shareIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <path d="M13 5v4C7 9.5 4.5 13 4 19c2-3.2 4.8-4.6 9-4.6V19l7-7-7-7Z" />
  </svg>
);

/**
 * One roadmap: the cover with how soon the trip starts and a share action, then the title and one
 * line of who, when and how many dishes. Budget and origin live on the detail page.
 */
function RoadmapCard({
  roadmap,
  owner,
}: {
  roadmap: RoadmapSummaryDto;
  owner?: string;
}) {
  const countdown = roadmapCountdown(roadmap);
  const over = isOverBudget(roadmap);
  return (
    <article className="roadmap-card" aria-labelledby={`roadmap-${roadmap.id}`}>
      <div className="roadmap-card-cover">
        <Media src={roadmap.coverUrl ?? undefined} alt={roadmap.title} />
        {(countdown || over) && (
          <p className="roadmap-card-badges">
            {countdown && <span>{countdown}</span>}
            {over && <span className="is-warning">Vượt ngân sách</span>}
          </p>
        )}
        <Link
          className="roadmap-card-share"
          href={`/guides/new?roadmap=${roadmap.id}`}
          aria-label={`Chia sẻ lộ trình ${roadmap.title}`}
        >
          {shareIcon}
          <span aria-hidden>Chia sẻ</span>
        </Link>
      </div>
      <h2 id={`roadmap-${roadmap.id}`}>
        <Link href={roadmapDetailHref(roadmap.id)}>{roadmap.title}</Link>
      </h2>
      <p className="roadmap-card-meta">
        {owner && (
          <span className="roadmap-card-owner" aria-hidden>
            {owner.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span>{roadmapShortRange(roadmap)}</span>
        <span>{roadmap.numDays} ngày</span>
        <span>{roadmapItemsLabel(roadmap.itemCount)}</span>
      </p>
    </article>
  );
}

/** F-20 View My Roadmap: RM-02, one page per URL (`/roadmaps?page=2`). */
export function MyRoadmapsPage({
  page,
  owner,
  service = roadmapService,
}: {
  page: number;
  /** The traveler's display name, for the initial on each card. */
  owner?: string;
  service?: RoadmapListService;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    service
      .list(page, roadmapListPageSize)
      .then((data) => {
        if (ignore) return;
        // A bookmarked page past the end (roadmaps were deleted) falls back to the last page.
        if (!data.items.length && data.totalPages > 0 && page > data.totalPages)
          router.replace(roadmapListHref(data.totalPages));
        else setState({ status: "ready", data });
      })
      .catch((caught) => {
        if (!ignore)
          setState({ status: "error", message: getErrorMessage(caught) });
      });
    return () => {
      ignore = true;
    };
  }, [page, attempt, service, router]);

  const planLink = (
    <ActionLink href={roadmapRoutes.plan}>Lập lộ trình mới</ActionLink>
  );
  const heading = (description?: string) => (
    <PageHeading
      eyebrow="Lộ trình ẩm thực"
      title="Lộ trình của tôi"
      description={description}
      action={planLink}
    />
  );

  if (state.status === "loading")
    return (
      <div className="stack">
        {heading()}
        <Skeleton rows={4} />
      </div>
    );
  if (state.status === "error")
    return (
      <div className="stack">
        {heading()}
        <Card title="Chưa tải được danh sách lộ trình">
          <Alert>{state.message}</Alert>
          <Button
            onClick={() => {
              setState({ status: "loading" });
              setAttempt(attempt + 1);
            }}
          >
            Thử lại
          </Button>
        </Card>
      </div>
    );
  const { data } = state;
  if (!data.totalItems)
    return (
      <div className="stack">
        {heading()}
        <EmptyState title="Bạn chưa có lộ trình nào" action={planLink}>
          Lập lộ trình đầu tiên để sắp xếp các bữa ăn theo từng ngày của chuyến
          đi.
        </EmptyState>
      </div>
    );
  return (
    <div className="stack">
      {heading(`Bạn có ${data.totalItems} lộ trình, mới nhất trước.`)}
      <ul className="roadmap-grid">
        {data.items.map((roadmap) => (
          <li key={roadmap.id}>
            <RoadmapCard roadmap={roadmap} owner={owner} />
          </li>
        ))}
      </ul>
      {data.totalPages > 1 && (
        <Pagination
          total={data.totalItems}
          page={data.page}
          size={data.pageSize}
          onChange={(next) => router.push(roadmapListHref(next))}
        />
      )}
    </div>
  );
}
