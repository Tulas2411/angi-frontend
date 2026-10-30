"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Button } from "@/shared/ui";
import { Media, Tabs } from "@/components/ui/primitives";
import { dishHref, restaurantHref } from "@/features/explore/explore-routes";
import {
  locationText,
  ratingText,
  vnd,
} from "@/features/explore/explore-rules";
import type { DishCardDto, TagDto } from "@/features/explore/explore-types";
import {
  revealedCards,
  rollError,
  rollRequest,
  rollTabs,
  stripSize,
  tabConditions,
  type RollTab,
} from "./roll-rules";
import {
  rollService,
  type RollDishResponseDto,
  type RollService,
} from "./roll-service";
import {
  brakeDurationFor,
  brakeTravel,
  cruiseDuration,
  cruiseTravel,
  maxTravel,
  planBrake,
  readGeometry,
  reelLength,
  type StripGeometry,
} from "./roll-spin-rules";
import "./roll-dish.css";
import { RollDishDialog, type RollDishPreview } from "./roll-dish-dialog";

type State =
  | { status: "ready" }
  | { status: "rolling" }
  | { status: "revealed"; result: RollDishResponseDto }
  | { status: "error"; message: string; exhausted: boolean };

/** The reel turns this long at least, so a quick answer still reads as a roll. */
const minimumTurn = cruiseDuration;

/**
 * F-18 Roll Dish ("Hôm nay ăn gì?"), ducbui's layout on real data: the tab picks the conditions,
 * the strip shows real dishes of that tab (DISH-01), DISH-03 picks the one under the marker, and
 * "Roll lại" leaves out what was already shown.
 */
