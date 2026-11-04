"use client";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Badge } from "@/shared/ui";
import { Button } from "@/shared/ui";
import { RoadmapAgentPanel } from "./roadmap-agent-panel";
import {
  agentDefaultDay,
  agentMapDays,
  agentMapStops,
} from "./agent-map-rules";
import { useAgentConversation } from "./use-agent-conversation";
import { Icon, Media, Tabs } from "@/components/ui/primitives";
import { dateLabel } from "@/shared/format";
import { RoadmapBudget } from "./roadmap-budget";
import {
  dayDishSummary,
  dayShortLabel,
  detailTabs,
  type DetailTab,
} from "./roadmap-detail-rules";
import { RoadmapItinerary } from "./roadmap-itinerary";
import { RoadmapDetailMap } from "./roadmap-detail-map";
import {
  isOverBudget,
  roadmapCover,
  roadmapDateRange,
  roadmapItemsLabel,
  roadmapOriginText,
  vnd,
} from "./roadmap-list-rules";
import { originModeLabels } from "./roadmap-rules";
import type { RoadmapScreenService } from "./roadmap-service";
import { roadmapDetailHref, roadmapRoutes } from "./routes";
import type { RoadmapDetailDto, RoadmapRouteDto } from "./roadmap-types";

const compactViewport = "(max-width: 900px)";
function subscribeCompactViewport(listener: () => void) {
  const query = window.matchMedia(compactViewport);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/**
 * Loaded roadmap: hero card, the three RoadmapDetail tabs and the day list of the sidebar
 * (Figma "ANGI / Roadmap"). The tab and the last opened day live in the URL.
 */
export function RoadmapDetailView({
  detail,
  initialDay,
  initialTab,
  service,
  onItemAdded,
  onItemRemoved,
  onItemsGenerated,
  onItemsMoved,
  onItemRated,
  userId,
  userName,
  userAvatar,
}: {
  detail: RoadmapDetailDto;
  initialDay: number;
  initialTab: DetailTab;
  service: RoadmapScreenService;
  /** Reloads the roadmap after a dish was added; rejects when the reload fails. */
  onItemAdded: () => Promise<void>;
  /** Reloads the roadmap after an item was deleted; rejects when the reload fails. */
  onItemRemoved: () => Promise<void>;
  /** Reloads the roadmap after an AI job succeeded; rejects when the reload fails. */
  onItemsGenerated: () => Promise<void>;
  /** Reloads the roadmap after dishes were reordered; rejects when the reload fails. */
  onItemsMoved: () => Promise<void>;
  /** Reloads the roadmap after a dish was rated; rejects when the reload fails. */
  onItemRated: () => Promise<void>;
  userId: number;
  userName: string;
  userAvatar: string | null;
}) {
  const { overview, itinerary, budget } = detail;
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentMapView, setAgentMapView] = useState(false);
  // The sidebar button opens the full panel and the map's bubble opens the popup.
  const [agentPopup, setAgentPopup] = useState(false);
  // Matches the 900px layout switch in roadmap-agent.css, where the map stacks and the panel fills the screen.
  const agentCompact = useSyncExternalStore(
    subscribeCompactViewport,
    () => window.matchMedia(compactViewport).matches,
    () => false,
  );
  const agentMode = agentPopup && !agentCompact ? "popup" : "expanded";
  function closeAgent() {
    setAgentOpen(false);
    setAgentMapView(false);
    const opener =
      agentMode === "popup" ? ".roadmap-map-fab" : ".roadmap-agent-trigger";
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(opener)
        ?.focus({ preventScroll: true }),
    );
  }
  const [agentRevision, setAgentRevision] = useState(0);
  const firstDay = itinerary.find((day) => day.dayNumber === initialDay);
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [openDays, setOpenDays] = useState<number[]>(
    firstDay
      ? [firstDay.dayNumber]
      : itinerary[0]
        ? [itinerary[0].dayNumber]
        : [],
  );
  const [selectedDay, setActiveDay] = useState(
    firstDay?.dayNumber ?? itinerary[0]?.dayNumber ?? 1,
  );
  const activeDay = itinerary.some((day) => day.dayNumber === selectedDay)
    ? selectedDay
    : (itinerary[0]?.dayNumber ?? 1);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [mapRoute, setMapRoute] = useState<RoadmapRouteDto | null>(null);
  const agentCommitted = useCallback(
    async (id: number) => {
      if (id !== detail.overview.id) return;
      await onItemsGenerated();
      setMapRoute(null);
      setSelectedItemId(null);
      // A confirmed Agent update can change origin or meal order even if item IDs are retained.
      setAgentRevision((value) => value + 1);
    },
    [detail.overview.id, onItemsGenerated],
  );
  const agent = useAgentConversation({
    open: agentOpen,
    roadmapId: detail.overview.id,
    userId,
    onCommitted: agentCommitted,
  });
  const agentProposal = agent.conversation?.currentProposal ?? null;
  const [previewPick, setPreviewPick] = useState<{
    proposalId: number;
    day: number;
  } | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const previewDay = !agentProposal
    ? 1
    : previewPick?.proposalId === agentProposal.proposalId
      ? previewPick.day
      : agentDefaultDay(agentProposal);
  const previewSelected = agentProposal?.snapshot.items.some(
    (item) => item.itemKey === previewKey,
  )
    ? previewKey
    : "";
  function pickPreviewDay(day: number) {
    if (agentProposal)
      setPreviewPick({ proposalId: agentProposal.proposalId, day });
    setPreviewKey("");
  }
  function selectPreviewItem(itemKey: string) {
    setPreviewKey(itemKey);
    const item = agentProposal?.snapshot.items.find(
      (entry) => entry.itemKey === itemKey,
    );
    if (agentProposal && item)
      setPreviewPick({
        proposalId: agentProposal.proposalId,
        day: item.dayNumber,
      });
  }
  // A saved, expired or replaced preview leaves the map to the saved roadmap.
  const previewOnMap =
    agentOpen && agentProposal?.status === "ready" && !agent.saved
      ? agentProposal
      : null;
  const previewStops = useMemo(
    () => (previewOnMap ? agentMapStops(previewOnMap) : null),
    [previewOnMap],
  );
  const receiveMapRoute = useCallback((route: RoadmapRouteDto | null) => {
    setMapRoute(route);
  }, []);
  const activeDayId = itinerary.find(
    (day) => day.dayNumber === activeDay,
  )?.dayId;
  const effectiveRoute = mapRoute?.dayId === activeDayId ? mapRoute : null;

  function syncUrl(nextTab: DetailTab, day: number) {
    window.history.replaceState(
      null,
      "",
      roadmapDetailHref(overview.id, { tab: nextTab, day }),
    );
  }
  function selectTab(value: string) {
    const next = value as DetailTab;
    setTab(next);
    syncUrl(next, activeDay);
  }
  function toggleDay(dayNumber: number) {
    const opening = !openDays.includes(dayNumber);
    setOpenDays((previous) =>
      opening
        ? [...previous, dayNumber]
        : previous.filter((value) => value !== dayNumber),
    );
    if (opening) {
      setActiveDay(dayNumber);
      setSelectedItemId(null);
      syncUrl(tab, dayNumber);
    }
  }
  /** Sidebar: open that day in the itinerary and bring it into view. */
  function showDay(dayNumber: number, itemId?: number, scroll = true) {
    setTab("itinerary");
    setOpenDays((previous) =>
      previous.includes(dayNumber) ? previous : [...previous, dayNumber],
    );
    setActiveDay(dayNumber);
    setSelectedItemId(itemId ?? null);
    syncUrl("itinerary", dayNumber);
    if (scroll)
      requestAnimationFrame(() =>
        document
          .getElementById(
            itemId ? `roadmap-item-${itemId}` : `day-${dayNumber}`,
          )
          ?.scrollIntoView({ block: itemId ? "nearest" : "start" }),
      );
  }
  function selectItem(itemId: number | null) {
    if (itemId === null) {
      setSelectedItemId(null);
      return;
    }
    const day = itinerary.find((entry) =>
      entry.items.some((item) => item.id === itemId),
    );
    if (day)
      showDay(
        day.dayNumber,
        itemId,
        window.matchMedia("(min-width: 901px)").matches,
      );
  }
  function selectContentItem(itemId: number | null) {
    selectItem(itemId);
    if (itemId !== null && window.matchMedia("(max-width: 900px)").matches)
      requestAnimationFrame(() =>
        document
          .querySelector(".roadmap-map-panel")
          ?.scrollIntoView({ block: "start" }),
      );
  }

  const back = (
    <Link href={roadmapRoutes.list} className="text-link">
      ← Lộ trình của tôi
    </Link>
  );
  return (
    <div className="roadmap-detail">
      <aside
        className="roadmap-detail-nav"
        inert={agentOpen && agentMode === "expanded"}
      >
        <Button
          className="roadmap-agent-trigger"
          aria-expanded={agentOpen}
          aria-controls="roadmap-agent-panel"
          onClick={() => {
            setAgentPopup(false);
            setAgentOpen(true);
          }}
        >
          ✦ Trợ lý món ăn
        </Button>
        {back}
        <div className="roadmap-sidebar-section">
          <p className="roadmap-sidebar-eyebrow">Sổ tay ẩm thực</p>
          <div
            className="roadmap-sidebar-sections"
            aria-label="Điều hướng chi tiết"
          >
            {detailTabs.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={tab === item.value}
                onClick={() => selectTab(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <nav aria-label="Các ngày của lộ trình">
          <h2 className="roadmap-nav-title">
            <Icon name="roadmap-chevron" /> Lịch ăn uống
          </h2>
          <ol className="roadmap-nav-days">
            {itinerary.map((day) => (
              <li key={day.dayId}>
                <button
                  type="button"
                  aria-current={
                    tab === "itinerary" && activeDay === day.dayNumber
                      ? "true"
                      : undefined
                  }
                  onClick={() => showDay(day.dayNumber)}
                >
                  <span className="roadmap-nav-day">{dayShortLabel(day)}</span>
                  <span className="roadmap-nav-dishes">
                    {dayDishSummary(day.items)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <div
        className="roadmap-detail-main stack"
        inert={agentOpen && agentMode === "expanded"}
      >
        <div className="roadmap-back-mobile">{back}</div>
        <section className="roadmap-hero" aria-labelledby="roadmap-title">
          <div className="roadmap-hero-text stack-sm">
            <p className="eyebrow">Lộ trình ẩm thực</p>
            <h1 id="roadmap-title">{overview.title}</h1>
            <p className="page-description">{roadmapDateRange(overview)}</p>
            <p className="roadmap-hero-chips">
              <span>{overview.numDays} ngày</span>
              <span>{roadmapItemsLabel(overview.itemCount)}</span>
              {isOverBudget(overview) && (
                <Badge tone="warning">Vượt ngân sách</Badge>
              )}
            </p>
            <p className="roadmap-hero-actions">
              <Link
                className="button button-secondary"
                href={`/guides/new?roadmap=${overview.id}`}
              >
                Chia sẻ lộ trình
              </Link>
            </p>
          </div>
          <Media
            className="roadmap-hero-media"
            src={roadmapCover(overview)}
            alt={overview.title}
          />
        </section>

        <div className="roadmap-detail-tabs">
          <Tabs
            label="Các phần của lộ trình"
            value={tab}
            onChange={selectTab}
            items={detailTabs}
          />
        </div>

        <div role="tabpanel" aria-label="Tổng quan" hidden={tab !== "overview"}>
          <div className="roadmap-overview stack">
            <h2>Thông tin chung</h2>
            <dl className="card detail-list">
              <div>
                <dt>Thời gian</dt>
                <dd>{roadmapDateRange(overview)}</dd>
              </div>
              <div>
                <dt>Số ngày</dt>
                <dd>{overview.numDays} ngày</dd>
              </div>
              <div>
                <dt>Số món</dt>
                <dd>{roadmapItemsLabel(overview.itemCount)}</dd>
              </div>
              <div>
                <dt>Xuất phát</dt>
                <dd>{roadmapOriginText(overview) ?? originModeLabels.none}</dd>
              </div>
              <div>
                <dt>Ngân sách</dt>
                <dd>
                  {overview.budgetAmount === null
                    ? "Chưa đặt"
                    : `${vnd(overview.budgetAmount)} / người`}
                </dd>
              </div>
              <div>
                <dt>Chi phí dự kiến</dt>
                <dd>{vnd(overview.totalEstimatedCost)}</dd>
              </div>
              <div>
                <dt>Tạo lúc</dt>
                <dd>{dateLabel(overview.createdAt)}</dd>
              </div>
              <div>
                <dt>Cập nhật lần cuối</dt>
                <dd>{dateLabel(overview.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div
          role="tabpanel"
          aria-label="Lịch trình"
          hidden={tab !== "itinerary"}
        >
          <RoadmapItinerary
            key={agentRevision}
            roadmapId={overview.id}
            overview={overview}
            itinerary={itinerary}
            openDays={openDays}
            onToggleDay={toggleDay}
            active={tab === "itinerary"}
            service={service}
            selectedItemId={selectedItemId}
            onSelectItem={selectContentItem}
            mapDayNumber={activeDay}
            onMapRouteChange={receiveMapRoute}
            onItemAdded={onItemAdded}
            onItemRemoved={onItemRemoved}
            onItemsGenerated={onItemsGenerated}
            onItemsMoved={onItemsMoved}
            onItemRated={onItemRated}
          />
          {tab === "itinerary" && (
            <div className="roadmap-itinerary-budget">
              <RoadmapBudget budget={budget} />
            </div>
          )}
        </div>
        <div role="tabpanel" aria-label="Ngân sách" hidden={tab !== "budget"}>
          {tab === "budget" && <RoadmapBudget budget={budget} />}
        </div>
      </div>
      <RoadmapDetailMap
        overview={overview}
        itinerary={itinerary}
        activeDay={activeDay}
        selectedItemId={selectedItemId}
        onSelectItem={selectItem}
        origin={effectiveRoute?.origin ?? null}
        originSkipped={effectiveRoute?.originSkipped ?? false}
        preview={
          previewOnMap && previewStops
            ? {
                stops: previewStops,
                days: agentMapDays(previewOnMap),
                activeDay: previewDay,
                selectedKey: previewSelected,
                onSelect: selectPreviewItem,
              }
            : null
        }
        agentPopupOpen={agentOpen && agentMode === "popup"}
        onOpenAgent={
          agentOpen
            ? undefined
            : () => {
                setAgentPopup(true);
                setAgentOpen(true);
              }
        }
      />
      <RoadmapAgentPanel
        open={agentOpen}
        mode={agentMode}
        compact={agentCompact}
        onToggleMode={() => setAgentPopup((value) => !value)}
        roadmapTitle={overview.title}
        userName={userName}
        userAvatar={userAvatar}
        onClose={closeAgent}
        agent={agent}
        selected={previewSelected}
        onSelect={selectPreviewItem}
        previewDay={previewDay}
        onPreviewDay={pickPreviewDay}
        mapView={agentMapView}
        onShowMap={() => {
          setAgentMapView(true);
          requestAnimationFrame(() => {
            document
              .querySelector(".roadmap-map-panel")
              ?.scrollIntoView({ block: "start" });
            document.querySelector<HTMLElement>(".agent-map-back")?.focus();
          });
        }}
      />
      {agentOpen && agentMapView && (
        <Button
          className="agent-map-back"
          onClick={() => {
            setAgentMapView(false);
            requestAnimationFrame(() =>
              document.querySelector<HTMLElement>(".agent-map-toggle")?.focus(),
            );
          }}
        >
          Quay lại trợ lý
        </Button>
      )}
    </div>
  );
}
