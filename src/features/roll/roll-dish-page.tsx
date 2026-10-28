"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import "./roll-dish.css";
import { RollDishDialog, type RollDishPreview } from "./roll-dish-dialog";

type State =
  | { status: "ready" }
  | { status: "rolling" }
  | { status: "revealed"; result: RollDishResponseDto }
  | { status: "error"; message: string; exhausted: boolean };

/** The strip keeps turning at least this long, so a fast answer still reads as a roll. */
const minimumSpin = 1600;

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

  async function roll(again: boolean) {
    if (rolling.current || !conditions) return;
    rolling.current = true;
    const exclude = again ? shown : [];
    setState({ status: "rolling" });
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const spin = new Promise((resolve) =>
      setTimeout(resolve, reduce ? 0 : minimumSpin),
    );
    try {
      const [result] = await Promise.all([
        service.roll(rollRequest(conditions.roll, exclude)),
        spin,
      ]);
      setShown([...exclude, result.dish.id]);
      setState({ status: "revealed", result });
    } catch (caught) {
      await spin;
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
  // Rolling repeats the strip twice for an endless marquee; an empty strip turns blank cards.
  const turning: (DishCardDto | null)[] = strip.length
    ? strip
    : Array.from({ length: stripSize }, () => null);
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
            className={`roll-track${row ? " is-revealed" : ""}`}
            aria-busy={state.status === "rolling"}
            data-state={state.status}
            style={{ "--strip-count": turning.length } as CSSProperties}
          >
            <span className="roll-marker" aria-hidden="true" />
            {row ? (
              <div className="roll-strip">
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
              [0, 1].map((copy) => (
                <div
                  key={copy}
                  className="roll-strip"
                  aria-hidden={copy === 1 ? "true" : undefined}
                  inert={copy === 1 || state.status === "rolling"}
                >
                  {turning.map((dish, index) =>
                    dish ? (
                      <RollCard
                        key={`${copy}-${dish.id}`}
                        dish={dish}
                        onOpen={() => showDish(dish)}
                        disabled={copy === 1 || state.status === "rolling"}
                        expanded={
                          copy === 0 && previewOpen && preview?.id === dish.id
                        }
                      />
                    ) : (
                      <div
                        key={`${copy}-blank-${index}`}
                        className="roll-card roll-card-blank"
                        aria-hidden
                      >
                        <span>?</span>
                      </div>
                    ),
                  )}
                </div>
              ))
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
