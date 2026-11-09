"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { HeartIcon } from "@heroicons/react/20/solid";
import { Badge } from "@/shared/ui";
import { ActionLink, Dialog, Media } from "@/components/ui/primitives";
import { dishHref } from "./explore-routes";
import { dishFormLabels } from "./explore-rules";
import type { MenuDishDto } from "./explore-types";
import {
  dishAt,
  menuPrice,
  platesBetween,
  snapTurn,
  stepsTo,
  turnDuration,
  wheelCounter,
  wheelStep,
} from "./menu-wheel-rules";
import "./wood-plate.css";
import "./menu-wheel.css";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Plate-to-card morph (prompt §3.4). */
const openMs = 550;
const closeMs = 450;
const morphEasing = "cubic-bezier(0.65, 0, 0.25, 1)";

/**
 * Digits that roll like an odometer when the value changes; other characters stay put. Columns
 * are keyed from the right, so "45.000đ" → "169.000đ" rolls the digits that changed.
 */
function Rolling({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const chars = [...text];
  return (
    <span className={`menu-roll ${className}`.trim()}>
      <span className="sr-only">{text}</span>
      <span className="menu-roll-digits" aria-hidden>
        {chars.map((char, index) => {
          const key = chars.length - index;
          return /\d/.test(char) ? (
            <span
              key={key}
              className="menu-roll-column"
              style={{ "--digit": Number(char) } as CSSProperties}
            >
              {"0123456789".split("").map((digit) => (
                <span key={digit}>{digit}</span>
              ))}
            </span>
          ) : (
            <span key={key}>{char}</span>
          );
        })}
      </span>
    </span>
  );
}

/** Name, description, price and kind of the dish on the plate (prompt §2.6, §3.2). */
function DishInfo({
  dish,
  leaving = false,
}: {
  dish: MenuDishDto;
  leaving?: boolean;
}) {
  const tags = dish.tags.filter(
    (tag) => tag.name !== dishFormLabels[dish.dishForm],
  );
  return (
    <div
      className={`menu-wheel-info ${leaving ? "is-leaving" : ""}`.trim()}
      aria-hidden={leaving || undefined}
    >
      <p className="menu-wheel-eyebrow">
        — Chi tiết · Hương vị &amp; đặc điểm —
      </p>
      <h3 aria-live={leaving ? undefined : "polite"}>{dish.name}</h3>
      <p className="menu-wheel-description">
        {dish.description?.trim() || "Quán chưa viết mô tả cho món này."}
      </p>
      <p className="menu-wheel-meta">
        {leaving ? (
          <strong>{menuPrice(dish.price)}</strong>
        ) : (
          <Rolling className="menu-wheel-price" text={menuPrice(dish.price)} />
        )}
        <span className="menu-wheel-divider" aria-hidden />
        <span>{dishFormLabels[dish.dishForm]}</span>
        <span className="menu-wheel-divider" aria-hidden />
        <span
          className="menu-wheel-likes"
          aria-label={`${dish.likeCount} lượt thích`}
        >
          <HeartIcon aria-hidden />
          {dish.likeCount.toLocaleString("vi-VN")}
        </span>
      </p>
      {(tags.length > 0 || !dish.isAvailable) && (
        <p className="menu-wheel-tags">
          {!dish.isAvailable && <Badge tone="warning">Tạm hết món</Badge>}
          {tags.slice(0, 4).map((tag, index) => (
            <span key={tag.id}>
              {index > 0 && <span aria-hidden> · </span>}
              {tag.name}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/**
 * "Thực đơn" as a turning wooden wheel (angi-menu-wheel-prompt.md): the dish on the plate at the
 * bottom of a walnut half-disc, the others on the same endless wheel. Choosing a dish turns the
 * wheel along its arc; pressing the plate turns it into the dish's card. Everything shown comes
 * from REST-03 (the description is on each dish card); nothing is invented for the effect.
 */
export function MenuWheel({
  restaurantName,
  dishes,
}: {
  restaurantName: string;
  dishes: readonly MenuDishDto[];
}) {
  const n = dishes.length;
  const [turn, setTurn] = useState(0);
  /** The plate the wheel left from, so both ends of the arc stay drawn while it turns. */
  const [from, setFrom] = useState(0);
  const [duration, setDuration] = useState(0);
  const [turning, setTurning] = useState(false);
  /** Steps the wheel is dragged by, while a finger or the mouse holds it. */
  const [drag, setDrag] = useState<number | null>(null);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [detail, setDetail] = useState(false);
  /** The first plate drops onto the wheel once, when the section appears. */
  const [intro, setIntro] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLButtonElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const timers = useRef<number[]>([]);
  const lastWheel = useRef(0);
  const morphing = useRef(false);
  /** A drag that ends on the plate must not open it. */
  const dragged = useRef(false);
  const pointer = useRef<{
    id: number;
    x: number;
    time: number;
    offset: number;
    velocity: number;
    moved: boolean;
  } | null>(null);

  const index = dishAt(turn, n);
  const dish = dishes[index];

  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), 1100);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);
  const later = (run: () => void, ms: number) => {
    timers.current.push(window.setTimeout(run, ms));
  };

  /** Turns the wheel to plate `target`, the old text fading out while the new one comes in. */
  const turnTo = useCallback(
    (target: number, start: number, ms: number) => {
      if (target === start && ms === 0) return;
      setFrom(start);
      setTurn(target);
      setDuration(reducedMotion() ? 0 : ms);
      setTurning(true);
      if (dishAt(start, n) !== dishAt(target, n)) setLeaving(dishAt(start, n));
      later(() => setLeaving(null), 260);
      later(
        () => {
          setTurning(false);
          setFrom(target);
        },
        (reducedMotion() ? 0 : ms) + 60,
      );
    },
    [n],
  );
  const step = (steps: number) => {
    if (n < 2 || steps === 0 || detail) return;
    turnTo(turn + steps, turn, turnDuration(steps));
  };
  const choose = (target: number) => step(stepsTo(turn, target, n));

  // Keep the chosen card in view inside the row (never scrolls the page).
  useEffect(() => {
    const row = track.current;
    const card = row?.children[index] as HTMLElement | undefined;
    if (!row || !card) return;
    row.scrollTo({
      left: card.offsetLeft - (row.clientWidth - card.offsetWidth) / 2,
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }, [index]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (n < 2 || detail || event.button !== 0) return;
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      time: event.timeStamp,
      offset: 0,
      velocity: 0,
      moved: false,
    };
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const held = pointer.current;
    const element = stage.current;
    if (!held || held.id !== event.pointerId || !element) return;
    const dx = event.clientX - held.x;
    if (!held.moved && Math.abs(dx) < 6) return;
    if (!held.moved) {
      held.moved = true;
      element.setPointerCapture(event.pointerId);
    }
    // Dragging right brings the next dish in from the left (the wheel turns counter-clockwise).
    const offset = Math.max(
      -1.4,
      Math.min(1.4, dx / (element.clientWidth * 0.32)),
    );
    const elapsed = Math.max(1, event.timeStamp - held.time);
    held.velocity = ((offset - held.offset) / elapsed) * 1000;
    held.offset = offset;
    held.time = event.timeStamp;
    setDrag(offset);
  }
  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const held = pointer.current;
    if (!held || held.id !== event.pointerId) return;
    pointer.current = null;
    if (!held.moved) return;
    dragged.current = true;
    later(() => {
      dragged.current = false;
    }, 0);
    const target = snapTurn(turn + held.offset, held.velocity);
    setDrag(null);
    // Starts from where the hand left the wheel: the transition runs from the dragged angle.
    turnTo(target, turn, target === turn ? 380 : 480);
  }

  function onWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    if (Math.abs(event.deltaX) < 20) return;
    const now = event.timeStamp;
    if (now - lastWheel.current < turnDuration(1)) return;
    lastWheel.current = now;
    step(event.deltaX > 0 ? 1 : -1);
  }

  /** The plate grows into the dish card: FLIP from the plate's box to the dialog's. */
  const dialogElement = () =>
    document.querySelector<HTMLElement>(".menu-dish-dialog");
  useEffect(() => {
    if (!detail) return;
    // A card closed by the morph keeps its faded backdrop class until it opens again.
    dialogElement()?.classList.remove("is-closing");
    if (reducedMotion()) return;
    const card = dialogElement();
    const source = plate.current?.getBoundingClientRect();
    if (!card || !source) return;
    const target = card.getBoundingClientRect();
    const dx =
      source.left + source.width / 2 - (target.left + target.width / 2);
    const dy =
      source.top + source.height / 2 - (target.top + target.height / 2);
    morphing.current = true;
    card
      .animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scale(${source.width / target.width}, ${source.height / target.height})`,
            borderRadius: "50%",
          },
          { transform: "none", borderRadius: "28px" },
        ],
        {
          duration: openMs - 150,
          delay: 100,
          easing: morphEasing,
          fill: "backwards",
        },
      )
      .finished.finally(() => {
        morphing.current = false;
      });
    card
      .querySelectorAll<HTMLElement>(".dialog-heading, .menu-dish-row")
      .forEach((row, order) =>
        row.animate(
          [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 250,
            delay: 300 + order * 40,
            easing: "ease-out",
            fill: "backwards",
          },
        ),
      );
  }, [detail]);

  function closeDetail() {
    const card = dialogElement();
    const source = plate.current?.getBoundingClientRect();
    if (!card || !source || reducedMotion()) {
      setDetail(false);
      return;
    }
    if (morphing.current) return;
    morphing.current = true;
    // The backdrop fades while the card flies back, so nothing is left to fade once it lands.
    card.classList.add("is-closing");
    const target = card.getBoundingClientRect();
    const dx =
      source.left + source.width / 2 - (target.left + target.width / 2);
    const dy =
      source.top + source.height / 2 - (target.top + target.height / 2);
    card
      .querySelectorAll<HTMLElement>(".dialog-heading, .menu-dish-row")
      .forEach((row) =>
        row.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 120,
          fill: "forwards",
        }),
      );
    card
      .animate(
        [
          { transform: "none", borderRadius: "28px" },
          {
            transform: `translate(${dx}px, ${dy}px) scale(${source.width / target.width}, ${source.height / target.height})`,
            borderRadius: "50%",
          },
        ],
        {
          duration: closeMs - 80,
          delay: 80,
          easing: morphEasing,
          fill: "forwards",
        },
      )
      .finished.finally(() => {
        morphing.current = false;
        setDetail(false);
      });
  }

  if (!dish) return null;
  const position = turn + (drag ?? 0);
  const plates =
    drag === null
      ? platesBetween(from, turn)
      : platesBetween(turn - 1, turn + 1);
  const leavingDish = leaving === null ? null : dishes[leaving];

  return (
    <section
      className="menu-wheel"
      aria-roledescription="vòng thực đơn"
      aria-label={`Thực đơn của ${restaurantName}`}
      data-detail={detail || undefined}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement) return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          step(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          step(-1);
        }
      }}
    >
      <div
        ref={stage}
        className="menu-wheel-stage"
        data-intro={intro || undefined}
        data-turning={turning || drag !== null || undefined}
        data-dragging={drag !== null || undefined}
        style={
          {
            "--spin": `${-position * wheelStep}deg`,
            "--grain": `${position * 26}px`,
            "--turn-ms": `${duration}ms`,
          } as CSSProperties
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div className="menu-wood" aria-hidden />
        <p className="menu-wheel-tagline">
          Ăn ngon.
          <br />
          Đi xa. Nhớ lâu.
          <small>Thực đơn · {restaurantName}</small>
        </p>
        {n > 1 && (
          <p className="menu-wheel-hint">
            <span aria-hidden>↻</span>
            Kéo hoặc nhấn
            <br />
            để xem món khác
          </p>
        )}
        {plates.map((k) => {
          const shown = dishes[dishAt(k, n)];
          const active = k === turn;
          return (
            <button
              key={k}
              ref={active ? plate : undefined}
              type="button"
              className="menu-plate"
              data-active={active || undefined}
              style={{ "--angle": `${k * wheelStep}deg` } as CSSProperties}
              tabIndex={active ? 0 : -1}
              aria-hidden={active ? undefined : true}
              aria-label={active ? `Xem chi tiết ${shown.name}` : undefined}
              aria-haspopup={active ? "dialog" : undefined}
              onClick={(event) => {
                if (!active || turning || detail || dragged.current) {
                  event.preventDefault();
                  return;
                }
                setDetail(true);
              }}
            >
              <span className="menu-plate-face">
                <Media
                  className="menu-plate-food"
                  src={shown.coverUrl ?? undefined}
                  alt=""
                />
              </span>
            </button>
          );
        })}
      </div>

      <div className="menu-wheel-copy">
        {leavingDish && (
          <DishInfo key={`leaving-${leaving}`} dish={leavingDish} leaving />
        )}
        <DishInfo key={`dish-${turn}`} dish={dish} />
      </div>

      {n > 1 && (
        <div className="menu-wheel-picker">
          <div className="menu-wheel-picker-head">
            <p>Hôm nay, bạn muốn thưởng thức gì?</p>
            <p className="menu-wheel-counter">
              Phong vị <Rolling text={wheelCounter(index, n)} />
            </p>
          </div>
          <div className="menu-wheel-row">
            <button
              type="button"
              className="menu-wheel-arrow"
              aria-label="Món trước"
              onClick={() => step(-1)}
            >
              ‹
            </button>
            <ul ref={track} className="menu-wheel-cards">
              {dishes.map((entry, order) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="menu-wheel-card"
                    aria-pressed={order === index}
                    onClick={() => choose(order)}
                  >
                    <Media src={entry.coverUrl ?? undefined} alt="" />
                    <span>
                      <strong>{entry.name}</strong>
                      <small>{menuPrice(entry.price)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="menu-wheel-arrow"
              aria-label="Món tiếp theo"
              onClick={() => step(1)}
            >
              ›
            </button>
          </div>
          {n <= 12 && (
            <p className="menu-wheel-dots" aria-hidden>
              {dishes.map((entry, order) => (
                <span
                  key={entry.id}
                  data-active={order === index || undefined}
                />
              ))}
            </p>
          )}
        </div>
      )}

      {detail && (
        <Dialog
          open
          title={dish.name}
          className="menu-dish-dialog"
          onClose={closeDetail}
        >
          <p className="menu-dish-row menu-wheel-eyebrow">
            Chi tiết · Hương vị &amp; đặc điểm
          </p>
          <p className="menu-dish-row menu-dish-description">
            {dish.description?.trim() || "Quán chưa viết mô tả cho món này."}
          </p>
          {dish.tags.length > 0 && (
            <div className="menu-dish-row">
              <p className="menu-dish-label">Đặc điểm nổi bật</p>
              <ul className="menu-dish-chips">
                {dish.tags.slice(0, 4).map((tag) => (
                  <li key={tag.id}>
                    <Media src={dish.coverUrl ?? undefined} alt="" />
                    {tag.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="menu-dish-row menu-dish-tiles">
            <p>
              <small>Loại món</small>
              {dishFormLabels[dish.dishForm]}
            </p>
            <p>
              <small>Được yêu thích</small>
              {dish.likeCount.toLocaleString("vi-VN")} lượt thích
            </p>
          </div>
          <div className="menu-dish-row menu-dish-footer">
            <p>
              <small>Giá / phần</small>
              <strong>{menuPrice(dish.price)}</strong>
            </p>
            <span className="menu-dish-actions">
              {!dish.isAvailable && <Badge tone="warning">Tạm hết món</Badge>}
              <ActionLink href={dishHref(dish.id)}>Xem trang món</ActionLink>
            </span>
          </div>
        </Dialog>
      )}
    </section>
  );
}
