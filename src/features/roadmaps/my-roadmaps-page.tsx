"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card } from "@/shared/ui";
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
  roadmapDateRange,
  roadmapItemsLabel,
  roadmapListPageSize,
  roadmapOriginText,
  vnd,
} from "./roadmap-list-rules";
import { roadmapService, type RoadmapListService } from "./roadmap-service";
import { roadmapListHref, roadmapRoutes } from "./routes";
import type { RoadmapPageDto, RoadmapSummaryDto } from "./roadmap-types";
import "./my-roadmaps.css";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: RoadmapPageDto };

function RoadmapCard({ roadmap }: { roadmap: RoadmapSummaryDto }) {
  const origin = roadmapOriginText(roadmap);
  return (
    <article
      className="card roadmap-card"
      aria-labelledby={`roadmap-${roadmap.id}`}
    >
      <Media src={roadmap.coverUrl ?? undefined} alt={roadmap.title} />
      <div className="roadmap-card-body">
        <div className="stack-sm">
          <h2 id={`roadmap-${roadmap.id}`}>{roadmap.title}</h2>
          <p className="helper">{roadmapDateRange(roadmap)}</p>
          <p className="roadmap-card-chips">
            <span>{roadmap.numDays} ngày</span>
            <span>{roadmapItemsLabel(roadmap.itemCount)}</span>
            {isOverBudget(roadmap) && (
              <Badge tone="warning">Vượt ngân sách</Badge>
            )}
          </p>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Ngân sách</dt>
            <dd>
              {roadmap.budgetAmount === null
                ? "Chưa đặt"
                : vnd(roadmap.budgetAmount)}
            </dd>
          </div>
          <div>
            <dt>Chi phí dự kiến</dt>
            <dd>{vnd(roadmap.totalEstimatedCost)}</dd>
          </div>
          {origin && (
            <div>
              <dt>Xuất phát</dt>
              <dd>{origin}</dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  );
}

/** F-20 View My Roadmap: RM-02, one page per URL (`/roadmaps?page=2`). */
export function MyRoadmapsPage({
  page,
  service = roadmapService,
}: {
  page: number;
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
            <RoadmapCard roadmap={roadmap} />
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
