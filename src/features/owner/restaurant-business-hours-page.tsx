"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  Tabs,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/page-heading";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { ownerProfileHref, ownerRoutes, type OwnerProfileTab } from "./routes";
import {
  businessDays,
  businessHourFieldErrors,
  sortBusinessHours,
  validateBusinessHours,
} from "./business-hours-rules";
import {
  businessHoursService,
  type BusinessHoursService,
} from "./business-hours-service";
import type {
  BusinessHourDto,
  OwnerRestaurantDto,
  UpdateBusinessHoursResponseDto,
} from "./restaurant-types";
import { BusinessHoursDayDialog } from "./business-hours-day-dialog";
import "./restaurant-business-hours.css";

export function RestaurantBusinessHoursPage() {
  const service = businessHoursService;
  const [restaurant, setRestaurant] = useState<OwnerRestaurantDto | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "missing"
  >("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    service
      .getOwnerRestaurant()
      .then((owner) => {
        if (!ignore) {
          setRestaurant(owner);
          setStatus("ready");
        }
      })
      .catch((caught) => {
        if (ignore) return;
        setError(getErrorMessage(caught));
        setStatus(
          caught instanceof ApiError &&
            caught.errorCode === "RESTAURANT_NOT_FOUND"
            ? "missing"
            : "error",
        );
      });
    return () => {
      ignore = true;
    };
  }, [service, attempt]);
  if (status === "loading") return <Skeleton />;
  if (status === "missing")
    return (
      <EmptyState
        title="Bạn chưa đăng ký nhà hàng"
        action={
          <ActionLink href={ownerRoutes.register}>Đăng ký nhà hàng</ActionLink>
        }
      >
        Đăng ký nhà hàng trước khi cập nhật giờ mở cửa.
      </EmptyState>
    );
  if (status === "error")
    return (
      <Card title="Chưa tải được giờ mở cửa">
        <Alert>{error}</Alert>
        <Button
          onClick={() => {
            setError("");
            setStatus("loading");
            setAttempt((value) => value + 1);
          }}
        >
          Thử lại
        </Button>
      </Card>
    );
  if (!restaurant) return null;
  return (
    <BusinessHoursEditor
      restaurant={restaurant}
      service={service}
      onSaved={(result) => {
        setRestaurant((current) =>
          current
            ? {
                ...current,
                businessHours: result.hours,
                isOpenNow: result.isOpenNow,
              }
            : current,
        );
      }}
    />
  );
}

type Confirmation = {
  title: string;
  label: string;
  description: string;
  action: () => void;
};

