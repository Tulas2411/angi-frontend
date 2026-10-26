"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card } from "@/shared/ui";
import { ActionLink, EmptyState, Skeleton } from "@/components/ui/primitives";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import type { DetailTab } from "./roadmap-detail-rules";
import { RoadmapDetailView } from "./roadmap-detail-view";
import { roadmapService, type RoadmapScreenService } from "./roadmap-service";
import { roadmapRoutes } from "./routes";
import type { RoadmapDetailDto } from "./roadmap-types";
import "./roadmap-detail.css";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: RoadmapDetailDto };

/** F-21 View My Roadmap Detail: RM-03 (Overview, Itinerary, Budget) and RM-14 per open day. */
export function RoadmapDetailPage({
  roadmapId,
  initialDay,
  initialTab,
  service = roadmapService,
  userId,
}: {
  roadmapId: number;
  initialDay: number;
  initialTab: DetailTab;
  service?: RoadmapScreenService;
  userId: number;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    service
      .get(roadmapId)
      .then((detail) => {
        if (!ignore) setState({ status: "ready", detail });
      })
      .catch((caught) => {
        if (ignore) return;
        setState(
          caught instanceof ApiError && caught.errorCode === "ROADMAP_NOT_FOUND"
            ? { status: "missing" }
            : { status: "error", message: getErrorMessage(caught) },
        );
      });
    return () => {
      ignore = true;
    };
  }, [roadmapId, service, attempt]);

  /**
   * After RM-07, RM-09 and a finished RM-10 job the roadmap is read again (RM-03): the order, costs and budget are the
   * backend's, never recomputed here. A failure is thrown so the dialog can say so.
   */
  const reload = useCallback(async () => {
    const detail = await service.get(roadmapId);
    setState((current) =>
      current.status === "ready" ? { status: "ready", detail } : current,
    );
  }, [roadmapId, service]);

  const back = (
    <Link href={roadmapRoutes.list} className="text-link">
      ← Lộ trình của tôi
    </Link>
  );
  if (state.status === "ready")
    return (
      <RoadmapDetailView
        key={state.detail.overview.id}
        detail={state.detail}
        initialDay={initialDay}
        initialTab={initialTab}
        service={service}
        userId={userId}
        onItemAdded={reload}
        onItemRemoved={reload}
        onItemsGenerated={reload}
      />
    );
  if (state.status === "loading")
    return (
      <div className="stack">
        {back}
        <Skeleton rows={4} />
      </div>
    );
  if (state.status === "missing")
    return (
      <div className="stack">
        {back}
        <EmptyState
          title="Không tìm thấy lộ trình"
          action={
            <ActionLink href={roadmapRoutes.list}>
              Về lộ trình của tôi
            </ActionLink>
          }
        >
          Lộ trình không tồn tại hoặc không thuộc về bạn.
        </EmptyState>
      </div>
    );
  return (
    <div className="stack">
      {back}
      <Card title="Chưa tải được lộ trình">
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
}
