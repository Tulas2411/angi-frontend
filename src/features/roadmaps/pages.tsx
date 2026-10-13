"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  Choice,
  Combobox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Icon,
  Media,
  SelectField,
  Tabs,
  TextArea,
} from "@/components/ui/primitives";
import { MapPicker } from "@/components/domain/map-picker";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";
import {
  dateLabel,
  money,
  tripDates,
  validateDateRange,
} from "@/features/platform/rules";
import type { ItineraryItem } from "@/features/platform/contracts";
import { TripExpenses } from "./expenses";

export function TripList() {
  const { data, mutate } = usePlatform(),
    { base } = useWorkspace(),
    [remove, setRemove] = useState<string | null>(null);
  return (
    <div className="container workspace stack">
      <PageHeading
        title="Lịch ăn của tôi"
        description="Những hành trình ăn ngon của riêng bạn."
        action={
          <ActionLink href={`${base}/roadmaps/new`}>Tạo lịch ăn</ActionLink>
        }
      />
      <div className="grid-3">
        {data.trips.map((t) => (
          <Card key={t.id} title={t.name}>
            <Media
              src="/assets/figma/food-inspiration.png"
              alt={t.destination}
            />
            <p>
              {t.destination} · {t.days.length} ngày
            </p>
            <p className="helper">
              {dateLabel(t.start)}–{dateLabel(t.end)}
            </p>
            <ActionLink href={`${base}/roadmaps/${t.id}`}>
              Mở lịch ăn
            </ActionLink>
            <div className="actions">
              <ActionLink
                href={`${base}/roadmaps/${t.id}?view=readonly`}
                secondary
              >
                Chỉ xem
              </ActionLink>
              <Button variant="tertiary" onClick={() => setRemove(t.id)}>
                Xóa lịch
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {!data.trips.length && (
        <EmptyState
          title="Lịch ăn của bạn còn trống"
          action={
            <ActionLink href={`${base}/roadmaps/new`}>Tạo lịch ăn</ActionLink>
          }
        >
          Sắp xếp các bữa theo ngày, món ăn và quán phục vụ.
        </EmptyState>
      )}
      <ConfirmDialog
        open={!!remove}
        title="Xóa lịch ăn?"
        destructive
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          await mutate((d) => {
            d.trips = d.trips.filter((t) => t.id !== remove);
          });
          setRemove(null);
        }}
      >
        <p>
          Lịch bị xóa khỏi bản minh họa. Các bản chụp đã đính kèm cẩm nang vẫn
          giữ nguyên.
        </p>
      </ConfirmDialog>
    </div>
  );
}
export function NewTripPage() {
  const { data, mutate, busy } = usePlatform(),
    { base } = useWorkspace(),
    router = useRouter(),
    [destination, setDestination] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [budget, setBudget] = useState(""),
    [mapOpen, setMapOpen] = useState(false),
    [privacy, setPrivacy] = useState<"private" | "public">("private"),
    [invite, setInvite] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="container trip-create">
      <section className="trip-intro">
        <p className="eyebrow">Ăn theo cách của bạn</p>
        <h1>
          Mỗi ngày,
          <br />
          một vị ngon mới.
        </h1>
        <p>
          Chọn nơi bạn đến và thời gian. ANGI giúp bạn sắp xếp những bữa ăn đáng
          nhớ.
        </p>
        <Media
          src="/assets/figma/food-inspiration.png"
          alt="Cảm hứng ẩm thực Việt"
        />
      </section>
      <Card className="soft trip-form" title="Lên lịch ăn ngon">
        <form
          className="stack-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const problem = validateDateRange(start, end);
            if (problem) {
              setError(problem);
              return;
            }
            if (!destination.trim()) {
              setError("Chọn nơi bạn muốn đến.");
              return;
            }
            const days = tripDates(start, end);
            if (days.length > 31) {
              setError(
                "Bản minh họa hỗ trợ xem tối đa 31 ngày. Hợp đồng giới hạn thực tế đang chờ API.",
              );
              return;
            }
            const id = crypto.randomUUID();
            await mutate((d) => {
              d.trips.unshift({
                id,
                name: `Ăn ngon ${destination}`,
                destination,
                start,
                end,
                budget: Number(budget),
                notes: "",
                readOnly: false,
                privacy,
                days: days.map((date, i) => ({
                  date,
                  items: (data.trips[0]?.days[0].items ?? []).map((item) => ({
                    ...item,
                    id: `${id}-${i}-${item.id}`,
                    feedback: null,
                  })),
                })),
              });
            }, "Đã tạo lịch ăn minh họa.");
            router.push(`${base}/roadmaps/${id}`);
          }}
        >
          <Combobox
            label="Ăn ở đâu?"
            value={destination}
            onChange={setDestination}
            options={["Hà Nội", "Đà Nẵng", "Đà Lạt", "Hồ Chí Minh", "Huế"]}
          />
          <div className="actions">
            <Button variant="tertiary" onClick={() => setMapOpen(true)}>
              Chọn địa điểm trên bản đồ
            </Button>
            <p className="helper">Chọn thành phố hoặc địa điểm trên bản đồ.</p>
          </div>
          <div className="grid-2">
            <Field
              label="Ngày bắt đầu"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
            <Field
              label="Ngày kết thúc"
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </div>
          <Field
            label="Ngân sách dự kiến"
            type="number"
            inputMode="numeric"
            min={0}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Nhập ngân sách"
            helper="VNĐ · Ngân sách cho cả lịch ăn"
            required
          />
          {error && <Alert>{error}</Alert>}
          <fieldset>
            <legend>Quyền riêng tư</legend>
            <div className="actions">
              <Choice
                kind="radio"
                name="trip-privacy"
                label="Chỉ mình tôi"
                checked={privacy === "private"}
                onChange={() => setPrivacy("private")}
              />
              <Choice
                kind="radio"
                name="trip-privacy"
                label="Công khai"
                checked={privacy === "public"}
                onChange={() => setPrivacy("public")}
              />
            </div>
            <p className="helper">
              Lựa chọn chỉ lưu trong lịch minh họa. Chia sẻ qua cẩm nang để
              người khác xem bản chụp.
            </p>
          </fieldset>
          <Button variant="tertiary" onClick={() => setInvite(true)}>
            ＋ Mời bạn cùng xem
          </Button>
          <Button type="submit" className="full-width" loading={busy}>
            Tiếp tục
          </Button>
          <ActionLink href={`${base}/guides/new`} secondary>
            Hoặc viết cẩm nang ẩm thực
          </ActionLink>
        </form>
      </Card>
      <MapPicker
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        onSelect={(location) => setDestination(location.name)}
      />
      <Dialog
        open={invite}
        title="Mời bạn cùng xem"
        onClose={() => setInvite(false)}
      >
        <div className="stack">
          <Field label="Email người bạn" type="email" />
          <Alert tone="info">
            Mời cộng tác chưa khả dụng. Bạn có thể đính kèm lịch ăn khi viết cẩm
            nang.
          </Alert>
          <Button disabled>Gửi lời mời</Button>
        </div>
      </Dialog>
    </div>
  );
}
export function RoadmapPage({ id }: { id: string }) {
  const { data, mutate, busy, notify } = usePlatform(),
    { base } = useWorkspace(),
    params = useSearchParams(),
    [day, setDay] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [dialog, setDialog] = useState<
      "add" | "budget" | "note" | "dates" | "assistant" | null
    >(null),
    [budget, setBudget] = useState(""),
    [note, setNote] = useState(""),
    [dishId, setDishId] = useState("pho"),
    [meal, setMeal] = useState("Bữa sáng"),
    [time, setTime] = useState("08:00"),
    [tab, setTab] = useState("information"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [error, setError] = useState("");
  const trip = data.trips.find((t) => t.id === id),
    readOnly = trip?.readOnly || params.get("view") === "readonly";
  if (!trip)
    return (
      <div className="container workspace">
        <EmptyState
          title="Lịch ăn không còn khả dụng"
          action={
            <ActionLink href={`${base}/roadmaps`}>
              Về lịch ăn của tôi
            </ActionLink>
          }
        />
      </div>
    );
  const currentDay = trip.days[Math.min(day, trip.days.length - 1)],
    item = currentDay?.items.find((i) => i.id === selected),
    restaurant = data.restaurants.find((r) => r.id === item?.restaurantId);
  async function changeItem(
    itemId: string,
    update: (item: ItineraryItem) => void,
  ) {
    await mutate((d) => {
      const t = d.trips.find((t) => t.id === id)!;
      const target = t.days[day].items.find((i) => i.id === itemId)!;
      update(target);
    });
  }
  return (
    <div className="roadmap">
      <aside className="roadmap-sidebar">
        <div>
          <ActionLink href={`${base}/roadmaps`} secondary>
            ← Lịch ăn của tôi
          </ActionLink>
          <p className="eyebrow" style={{ marginBlock: 24 }}>
            Ngày đã lên lịch
          </p>
        </div>
        {trip.days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            className={day === i ? "selected" : ""}
            aria-pressed={day === i}
            onClick={() => {
              setDay(i);
              setSelected(null);
            }}
          >
            Ngày {i + 1}
            <br />
            {dateLabel(d.date)}
          </button>
        ))}
        <div>
          <Button
            variant="tertiary"
            onClick={() => {
              setBudget(String(trip.budget));
              setDialog("budget");
            }}
          >
            Xem ngân sách
          </Button>
        </div>
      </aside>
      <section className="roadmap-main stack">
        <div className="between">
          <span className="eyebrow">Sổ tay ăn ngon / {trip.destination}</span>
          <Badge>{readOnly ? "Chỉ xem" : "Đã lưu · Minh họa"}</Badge>
        </div>
        <h1>{trip.name}</h1>
        <Media
          className="trip-cover"
          src="/assets/figma/food-inspiration.png"
          alt="Hành trình ẩm thực"
        />
        <div className="between">
          <p>
            {dateLabel(trip.start)}–{dateLabel(trip.end)}
          </p>
          <div className="actions">
            {!readOnly && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStart(trip.start);
                    setEnd(trip.end);
                    setDialog("dates");
                  }}
                >
                  Lịch chuyến đi
                </Button>
                <ActionLink href={`${base}/roadmaps/share`} secondary>
                  Chia sẻ
                </ActionLink>
              </>
            )}
          </div>
        </div>
        <h2>
          Ngày {day + 1} · {dateLabel(currentDay.date)}
        </h2>
        <p className="helper">
          {currentDay.items.length} điểm ăn uống · Dữ liệu minh họa
        </p>
        {currentDay.items.map((i, index) => {
          const dish =
              data.dishes.find((d) => d.id === i.dishId) ??
              data.menuDraft.find((d) => d.id === i.dishId),
            place = data.restaurants.find((r) => r.id === i.restaurantId);
          return (
            <div key={i.id}>
              <div className="between">
                <h3>
                  {i.meal} · {i.time}
                </h3>
                {!readOnly && (
                  <Button
                    variant="tertiary"
                    onClick={() => {
                      setSelected(i.id);
                      setNote(i.note);
                      setDialog("note");
                    }}
                  >
                    Sửa ghi chú
                  </Button>
                )}
              </div>
              <div className="itinerary-row">
                <button
                  type="button"
                  className="itinerary-info stack-sm"
                  onClick={() => {
                    setSelected(i.id);
                    setTab("information");
                  }}
                  style={{
                    textAlign: "left",
                    border:
                      selected === i.id
                        ? "1.5px solid var(--ink)"
                        : "1.5px solid transparent",
                  }}
                >
                  <strong>{place?.name ?? "Quán không còn khả dụng"}</strong>
                  <p>
                    {dish?.name ?? "Món đã lưu"} · {money(dish?.price ?? 0)}
                  </p>
                  <p className="helper">{i.note}</p>
                </button>
                <div className="itinerary-photo">
                  <Media
                    src={place?.image}
                    alt={place?.name ?? "Quán đã lưu"}
                  />
                  <div className="feedback">
                    {(["like", "dislike"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        disabled={readOnly}
                        aria-label={`${f === "like" ? "Thích" : "Không thích"} ảnh ${place?.name}`}
                        aria-pressed={i.feedback === f}
                        onClick={() =>
                          void changeItem(i.id, (x) => {
                            x.feedback = x.feedback === f ? null : f;
                          })
                        }
                      >
                        <img
                          src={`/assets/figma/thumb-${f === "like" ? "up" : "down"}.svg`}
                          alt=""
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {index < currentDay.items.length - 1 && (
                <div className="travel-connection">
                  <Icon name="motorcycle" />
                  <div>
                    <p>
                      {
                        [
                          "1,2 km · Khoảng 5 phút",
                          "600 m · Khoảng 3 phút",
                          "1,8 km · Khoảng 7 phút",
                        ][index % 3]
                      }{" "}
                      đi xe máy
                    </p>
                    <p className="helper">
                      Chặng {index + 1} → {index + 2} · Định tuyến minh họa
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!currentDay.items.length && (
          <EmptyState title="Chưa có bữa ăn cho ngày này" />
        )}
        {!readOnly && (
          <Button onClick={() => setDialog("add")}>＋ Thêm món ăn</Button>
        )}
        <Card className="control">
          <span>
            Tổng dự chi hôm nay:{" "}
            {money(
              currentDay.items.reduce(
                (sum, i) =>
                  sum +
                  (data.dishes.find((d) => d.id === i.dishId)?.price ?? 0),
                0,
              ),
            )}
          </span>
          <p className="helper">
            Kiểm tra thực đơn tại quán trước khi dùng bữa.
          </p>
        </Card>
        <Card title="Ngân sách ăn uống">
          <strong className="stats-number">{money(trip.budget)}</strong>
          <Button
            variant="secondary"
            disabled={readOnly}
            onClick={() => {
              setBudget(String(trip.budget));
              setDialog("budget");
            }}
          >
            Đặt ngân sách
          </Button>
        </Card>
        <Card title="Ghi chú">
          <p>{trip.notes || "Chưa có ghi chú cho chuyến đi."}</p>
          <Button
            variant="secondary"
            disabled={readOnly}
            onClick={() => {
              setSelected(null);
              setNote(trip.notes);
              setDialog("note");
            }}
          >
            Sửa ghi chú chuyến đi
          </Button>
        </Card>
        <TripExpenses id={id} readOnly={Boolean(readOnly)} />
        {!readOnly && (
          <details className="trip-settings card">
            <summary>Cài đặt chuyến đi</summary>
            <form
              className="stack-sm"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                await mutate((d) => {
                  const target = d.trips.find((t) => t.id === id)!;
                  target.name = String(form.get("name")).trim();
                  target.privacy =
                    form.get("privacy") === "public" ? "public" : "private";
                });
              }}
            >
              <Field
                label="Tên chuyến đi"
                name="name"
                defaultValue={trip.name}
                required
              />
              <label>
                Quyền riêng tư
                <select
                  className="input"
                  name="privacy"
                  defaultValue={trip.privacy ?? "private"}
                >
                  <option value="private">Chỉ mình tôi</option>
                  <option value="public">Công khai</option>
                </select>
              </label>
              <Button type="submit">Lưu cài đặt</Button>
            </form>
          </details>
        )}
        <Button variant="secondary" onClick={() => setDialog("assistant")}>
          Hỏi trợ lý món ăn
        </Button>
      </section>
      <aside className="roadmap-map" aria-label="Bản đồ minh họa lịch ăn">
        <details className="map-layers">
          <summary className="button button-secondary">Lớp bản đồ</summary>
          <div className="card">
            <Choice
              label="Lịch ăn uống"
              checked={true}
              onChange={() =>
                notify(
                  "Bản đồ tĩnh minh họa giữ các điểm ăn uống. Dịch vụ bản đồ chưa khả dụng.",
                )
              }
            />
            <p className="helper">Bản đồ tĩnh minh họa.</p>
          </div>
        </details>
        <img
          src="/assets/figma/roadmap-map.png"
          alt="Bản đồ khu vực Hoàn Kiếm, Hà Nội"
        />
        {restaurant && (
          <div className="map-detail stack-sm">
            <div className="between">
              <h2>{restaurant.name}</h2>
              <Button
                variant="icon"
                aria-label="Đóng chi tiết quán"
                onClick={() => setSelected(null)}
              >
                ×
              </Button>
            </div>
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: "information", label: "Thông tin" },
                { value: "reviews", label: "Đánh giá" },
                { value: "photos", label: "Ảnh" },
              ]}
            />
            {tab === "information" ? (
              <>
                <p>{restaurant.address}</p>
                <p>{restaurant.description}</p>
              </>
            ) : tab === "photos" ? (
              <Media src={restaurant.image} alt={restaurant.name} />
            ) : (
              <p>{restaurant.rating} / 5 sao · Thông tin minh họa</p>
            )}
            <ActionLink href={`${base}/restaurants/${restaurant.id}`} secondary>
              Xem nhà hàng
            </ActionLink>
          </div>
        )}
      </aside>
      <Dialog
        drawer
        wide
        open={dialog === "assistant"}
        onClose={() => setDialog(null)}
        title="ANGI / Trợ lý ăn uống"
      >
        <div className="stack">
          <p>Gợi ý món ăn theo lịch trình và khẩu vị của bạn.</p>
          <Card title="Ngữ cảnh chuyến đi">
            <p>
              {trip.name} · {trip.destination}
            </p>
            <p>
              {dateLabel(trip.start)} – {dateLabel(trip.end)} · Ngân sách{" "}
              {money(trip.budget)}
            </p>
          </Card>
          <Alert tone="warning">
            Trợ lý chưa được kết nối. Bạn có thể tự chọn món và thêm vào lịch
            ăn.
          </Alert>
          <TextArea
            label="Bạn muốn ăn gì?"
            placeholder="Gợi ý một bữa tối quanh đây…"
            disabled
            helper="Chưa có dịch vụ trợ lý cho bản minh họa."
          />
          <Button disabled>Gửi yêu cầu</Button>
          <p className="helper">Thông tin do AI tạo cần được kiểm tra lại.</p>
        </div>
      </Dialog>
      <Dialog
        open={dialog === "add"}
        onClose={() => setDialog(null)}
        title="Thêm món vào lịch"
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const dish = data.dishes.find((d) => d.id === dishId)!;
            await mutate((d) =>
              d.trips
                .find((t) => t.id === id)!
                .days[day].items.push({
                  id: crypto.randomUUID(),
                  dishId,
                  restaurantId: dish.restaurantId,
                  meal,
                  time,
                  note: "",
                  feedback: null,
                }),
            );
            setDialog(null);
          }}
        >
          <SelectField
            label="Món ăn và quán phục vụ"
            value={dishId}
            onChange={setDishId}
            options={data.dishes
              .filter((d) => d.moderation === "visible" && d.serving)
              .map((d) => ({
                value: d.id,
                label: `${d.name} · ${data.restaurants.find((r) => r.id === d.restaurantId)?.name} · ${money(d.price)}`,
              }))}
          />
          <SelectField
            label="Bữa ăn"
            value={meal}
            onChange={setMeal}
            options={["Bữa sáng", "Bữa trưa", "Bữa phụ", "Bữa tối"].map(
              (v) => ({ value: v, label: v }),
            )}
          />
          <Field
            label="Thời gian"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
          <Button type="submit" loading={busy}>
            Thêm món đã chọn
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={dialog === "budget"}
        onClose={() => setDialog(null)}
        title="Ngân sách dự kiến"
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (readOnly) return;
            await mutate((d) => {
              d.trips.find((t) => t.id === id)!.budget = Number(budget);
            });
            setDialog(null);
          }}
        >
          <Field
            label="Ngân sách"
            type="number"
            min={0}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            required
            readOnly={readOnly}
            helper="VNĐ · Cả lịch ăn"
          />
          {!readOnly && (
            <Button type="submit" loading={busy}>
              Lưu ngân sách
            </Button>
          )}
        </form>
      </Dialog>
      <Dialog
        open={dialog === "note"}
        onClose={() => setDialog(null)}
        title="Ghi chú"
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (selected)
              await changeItem(selected, (i) => {
                i.note = note;
              });
            else
              await mutate((d) => {
                d.trips.find((t) => t.id === id)!.notes = note;
              });
            setDialog(null);
          }}
        >
          <TextArea
            label="Ghi chú của bạn"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
          />
          <Button type="submit" loading={busy}>
            Lưu ghi chú
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={dialog === "dates"}
        onClose={() => setDialog(null)}
        title="Lịch chuyến đi"
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const problem = validateDateRange(start, end);
            if (problem) {
              setError(problem);
              return;
            }
            const dates = tripDates(start, end);
            if (dates.length > 31) {
              setError("Bản minh họa hỗ trợ tối đa 31 ngày.");
              return;
            }
            await mutate((d) => {
              const t = d.trips.find((t) => t.id === id)!;
              t.start = start;
              t.end = end;
              t.days = dates.map(
                (date) =>
                  t.days.find((day) => day.date === date) ?? {
                    date,
                    items: [],
                  },
              );
            });
            setDay(0);
            setDialog(null);
            setError("");
          }}
        >
          <Field
            label="Ngày bắt đầu"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
          <Field
            label="Ngày kết thúc"
            type="date"
            min={start}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
          {error && <Alert>{error}</Alert>}
          <Alert tone="warning">
            Các ngày ngoài khoảng mới sẽ bị bỏ khỏi lịch minh họa.
          </Alert>
          <Button type="submit" loading={busy}>
            Lưu ngày
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
export function RollDishPage() {
  const { notify } = usePlatform(),
    { base } = useWorkspace(),
    [state, setState] = useState<"ready" | "rolling" | "revealed">("ready"),
    [selected, setSelected] = useState(2),
    [filter, setFilter] = useState("viet"),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const names = [
      "Phở bò",
      "Bánh mì trứng",
      "Bún thịt nướng",
      "Cơm tấm sườn",
      "Bánh cuốn",
    ],
    prices = [48000, 25000, 45000, 49000, 35000];
  return (
    <div className="container roll">
      <span className="eyebrow">Gợi ý bữa ăn · Roll Dish</span>
      <h1>Hôm nay ăn gì?</h1>
      <p className="muted">Để ANGI chọn giúp bạn nhé!</p>
      <Tabs
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setState("ready");
        }}
        items={[
          { value: "viet", label: "✓ Món Việt" },
          { value: "light", label: "Ăn nhẹ" },
          { value: "vegetarian", label: "Ăn chay" },
          { value: "budget", label: "✓ Dưới 50k" },
        ]}
      />
      {filter === "vegetarian" ? (
        <EmptyState title="Chưa có món chay trong bản minh họa">
          Đổi lựa chọn để xem các món hiện có.
        </EmptyState>
      ) : (
        <>
          <img
            className="roll-marker"
            src="/assets/figma/roll-marker.svg"
            alt="Mốc chọn món ở giữa"
          />
          <div className="roll-track" aria-busy={state === "rolling"}>
            {names.map((_, position) => {
              const i =
                state === "revealed"
                  ? (position + selected - 2 + names.length) % names.length
                  : position;
              const name = names[i];
              return (
                <Card
                  key={name}
                  className={
                    state === "revealed" && position === 2 ? "selected" : ""
                  }
                >
                  <Media src={`/assets/figma/roll-${i}.png`} alt={name} />
                  <h3>{name}</h3>
                  <p className="helper">{money(prices[i])} · Giá tham khảo</p>
                </Card>
              );
            })}
          </div>
          {state === "revealed" ? (
            <Card className="roll-result" title="Chốt món này nhé!">
              <h2>{names[selected]}</h2>
              <p>Khoảng {money(prices[selected])}</p>
              <p>Hương vị Việt gần gũi cho bữa ăn hôm nay.</p>
              <div className="actions" style={{ justifyContent: "center" }}>
                <ActionLink href={`${base}/restaurants`} secondary>
                  Xem quán ăn
                </ActionLink>
                <Button onClick={() => setState("ready")}>Roll lại</Button>
              </div>
            </Card>
          ) : (
            <Button
              loading={state === "rolling"}
              onClick={() => {
                setState("rolling");
                const reduce = window.matchMedia(
                  "(prefers-reduced-motion: reduce)",
                ).matches;
                timer.current = setTimeout(
                  () => {
                    setSelected((i) =>
                      filter === "light"
                        ? i === 1
                          ? 4
                          : 1
                        : (i + 1) % names.length,
                    );
                    setState("revealed");
                    notify("Đã chọn món trong bản minh họa.");
                  },
                  reduce ? 50 : 700,
                );
              }}
            >
              Roll món ngay
            </Button>
          )}
        </>
      )}
      <p className="helper" style={{ marginTop: 32 }}>
        Dữ liệu minh họa · Giá tham khảo · Món mẫu không đại diện cho quán cụ
        thể
      </p>
      <span role="status" className="sr-only">
        {state === "rolling"
          ? "Đang chọn món"
          : state === "revealed"
            ? `Món đã chọn: ${names[selected]}`
            : "Sẵn sàng chọn món"}
      </span>
    </div>
  );
}
