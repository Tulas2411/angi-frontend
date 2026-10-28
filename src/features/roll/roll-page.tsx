"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Button } from "@/shared/ui";
import { Media, SelectField } from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { dishHref, restaurantHref } from "@/features/explore/explore-routes";
import {
  dishFormLabels,
  dishPriceOptions,
  locationText,
  ratingText,
  vnd,
} from "@/features/explore/explore-rules";
import type { TagDto } from "@/features/explore/explore-types";
import {
  emptyRollFilters,
  geolocationMessages,
  rollError,
  rollMealOptions,
  rollRadiusOptions,
  rollRequest,
  type RollFilters,
  type RollPosition,
} from "./roll-rules";
import {
  rollService,
  type RollDishResponseDto,
  type RollService,
} from "./roll-service";
import "./roll.css";

type Outcome =
  | { status: "idle" }
  | { status: "rolling" }
  | { status: "ready"; result: RollDishResponseDto }
  | { status: "error"; message: string; exhausted: boolean };

/** F-18 Roll Dish: DISH-03 with the conditions it accepts; "roll again" leaves out what was shown. */
export function RollPage({ service = rollService }: { service?: RollService }) {
  const [filters, setFilters] = useState<RollFilters>(emptyRollFilters);
  const [tags, setTags] = useState<TagDto[]>([]);
  const [outcome, setOutcome] = useState<Outcome>({ status: "idle" });
  // Dishes already shown with these conditions; cleared when a condition changes.
  const [shown, setShown] = useState<number[]>([]);
  const [position, setPosition] = useState<RollPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationProblem, setLocationProblem] = useState("");
  const rolling = useRef(false);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let ignore = false;
    service
      .tags()
      .then((items) => {
        // Meal times have their own select; the chips are the kinds of dish.
        if (!ignore)
          setTags(items.filter((tag) => tag.tagType !== "meal_time"));
      })
      .catch(() => {
        if (!ignore) setTags([]);
      });
    return () => {
      ignore = true;
    };
  }, [service]);

  function change(next: Partial<RollFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setShown([]);
  }

  function locate() {
    setLocationProblem("");
    if (!("geolocation" in navigator)) {
      setLocationProblem(geolocationMessages.unsupported);
      change({ nearby: false });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({ latitude: coords.latitude, longitude: coords.longitude });
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setLocationProblem(
          error.code === error.PERMISSION_DENIED
            ? geolocationMessages.denied
            : geolocationMessages.failed,
        );
        change({ nearby: false });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function roll(again: boolean) {
    if (rolling.current) return;
    if (filters.nearby && !position) return;
    rolling.current = true;
    const exclude = again ? shown : [];
    setOutcome({ status: "rolling" });
    try {
      const result = await service.roll(
        rollRequest(filters, exclude, filters.nearby ? position : null),
      );
      setShown([...exclude, result.dish.id]);
      setOutcome({ status: "ready", result });
      requestAnimationFrame(() =>
        resultRef.current?.focus({ preventScroll: false }),
      );
    } catch (caught) {
      setOutcome({ status: "error", ...rollError(caught) });
    } finally {
      rolling.current = false;
    }
  }

  const busy = outcome.status === "rolling";
  const waitingForPosition = filters.nearby && !position;
  const dish = outcome.status === "ready" ? outcome.result.dish : null;
  const place = dish
    ? locationText(dish.restaurant.district, dish.restaurant.provinceName)
    : "";

  return (
    <div className="roll-page">
      <header className="roll-heading">
        <h1>Hôm nay ăn gì?</h1>
        <p>
          ANGI chọn ngẫu nhiên một món hợp gu bạn, trong những món đang bán ở
          các quán trên ANGI.
        </p>
      </header>

      <div className="roll-layout">
        <section className="roll-panel" aria-labelledby="roll-conditions">
          <h2 id="roll-conditions">Điều kiện</h2>
          <div className="roll-fields">
            <SelectField
              label="Bữa"
              value={filters.mealTime}
              options={rollMealOptions}
              onChange={(value) =>
                change({ mealTime: value as RollFilters["mealTime"] })
              }
            />
            <SelectField
              label="Mức giá"
              value={filters.maxPrice}
              options={dishPriceOptions}
              onChange={(value) => change({ maxPrice: value })}
            />
          </div>

          <fieldset className="roll-where">
            <legend>Ở đâu</legend>
            <div className="roll-where-choices" role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={!filters.nearby}
                className={`chip ${filters.nearby ? "" : "selected"}`}
                onClick={() => change({ nearby: false })}
              >
                Theo tỉnh/thành
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={filters.nearby}
                className={`chip ${filters.nearby ? "selected" : ""}`}
                onClick={() => {
                  change({ nearby: true });
                  if (!position) locate();
                }}
              >
                Gần tôi
              </button>
            </div>
            {filters.nearby ? (
              <div className="roll-fields">
                <SelectField
                  label="Bán kính"
                  value={filters.radiusKm}
                  options={rollRadiusOptions}
                  onChange={(value) => change({ radiusKm: value })}
                />
                <p className="helper roll-position" role="status">
                  {locating
                    ? "Đang lấy vị trí hiện tại…"
                    : position
                      ? "Đã có vị trí hiện tại. Tọa độ chỉ dùng cho lần roll này, không được lưu."
                      : ""}
                </p>
              </div>
            ) : (
              <ProvinceField
                label="Tỉnh / thành phố"
                type="search"
                value={filters.province}
                showCatalogStatus={false}
                autoComplete="off"
                helper="Để trống để roll ở mọi nơi."
                onChange={(value) => change({ province: value })}
              />
            )}
            {locationProblem && <Alert tone="warning">{locationProblem}</Alert>}
          </fieldset>

          {tags.length > 0 && (
            <fieldset className="roll-tags">
              <legend>Muốn ăn</legend>
              <div className="roll-chip-row">
                {tags.map((tag) => {
                  const selected = filters.tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={`chip ${selected ? "selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() =>
                        change({
                          tagIds: selected
                            ? filters.tagIds.filter((id) => id !== tag.id)
                            : [...filters.tagIds, tag.id],
                        })
                      }
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="roll-actions">
            <Button
              className="roll-button"
              loading={busy}
              disabled={waitingForPosition}
              onClick={() => void roll(false)}
            >
              Roll món
            </Button>
            <Button
              variant="tertiary"
              onClick={() => {
                setFilters(emptyRollFilters);
                setShown([]);
                setLocationProblem("");
                setOutcome({ status: "idle" });
              }}
            >
              Đặt lại
            </Button>
          </div>
        </section>

        <section
          ref={resultRef}
          tabIndex={-1}
          className="roll-result"
          aria-labelledby="roll-result-title"
          aria-busy={busy}
          aria-live="polite"
          data-state={outcome.status}
        >
          {dish ? (
            <>
              <Media
                className="roll-result-media"
                src={dish.coverUrl ?? dish.images[0] ?? undefined}
                alt={dish.name}
              />
              <div className="roll-result-body">
                <h2 id="roll-result-title">
                  <Link href={dishHref(dish.id)}>{dish.name}</Link>
                </h2>
                <p className="roll-result-price">{vnd(dish.price)}</p>
                <p className="roll-result-place">
                  <Link href={restaurantHref(dish.restaurant.id)}>
                    {dish.restaurant.name}
                  </Link>
                  {place && ` · ${place}`}
                  {dish.restaurant.distanceKm !== null &&
                    ` · cách ${dish.restaurant.distanceKm.toLocaleString("vi-VN")} km`}
                </p>
                <p className="roll-result-facts">
                  <span>{dishFormLabels[dish.dishForm]}</span>
                  <span>{ratingText(dish.restaurant.ratingAvg)} sao</span>
                  {dish.tags.slice(0, 4).map((tag) => (
                    <span key={tag.id}>{tag.name}</span>
                  ))}
                </p>
                {dish.description && (
                  <p className="roll-result-description">{dish.description}</p>
                )}
                <div className="roll-result-actions">
                  <Link
                    className="button button-primary"
                    href={dishHref(dish.id)}
                  >
                    Xem món <span aria-hidden>→</span>
                  </Link>
                  <Button variant="secondary" onClick={() => void roll(true)}>
                    Roll món khác
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="roll-result-empty">
              <span className="roll-dice" aria-hidden>
                {busy ? "…" : "?"}
              </span>
              <h2 id="roll-result-title">
                {busy
                  ? "Đang chọn món…"
                  : outcome.status === "error"
                    ? outcome.exhausted
                      ? "Hết món hợp điều kiện"
                      : "Chưa roll được món"
                    : "Chọn điều kiện rồi bấm Roll món"}
              </h2>
              {outcome.status === "error" ? (
                <>
                  <Alert tone={outcome.exhausted ? "warning" : "error"}>
                    {outcome.message}
                  </Alert>
                  {!outcome.exhausted && (
                    <Button variant="secondary" onClick={() => void roll(true)}>
                      Thử lại
                    </Button>
                  )}
                  {outcome.exhausted && shown.length > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShown([]);
                        void roll(false);
                      }}
                    >
                      Roll lại từ đầu
                    </Button>
                  )}
                </>
              ) : (
                !busy && (
                  <p className="helper">
                    Không chọn gì cũng được: ANGI sẽ gợi ý từ mọi món đang bán.
                  </p>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
