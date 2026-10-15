"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  ConfirmDialog,
  EmptyState,
  Field,
  Skeleton,
  Tabs,
} from "@/components/ui/primitives";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { ownerProfileFromDemo } from "@/mocks/restaurant-profile";
import { createMockBusinessHoursService } from "@/mocks/business-hours";
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

export function RestaurantBusinessHoursPage() {
  const { base } = useWorkspace();
  const { mode, data, mutate } = usePlatform();
  const demo = mode === "demo";
  const [mock] = useState(() => {
    const owner = data.restaurants.find(
      (restaurant) => restaurant.id === data.ownerRestaurantId,
    );
    return createMockBusinessHoursService(
      owner ? ownerProfileFromDemo(owner, data.hours) : null,
    );
  });
  const service = demo ? mock : businessHoursService;
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
          <ActionLink href={`${base}/register`}>Đăng ký nhà hàng</ActionLink>
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
      demo={demo}
      onSaved={async (result) => {
        if (demo)
          await mutate((next) => {
            const owner = next.restaurants.find(
              (item) => item.id === next.ownerRestaurantId,
            );
            if (owner)
              owner.businessHours = result.hours.map((hour) => ({ ...hour }));
          }, "");
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

type DraftHour = BusinessHourDto & { id: string };
type Confirmation = {
  title: string;
  label: string;
  description: string;
  action: () => void;
};

function BusinessHoursEditor({
  restaurant,
  service,
  demo,
  onSaved,
}: {
  restaurant: OwnerRestaurantDto;
  service: BusinessHoursService;
  demo: boolean;
  onSaved: (response: UpdateBusinessHoursResponseDto) => Promise<void>;
}) {
  const { base } = useWorkspace();
  const router = useRouter();
  const [saved, setSaved] = useState<UpdateBusinessHoursResponseDto>(() => ({
    hours: sortBusinessHours(restaurant.businessHours),
    isOpenNow: restaurant.isOpenNow,
  }));
  const sequence = useRef(restaurant.businessHours.length);
  const [draft, setDraft] = useState<DraftHour[]>(() =>
    sortBusinessHours(restaurant.businessHours).map((hour, index) => ({
      ...hour,
      id: `hour-${index}`,
    })),
  );
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
  const hours: BusinessHourDto[] = draft.map(
    ({ dayOfWeek, openTime, closeTime }) => ({
      dayOfWeek,
      openTime,
      closeTime,
    }),
  );
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
    const control = form.current?.elements.namedItem(focusRequest.name);
    if (control instanceof HTMLElement) control.focus();
    else feedback.current?.focus();
  }, [busy, focusRequest]);
  function edited() {
    setFocusRequest(null);
    setErrors({});
    setError("");
    setSuccess("");
  }
  function restore(result: UpdateBusinessHoursResponseDto) {
    setDraft(
      sortBusinessHours(result.hours).map((hour) => ({
        ...hour,
        id: `hour-${sequence.current++}`,
      })),
    );
    edited();
  }
  function changeTab(tab: string) {
    if (busy || tab === "hours") return;
    const navigate = () => router.push(`${base}/profile?tab=${tab}`);
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
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      await onSaved(result);
      if (!active.current) return;
      setSaved({
        hours: sortBusinessHours(result.hours),
        isOpenNow: result.isOpenNow,
      });
      restore(result);
      setSuccess(
        demo ? "Đã lưu giờ mở cửa trong bản minh họa." : "Đã lưu giờ mở cửa.",
      );
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
  return (
    <div className="stack registration-page">
      <PageHeading
        title="Nhà hàng của tôi"
        description={`${restaurant.name} · Cập nhật lịch mở cửa trong tuần.`}
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
      <p className="helper">
        Giờ Việt Nam (UTC+7). Một ngày có thể có nhiều khung. Giờ đóng sớm hơn
        giờ mở nghĩa là đóng vào ngày hôm sau; khung đó thuộc ngày bắt đầu.
      </p>
      <Alert tone="info">
        {saved.hours.length
          ? `Theo lịch đã lưu: ${saved.isOpenNow ? "đang trong giờ mở cửa" : "ngoài giờ mở cửa"}.`
          : "Bạn chưa khai báo giờ mở cửa."}
      </Alert>
      {success && <Alert tone="success">{success}</Alert>}
      {error && (
        <div ref={feedback} tabIndex={-1}>
          <Alert>{error}</Alert>
          {errors.hours && <p className="field-error">{errors.hours}</p>}
        </div>
      )}
      <form
        className="stack"
        noValidate
        ref={form}
        onSubmit={save}
        aria-busy={busy}
      >
        <fieldset className="registration-fields stack" disabled={busy}>
          {businessDays.map((day) => {
            const slots = draft
              .map((hour, index) => ({ hour, index }))
              .filter(({ hour }) => hour.dayOfWeek === day.dayOfWeek);
            return (
              <Card key={day.dayOfWeek} title={day.label} className="stack-sm">
                {!slots.length && (
                  <p className="helper">
                    Không có khung giờ bắt đầu trong ngày này.
                  </p>
                )}
                {slots.map(({ hour, index }, position) => (
                  <div className="stack-sm" key={hour.id}>
                    <div className="grid-3">
                      <Field
                        label={`Giờ mở · ${day.label} · khung ${position + 1}`}
                        name={`hours[${index}].openTime`}
                        type="time"
                        step={60}
                        required
                        value={hour.openTime}
                        error={
                          errors[`hours[${index}].openTime`] ??
                          errors[`hours[${index}]`] ??
                          errors[`hours[${index}].dayOfWeek`]
                        }
                        onChange={(event) => {
                          setDraft((current) =>
                            current.map((row) =>
                              row.id === hour.id
                                ? { ...row, openTime: event.target.value }
                                : row,
                            ),
                          );
                          edited();
                        }}
                      />
                      <Field
                        label={`Giờ đóng · ${day.label} · khung ${position + 1}`}
                        name={`hours[${index}].closeTime`}
                        type="time"
                        step={60}
                        required
                        value={hour.closeTime}
                        error={errors[`hours[${index}].closeTime`]}
                        onChange={(event) => {
                          setDraft((current) =>
                            current.map((row) =>
                              row.id === hour.id
                                ? { ...row, closeTime: event.target.value }
                                : row,
                            ),
                          );
                          edited();
                        }}
                      />
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setConfirmation({
                            title: "Bỏ khung giờ này?",
                            label: "Bỏ khung giờ",
                            description: `${day.label}: khung ${position + 1} sẽ được bỏ khi lưu lịch tuần.`,
                            action: () => {
                              setDraft((current) =>
                                current.filter((row) => row.id !== hour.id),
                              );
                              edited();
                            },
                          })
                        }
                      >
                        Bỏ khung giờ · {day.label} · {position + 1}
                      </Button>
                    </div>
                    {hour.openTime &&
                      hour.closeTime &&
                      hour.closeTime < hour.openTime && (
                        <p className="helper">Đóng vào ngày hôm sau.</p>
                      )}
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() => {
                    const added: DraftHour = {
                      id: `hour-${sequence.current++}`,
                      dayOfWeek: day.dayOfWeek,
                      openTime: "",
                      closeTime: "",
                    };
                    setDraft((current) => [...current, added]);
                    edited();
                  }}
                >
                  Thêm khung giờ · {day.label}
                </Button>
              </Card>
            );
          })}
          <Button
            variant="destructive"
            disabled={!draft.length}
            onClick={() =>
              setConfirmation({
                title: "Xóa toàn bộ lịch tuần?",
                label: "Xóa lịch tuần",
                description:
                  "Sau khi lưu, nhà hàng sẽ không có giờ mở cửa được khai báo.",
                action: () => {
                  setDraft([]);
                  edited();
                },
              })
            }
          >
            Xóa lịch tuần
          </Button>
        </fieldset>
        <div className="actions registration-actions">
          <Button type="submit" loading={busy} disabled={!dirty}>
            Lưu giờ mở cửa
          </Button>
          <Button
            variant="secondary"
            disabled={!dirty || busy}
            onClick={() =>
              setConfirmation({
                title: "Bỏ thay đổi giờ mở cửa chưa lưu?",
                label: "Bỏ thay đổi",
                description: "Lịch tuần sẽ được khôi phục về lần lưu gần nhất.",
                action: () => restore(saved),
              })
            }
          >
            Hủy thay đổi
          </Button>
        </div>
      </form>
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