function BusinessHoursEditor({
  restaurant,
  service,
  onSaved,
}: {
  restaurant: OwnerRestaurantDto;
  service: BusinessHoursService;
  onSaved: (response: UpdateBusinessHoursResponseDto) => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<UpdateBusinessHoursResponseDto>(() => ({
    hours: sortBusinessHours(restaurant.businessHours),
    isOpenNow: restaurant.isOpenNow,
  }));
  const [draft, setDraft] = useState<BusinessHourDto[]>(() =>
    sortBusinessHours(restaurant.businessHours),
  );
  const [editingDay, setEditingDay] = useState<{
    day: (typeof businessDays)[number];
    add: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [focusRequest, setFocusRequest] = useState<{ name: string } | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const active = useRef(true);
  const submitting = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const hours = draft;
  const dirty =
    JSON.stringify(sortBusinessHours(hours)) !== JSON.stringify(saved.hours);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (busy || !focusRequest) return;
    const index = /^hours\[(\d+)\]/.exec(focusRequest.name)?.[1];
    const day =
      index === undefined ? undefined : draft[Number(index)]?.dayOfWeek;
    const button = form.current?.elements.namedItem(`edit-day-${day}`);
    if (button instanceof HTMLElement) button.focus();
    else feedback.current?.focus();
  }, [busy, focusRequest, draft]);
  function edited() {
    setFocusRequest(null);
    setErrors({});
    setError("");
    setSuccess("");
  }
  function restore(result: UpdateBusinessHoursResponseDto) {
    setDraft(sortBusinessHours(result.hours));
    edited();
  }
  function changeTab(tab: string) {
    if (busy || tab === "hours") return;
    const navigate = () =>
      router.push(ownerProfileHref(tab as OwnerProfileTab));
    if (dirty)
      setConfirmation({
        title: "Bỏ thay đổi giờ mở cửa chưa lưu?",
        label: "Bỏ thay đổi và chuyển thẻ",
        description: "Giờ mở cửa bạn đang chỉnh sửa sẽ bị bỏ khi chuyển thẻ.",
        action: navigate,
      });
    else navigate();
  }
  function focusError(fields: Record<string, string>) {
    setFocusRequest({ name: Object.keys(fields)[0] ?? "" });
  }
  async function persist() {
    if (busy || submitting.current || !dirty) return;
    const { errors: invalid, errorCode } = validateBusinessHours(hours);
    setSuccess("");
    setErrors(invalid);
    if (errorCode) {
      setError(
        errorCode === "INVALID_BUSINESS_HOURS"
          ? "Các khung giờ không được chồng lên nhau, kể cả qua nửa đêm."
          : "Vui lòng kiểm tra giờ mở cửa đã nhập.",
      );
      focusError(invalid);
      return;
    }
    setError("");
    submitting.current = true;
    setBusy(true);
    try {
      const result = await service.updateHours({ hours });
      if (!active.current) return;
      onSaved(result);
      if (!active.current) return;
      setSaved({
        hours: sortBusinessHours(result.hours),
        isOpenNow: result.isOpenNow,
      });
      restore(result);
      setSuccess("Đã lưu giờ mở cửa.");
    } catch (caught) {
      if (!active.current) return;
      const fields =
        caught instanceof ApiError
          ? businessHourFieldErrors(caught.errors)
          : {};
      setErrors(fields);
      setError(
        caught instanceof ApiError &&
          caught.errorCode === "INVALID_BUSINESS_HOURS"
          ? "Các khung giờ không được chồng lên nhau, kể cả qua nửa đêm."
          : getErrorMessage(caught),
      );
      focusError(fields);
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting.current || !dirty) return;
    if (!hours.length) {
      setConfirmation({
        title: "Lưu lịch tuần trống?",
        label: "Lưu lịch trống",
        description:
          "Cả tuần sẽ hiển thị Chưa khai báo giờ. Thao tác này không đổi trạng thái hoạt động của nhà hàng.",
        action: () => void persist(),
      });
    } else void persist();
  }
  return (
    <div className="stack form-page business-hours-page">
      <PageHeading
        eyebrow="Nhà hàng của tôi"
        title="Giờ mở cửa"
        description="Lưu toàn bộ lịch trong tuần theo giờ Việt Nam. Một ngày có thể có nhiều khoảng phục vụ."
      />
      <Tabs
        value="hours"
        onChange={changeTab}
        items={[
          { value: "information", label: "Thông tin" },
          { value: "photos", label: "Hình ảnh" },
          { value: "hours", label: "Giờ mở cửa" },
          { value: "status", label: "Trạng thái" },
        ]}
      />
      {success && <Alert tone="success">{success}</Alert>}
      {error && (
        <div ref={feedback} tabIndex={-1}>
          <Alert>{error}</Alert>
          {errors.hours && <p className="field-error">{errors.hours}</p>}
        </div>
      )}
      <form ref={form} noValidate onSubmit={save} aria-busy={busy}>
        <Card title="Lịch phục vụ trong tuần" className="business-hours-card">
          <fieldset className="registration-fields" disabled={busy}>
            <legend className="sr-only">Giờ phục vụ theo từng ngày</legend>
            <ul className="business-hours-week">
              {businessDays.map((day) => {
                const slots = draft
                  .map((hour, index) => ({ hour, index }))
                  .filter(({ hour }) => hour.dayOfWeek === day.dayOfWeek)
                  .sort((a, b) =>
                    a.hour.openTime.localeCompare(b.hour.openTime),
                  );
                const messages = slots.flatMap(({ index }) =>
                  Object.entries(errors)
                    .filter(
                      ([key]) =>
                        key === `hours[${index}]` ||
                        key.startsWith(`hours[${index}].`),
                    )
                    .map(([, message]) => message),
                );
                const errorId = `business-hours-error-${day.dayOfWeek}`;
                return (
                  <li
                    key={day.dayOfWeek}
                    className="business-hours-day"
                    aria-labelledby={`business-day-${day.dayOfWeek}`}
                  >
                    <span
                      id={`business-day-${day.dayOfWeek}`}
                      className="business-hours-day-name"
                    >
                      {day.label}
                    </span>
                    <div className="business-hours-summary">
                      {slots.length ? (
                        <>
                          <p className="business-hours-intervals">
                            {slots.map(({ hour }, index) => (
                              <span key={index}>
                                {index > 0 && <span aria-hidden> · </span>}
                                {hour.openTime}–{hour.closeTime}
                                {hour.closeTime < hour.openTime
                                  ? " hôm sau"
                                  : ""}
                              </span>
                            ))}
                          </p>
                          {slots
                            .filter(
                              ({ hour }) => hour.closeTime < hour.openTime,
                            )
                            .map(({ hour }, index) => (
                              <p className="helper" key={index}>
                                Đóng lúc {hour.closeTime} ngày hôm sau.
                              </p>
                            ))}
                        </>
                      ) : (
                        <p>Chưa khai báo giờ</p>
                      )}
                      {!!messages.length && (
                        <p className="field-error" id={errorId}>
                          {[...new Set(messages)].join(" ")}
                        </p>
                      )}
                    </div>
                    <div className="business-hours-day-actions">
                      <Button
                        variant="secondary"
                        name={`edit-day-${day.dayOfWeek}`}
                        aria-label={`Chỉnh giờ · ${day.label}`}
                        aria-describedby={messages.length ? errorId : undefined}
                        onClick={() => setEditingDay({ day, add: false })}
                      >
                        Chỉnh giờ
                      </Button>
                      <Button
                        variant="secondary"
                        aria-label={`Thêm khoảng · ${day.label}`}
                        onClick={() => setEditingDay({ day, add: true })}
                      >
                        Thêm khoảng
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <aside className="business-hours-notice">
            <p>
              <span aria-hidden>ⓘ </span>
              <strong>Chưa khai báo không có nghĩa là đóng cửa</strong>
            </p>
            <p>
              Ngày không có khoảng giờ sẽ hiển thị “Chưa khai báo giờ”. Xóa hết
              lịch không đồng nghĩa với đóng cửa cả tuần.
            </p>
          </aside>
          <div className="business-hours-week-actions">
            <Button type="submit" loading={busy} disabled={!dirty}>
              Lưu cả tuần
            </Button>
            <Button
              variant="secondary"
              disabled={!dirty || busy}
              onClick={() =>
                setConfirmation({
                  title: "Bỏ thay đổi giờ mở cửa chưa lưu?",
                  label: "Bỏ thay đổi",
                  description:
                    "Lịch tuần sẽ được khôi phục về lần lưu gần nhất.",
                  action: () => restore(saved),
                })
              }
            >
              Hủy
            </Button>
          </div>
        </Card>
      </form>
      {editingDay && (
        <BusinessHoursDayDialog
          day={editingDay.day}
          add={editingDay.add}
          week={draft}
          initialErrors={errors}
          onClose={() => setEditingDay(null)}
          onApply={(dayHours) => {
            setDraft([
              ...draft.filter(
                (hour) => hour.dayOfWeek !== editingDay.day.dayOfWeek,
              ),
              ...dayHours,
            ]);
            edited();
            setEditingDay(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirmation}
        title={confirmation?.title ?? "Xác nhận thay đổi"}
        label={confirmation?.label}
        destructive
        cancelLabel="Tiếp tục chỉnh sửa"
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          confirmation?.action();
          setConfirmation(null);
        }}
      >
        <p>{confirmation?.description}</p>
      </ConfirmDialog>
    </div>
  );
}