export function RollDishPage({
  service = rollService,
}: {
  service?: RollService;
}) {
  const [tab, setTab] = useState<RollTab>("viet");
  const [tags, setTags] = useState<TagDto[] | null>(null);
  const [strip, setStrip] = useState<DishCardDto[]>([]);
  const [state, setState] = useState<State>({ status: "ready" });
  // Dishes already rolled with this tab; a new tab starts a new series.
  const [shown, setShown] = useState<number[]>([]);
  const rolling = useRef(false);
  const [preview, setPreview] = useState<RollDishPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<HTMLDivElement>(null);
  // The reel's travel is written to the DOM every frame; React re-renders only when the reel's
  // content changes.
  const travel = useRef(0);
  const [cards, setCards] = useState<(DishCardDto | null)[]>([]);

  function showDish(dish: Pick<DishCardDto, "id" | "name">) {
    if (state.status === "rolling") return;
    setPreview((previous) => ({
      id: dish.id,
      name: dish.name,
      visit: (previous?.visit ?? 0) + 1,
    }));
    setPreviewOpen(true);
  }

  useEffect(() => {
    let ignore = false;
    service
      .tags()
      .then((items) => {
        if (!ignore) setTags(items);
      })
      .catch(() => {
        if (!ignore) setTags([]);
      });
    return () => {
      ignore = true;
    };
  }, [service]);

  const conditions = tags ? tabConditions(tab, tags) : null;
  const stripKey = conditions ? JSON.stringify(conditions.strip) : "";
  useEffect(() => {
    if (!conditions) return;
    let ignore = false;
    service
      .strip(conditions.strip)
      .then((items) => {
        if (!ignore) setStrip(items.slice(0, stripSize));
      })
      .catch(() => {
        if (!ignore) setStrip([]);
      });
    return () => {
      ignore = true;
    };
    // The query is compared by value: `conditions` is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, stripKey]);

  // The reel holds the tab's dishes over and over, long enough for every one of them to pass by
  // under the marker while it turns.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !strip.length) {
      setCards([]);
      return;
    }
    const geometry = readGeometry(track);
    setCards(
      Array.from(
        { length: reelLength(geometry, maxTravel()) },
        (_, index) => strip[index % strip.length] ?? null,
      ),
    );
  }, [strip]);

  /**
   * The reel turns fast and then brakes to a full stop on the rolled dish. The dish cycle
   * repeats, so every dish of the tab goes by before the answer rests under the marker.
   *
   * The returned promise settles when the reel has come to a stop; `brake` starts the slowdown.
   */
  const spin = useCallback(
    (geometry: StripGeometry): {
      stopped: Promise<void>;
      brake: (dish: RollDishResponseDto["dish"]) => void;
    } => {
      let braking: {
        from: number;
        distance: number;
        duration: number;
        startedAt: number;
      } | null = null;
      const stopped = new Promise<void>((resolve) => {
        let frame = 0;
        let startedAt = 0;
        const loop = (now: number) => {
          if (!startedAt) startedAt = now;
          if (braking) {
            const u = (now - braking.startedAt) / braking.duration;
            travel.current = brakeTravel(
              braking.from,
              braking.distance,
              u,
            );
            if (u >= 1) {
              cancelAnimationFrame(frame);
              resolve();
              return;
            }
          } else {
            travel.current = cruiseTravel(now - startedAt);
          }
          const reel = reelRef.current;
          if (reel)
            reel.style.transform = `translate3d(${-travel.current}px, 0, 0)`;
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
      });
      // The brake is armed when the answer is in, so the reel keeps turning at full speed while
      // the answer comes in and then slows down to a stop.
      const brake = (dish: RollDishResponseDto["dish"]) => {
        if (braking) return;
        const from = travel.current;
        // The rolled dish waits in the slot that comes to rest under the marker, so the reel has
        // to show it there.
        const residue = Math.max(
          0,
          strip.findIndex((item) => item.id === dish.id),
        );
        const plan = planBrake(
          geometry,
          from,
          residue,
          Math.max(1, strip.length),
        );
        braking = {
          from,
          distance: plan.distance,
          duration: brakeDurationFor(plan.distance),
          startedAt: performance.now(),
        };
      };
      return { stopped, brake };
    },
    [strip],
  );

  async function roll(again: boolean) {
    if (rolling.current || !conditions) return;
    rolling.current = true;
    const exclude = again ? shown : [];
    setState({ status: "rolling" });
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    try {
      const track = trackRef.current;
      const geometry = track ? readGeometry(track) : null;
      // The reel starts from the beginning of its run.
      travel.current = 0;
      const reel = reelRef.current;
      if (reel) reel.style.transform = "translate3d(0, 0, 0)";
      const running = geometry ? spin(geometry) : null;
      const result = await service.roll(rollRequest(conditions.roll, exclude));
      if (reduce || !geometry || !track || !running) {
        setShown([...exclude, result.dish.id]);
        setState({ status: "revealed", result });
        return;
      }
      // The rolled dish waits in the slot that comes to rest under the marker, so the reel shows
      // it in every slot of its residue.
      const cycle = strip;
      const length = Math.max(1, cycle.length);
      const residue = Math.max(
        0,
        cycle.findIndex((dish) => dish.id === result.dish.id),
      );
      setCards(
        Array.from(
          { length: reelLength(geometry, maxTravel()) },
          (_, index) =>
            index % length === residue
              ? result.dish
              : cycle[index % length] ?? null,
        ),
      );
      // The reel turns for a moment even when the answer is already there.
      await new Promise((resolve) => setTimeout(resolve, minimumTurn));
      running.brake(result.dish);
      await running.stopped;
      setShown([...exclude, result.dish.id]);
      setState({ status: "revealed", result });
    } catch (caught) {
      setState({ status: "error", ...rollError(caught) });
    } finally {
      rolling.current = false;
    }
  }

  const unavailable = tags !== null && !conditions;
  const revealed = state.status === "revealed" ? state.result.dish : null;
  const row = revealed
    ? revealedCards<DishCardDto | RollDishResponseDto["dish"]>(strip, revealed)
    : null;
  const place = revealed
    ? locationText(
        revealed.restaurant.district,
        revealed.restaurant.provinceName,
      )
    : "";

  return (
    <div className="roll-page">
      <p className="roll-eyebrow">Gợi ý bữa ăn · Roll Dish</p>
      <h1>Hôm nay ăn gì?</h1>
      <p className="roll-lead">Để ANGI chọn giúp bạn nhé!</p>
      <div className="roll-tabs">
        <Tabs
          label="Bạn muốn ăn gì"
          value={tab}
          onChange={(value) => {
            setTab(value as RollTab);
            setShown([]);
            setState({ status: "ready" });
            setCards([]);
          }}
          items={rollTabs}
        />
      </div>

      {unavailable ? (
        <div className="roll-empty">
          <h2>Chưa có thẻ món chay</h2>
          <p>Danh mục món chưa có thẻ ăn chay. Hãy chọn lựa chọn khác.</p>
        </div>
      ) : (
        <>
          <div
            ref={trackRef}
            className={`roll-track${row ? " is-revealed" : ""}`}
            aria-busy={state.status === "rolling"}
            data-state={state.status}
          >
            <span className="roll-marker" aria-hidden="true" />
            {row ? (
              <div key="revealed" className="roll-strip">
                {row.cards.map((dish, index) => (
                  <RollCard
                    key={dish.id}
                    dish={dish}
                    tone={index === row.selected ? "selected" : "dimmed"}
                    onOpen={() => showDish(dish)}
                    expanded={previewOpen && preview?.id === dish.id}
                  />
                ))}
              </div>
            ) : (
              <div key="reel" ref={reelRef} className="roll-strip is-reeling">
                {cards.map((dish, index) =>
                  dish ? (
                    <RollCard
                      key={`${index}-${dish.id}`}
                      dish={dish}
                      // The reel shows every dish plainly; the answer is only marked once the
                      // roll has stopped.
                      onOpen={() => showDish(dish)}
                      disabled={state.status === "rolling"}
                      expanded={previewOpen && preview?.id === dish.id}
                    />
                  ) : (
                    <div
                      key={`blank-${index}`}
                      className="roll-card roll-card-blank"
                      aria-hidden
                    >
                      <span>?</span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {revealed ? (
            <section
              className="roll-result"
              aria-labelledby="roll-result-title"
            >
              <h2>Chốt món này nhé!</h2>
              <h3 id="roll-result-title">
                <Link href={dishHref(revealed.id)}>{revealed.name}</Link>
              </h3>
              <p className="roll-result-price">Khoảng {vnd(revealed.price)}</p>
              <p className="roll-result-place">
                {revealed.restaurant.name}
                {place && ` · ${place}`}
                {` · ${ratingText(revealed.restaurant.ratingAvg)} sao`}
              </p>
              {revealed.description && <p>{revealed.description}</p>}
              <div className="roll-result-actions">
                <Link
                  className="button button-secondary"
                  href={restaurantHref(revealed.restaurant.id)}
                >
                  Xem quán ăn
                </Link>
                <Link
                  className="button button-secondary"
                  href={dishHref(revealed.id)}
                >
                  Xem món
                </Link>
                <Button onClick={() => void roll(true)}>Roll lại</Button>
              </div>
            </section>
          ) : (
            <div className="roll-actions">
              {state.status === "error" && (
                <Alert tone={state.exhausted ? "warning" : "error"}>
                  {state.message}
                </Alert>
              )}
              <Button
                loading={state.status === "rolling"}
                disabled={tags === null}
                onClick={() =>
                  void roll(state.status === "error" && !state.exhausted)
                }
              >
                {state.status === "error"
                  ? state.exhausted
                    ? "Roll lại từ đầu"
                    : "Thử lại"
                  : "Roll món ngay"}
              </Button>
            </div>
          )}
        </>
      )}

      <span role="status" className="sr-only">
        {state.status === "rolling"
          ? "Đang chọn món"
          : revealed
            ? `Món đã chọn: ${revealed.name}`
            : "Sẵn sàng chọn món"}
      </span>
      <RollDishDialog
        preview={preview}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}

function RollCard({
  dish,
  tone,
  onOpen,
  disabled = false,
  expanded = false,
}: {
  dish: Pick<DishCardDto, "id" | "name" | "price" | "coverUrl">;
  tone?: "selected" | "dimmed";
  onOpen: () => void;
  disabled?: boolean;
  expanded?: boolean;
}) {
  return (
    <article className={`roll-card${tone ? ` is-${tone}` : ""}`}>
      <Media src={dish.coverUrl ?? undefined} alt={dish.name} />
      <h3>{dish.name}</h3>
      <p>{vnd(dish.price)}</p>
      <button
        type="button"
        className="roll-card-open"
        aria-label={`Xem chi tiết ${dish.name}`}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        disabled={disabled}
        onClick={onOpen}
      />
    </article>
  );
}
