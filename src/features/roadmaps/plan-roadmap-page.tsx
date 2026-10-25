"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button } from "@/shared/ui";
import { ActionLink, Media } from "@/components/ui/primitives";
import { dateLabel } from "@/shared/format";
import { rememberDestination } from "./roadmap-destination";
import { RoadmapOverviewForm } from "./roadmap-overview-form";
import {
  buildCreateRoadmapRequest,
  formatVndInput,
  buildRoadmapPatch,
  emptyRoadmapForm,
  originFromSummary,
  originModeLabels,
  roadmapFormFromSummary,
} from "./roadmap-rules";
import { roadmapService, type RoadmapPlanService } from "./roadmap-service";
import { roadmapDetailHref, roadmapRoutes } from "./routes";
import type { RoadmapDetailDto, RoadmapSummaryDto } from "./roadmap-types";
import "./plan-roadmap.css";

function originText(overview: RoadmapSummaryDto) {
  if (overview.originMode !== "pinned")
    return originModeLabels[overview.originMode];
  const point =
    overview.originLatitude !== null && overview.originLongitude !== null
      ? `${overview.originLatitude.toFixed(6)}, ${overview.originLongitude.toFixed(6)}`
      : "";
  return [overview.originLabel, point].filter(Boolean).join(" · ");
}

/** F-19 Plan New Roadmap: RM-01 creates the roadmap, RM-04 edits its overview. */
export function PlanRoadmapPage({
  service = roadmapService,
}: {
  service?: RoadmapPlanService;
}) {
  const [roadmap, setRoadmap] = useState<RoadmapDetailDto | null>(null);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  // Remounts the creation form with empty values after "Lập lộ trình khác".
  const [formKey, setFormKey] = useState(0);
  const overview = roadmap?.overview;
  const resultHeading = useRef<HTMLHeadingElement>(null);
  // The form is replaced by its result; keep keyboard and screen-reader focus on it.
  useEffect(() => {
    if (overview && !editing) resultHeading.current?.focus();
  }, [overview, editing]);

  return (
    <div className="roadmap-plan">
      <section
        className="roadmap-plan-intro"
        aria-labelledby="roadmap-plan-title"
      >
        <p className="eyebrow">Lộ trình ẩm thực</p>
        <h1 id="roadmap-plan-title">
          Mỗi ngày,
          <br />
          một vị ngon mới.
        </h1>
        <p className="page-description">
          Cho ANGI biết bạn đi đâu, đi mấy ngày và xuất phát từ đâu. Lộ trình
          được tạo sẵn đủ số ngày để bạn thêm món cho từng bữa.
        </p>
        <Media
          className="roadmap-plan-media"
          src="/assets/figma/roll-0.png"
          alt="Bát phở bò với rau thơm và chanh"
        />
      </section>
      <div className="roadmap-plan-panel">
        {!overview && (
          <RoadmapOverviewForm
            key={formKey}
            mode="create"
            title="Lên lộ trình ăn ngon"
            submitLabel="Tạo lộ trình"
            initialValues={emptyRoadmapForm}
            onSubmit={async (values, origin) => {
              const created = await service.create(
                buildCreateRoadmapRequest(values, origin),
              );
              // RM-01 keeps no destination; RM-06 asks for it, so remember it for this browser.
              rememberDestination(created.overview.id, values.province);
              setRoadmap(created);
              setNotice("");
            }}
          />
        )}
        {overview && editing && (
          <RoadmapOverviewForm
            mode="edit"
            title="Sửa thông tin lộ trình"
            submitLabel="Lưu thay đổi"
            initialValues={roadmapFormFromSummary(overview)}
            initialOrigin={originFromSummary(overview)}
            isUnchanged={(values, origin) =>
              Object.keys(buildRoadmapPatch(values, origin, overview))
                .length === 0
            }
            onCancel={() => setEditing(false)}
            onSubmit={async (values, origin) => {
              const updated = await service.update(
                overview.id,
                buildRoadmapPatch(values, origin, overview),
              );
              setRoadmap(updated);
              setEditing(false);
              setNotice("Đã lưu thông tin lộ trình.");
            }}
          />
        )}
        {overview && !editing && roadmap && (
          <section
            className="card roadmap-plan-card"
            aria-labelledby="roadmap-created-title"
          >
            <Alert tone="success">
              {notice ||
                `Đã tạo lộ trình với ${roadmap.itinerary.length} ngày trống.`}
            </Alert>
            <div className="stack-sm">
              <Badge>Lộ trình của bạn</Badge>
              <h2 id="roadmap-created-title" ref={resultHeading} tabIndex={-1}>
                {overview.title}
              </h2>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Thời gian</dt>
                <dd>
                  {overview.startDate && overview.endDate
                    ? `${dateLabel(overview.startDate)} – ${dateLabel(overview.endDate)}`
                    : "Chưa chọn ngày đi"}
                </dd>
              </div>
              <div>
                <dt>Số ngày</dt>
                <dd>{overview.numDays} ngày</dd>
              </div>
              <div>
                <dt>Ngân sách</dt>
                <dd>
                  {overview.budgetAmount === null
                    ? "Chưa đặt"
                    : `${formatVndInput(String(overview.budgetAmount))} / người`}
                </dd>
              </div>
              <div>
                <dt>Điểm xuất phát</dt>
                <dd>{originText(overview)}</dd>
              </div>
            </dl>
            <p className="helper">
              Bạn có thể đổi điểm xuất phát bất cứ lúc nào, ví dụ khi đã đặt
              được chỗ ở.
            </p>
            <div className="actions registration-actions">
              <Button
                onClick={() => {
                  setNotice("");
                  setEditing(true);
                }}
              >
                Sửa thông tin
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setRoadmap(null);
                  setNotice("");
                  setFormKey((key) => key + 1);
                }}
              >
                Lập lộ trình khác
              </Button>
              <ActionLink href={roadmapDetailHref(overview.id)} secondary>
                Xem chi tiết
              </ActionLink>
              <ActionLink href={roadmapRoutes.list} secondary>
                Xem lộ trình của tôi
              </ActionLink>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
