"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  ConfirmDialog,
  EmptyState,
  SelectField,
  Skeleton,
  Tabs,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import {
  verificationLabels,
  visibilityLabels,
} from "@/components/domain/cards";
import { usePlatform } from "@/features/platform/provider";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { ownerProfileFromDemo } from "@/mocks/restaurant-profile";
import { createMockOperatingStatusService } from "@/mocks/operating-status";
import {
  buildOperatingStatusRequest,
  isOperatingStatus,
  operatingStatusFieldErrors,
  operatingStatusLabels,
  operatingStatuses,
  validateOperatingStatus,
} from "./operating-status-rules";
import {
  operatingStatusService,
  type OperatingStatusService,
} from "./operating-status-service";
import type {
  OwnerRestaurantDto,
  UpdateOperatingStatusRequestDto,
  UpdateOperatingStatusResponseDto,
} from "./restaurant-types";

export function RestaurantOperatingStatusPage() {
  const { base } = useWorkspace();
  const { mode, data, mutate } = usePlatform();
  const demo = mode === "demo";
  const [mock] = useState(() => {
    const owner = data.restaurants.find(
      (item) => item.id === data.ownerRestaurantId,
    );
    return createMockOperatingStatusService(
      owner ? ownerProfileFromDemo(owner, data.hours) : null,
    );
  });
  const service = demo ? mock : operatingStatusService;
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
        Đăng ký nhà hàng trước khi cập nhật trạng thái hoạt động.
      </EmptyState>
    );
  if (status === "error")
    return (
      <Card title="Chưa tải được trạng thái nhà hàng">
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
    <OperatingStatusEditor
      restaurant={restaurant}
      service={service}
      demo={demo}
      onSaved={async (result) => {
        if (demo)
          await mutate((next) => {
            const owner = next.restaurants.find(
              (item) => item.id === next.ownerRestaurantId,
            );
            if (owner) owner.operating = result.operatingStatus;
          }, "");
        setRestaurant((current) =>
          current
            ? { ...current, operatingStatus: result.operatingStatus }
            : current,
        );
      }}
    />
  );
}

type DiscardConfirmation = {
  title: string;
  label: string;
  description: string;
  action: () => void;
};

function OperatingStatusEditor({
  restaurant,
  service,
  demo,
  onSaved,
}: {
  restaurant: OwnerRestaurantDto;
  service: OperatingStatusService;
  demo: boolean;
  onSaved: (result: UpdateOperatingStatusResponseDto) => Promise<void>;
}) {
  const router = useRouter();
  const { base } = useWorkspace();
  const [selected, setSelected] = useState(restaurant.operatingStatus);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [request, setRequest] =
    useState<UpdateOperatingStatusRequestDto | null>(null);
  const [discard, setDiscard] = useState<DiscardConfirmation | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ name: string } | null>(
    null,
  );
  const active = useRef(true);
  const submitting = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const changedStatus = selected !== restaurant.operatingStatus;
  const dirty = changedStatus || note.length > 0;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (busy || request || !focusRequest) return;
    const field = form.current?.elements.namedItem(focusRequest.name);
    if (field instanceof HTMLElement) field.focus();
    else feedback.current?.focus();
  }, [busy, request, focusRequest]);
  function edited() {
    setErrors({});
    setError("");
    setSuccess("");
    setFocusRequest(null);
  }
  function reset() {
    setSelected(restaurant.operatingStatus);
    setNote("");
    edited();
  }
  function changeTab(tab: string) {
    if (busy || tab === "status") return;
    const navigate = () => router.push(`${base}/profile?tab=${tab}`);
    if (dirty)
      setDiscard({
        title: "Bỏ thay đổi trạng thái chưa lưu?",
        label: "Bỏ thay đổi và chuyển thẻ",
        description:
          "Trạng thái và lý do bạn đang chỉnh sửa sẽ bị bỏ khi chuyển thẻ.",
        action: navigate,
      });
    else navigate();
  }
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting.current || request || !changedStatus) return;
    const invalid = validateOperatingStatus(selected, note);
    setErrors(invalid);
    setError("");
    setSuccess("");
    if (Object.keys(invalid).length) {
      setError("Vui lòng kiểm tra thông tin đã nhập.");
      setFocusRequest({ name: Object.keys(invalid)[0] });
      return;
    }
    setRequest(buildOperatingStatusRequest(selected, note));
  }
  async function save() {
    if (!request || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await service.updateStatus(request);
      if (!active.current) return;
      await onSaved(result);
      if (!active.current) return;
      setSelected(result.operatingStatus);
      setNote("");
      setErrors({});
      setFocusRequest(null);
      setSuccess(
        demo
          ? "Đã cập nhật trạng thái trong bản minh họa."
          : "Đã cập nhật trạng thái hoạt động.",
      );
    } catch (caught) {
      if (!active.current) return;
      const fields =
        caught instanceof ApiError
          ? operatingStatusFieldErrors(caught.errors)
          : {};
      setErrors(fields);
      setError(
        caught instanceof ApiError &&
          caught.errorCode === "RESTAURANT_SUSPENDED"
          ? "Nhà hàng đang bị đình chỉ nên chưa thể mở lại. Vui lòng liên hệ bộ phận hỗ trợ."
          : getErrorMessage(caught),
      );
      setFocusRequest({ name: Object.keys(fields)[0] ?? "" });
    } finally {
      submitting.current = false;
      if (active.current) {
        setRequest(null);
        setBusy(false);
      }
    }
  }
  return (
    <div className="stack registration-page">
      <PageHeading
        title="Nhà hàng của tôi"
        description={`${restaurant.name} · Quản lý trạng thái hoạt động.`}
      />
      <Tabs
        value="status"
        onChange={changeTab}
        items={[
          { value: "information", label: "Thông tin" },
          { value: "photos", label: "Hình ảnh" },
          { value: "hours", label: "Giờ mở cửa" },
          { value: "status", label: "Trạng thái" },
        ]}
      />
      <Card title="Trạng thái hiện tại">
        <div className="status-grid">
          <div>
            <h3>Xác minh nhà hàng</h3>
            <Badge>{verificationLabels[restaurant.verificationStatus]}</Badge>
          </div>
          <div>
            <h3>Hoạt động</h3>
            <Badge>{operatingStatusLabels[restaurant.operatingStatus]}</Badge>
          </div>
          <div>
            <h3>Kiểm duyệt</h3>
            <Badge>{visibilityLabels[restaurant.moderationStatus]}</Badge>
          </div>
        </div>
        <p className="helper">
          Trạng thái hoạt động được quản lý độc lập với giờ mở cửa, xác minh và
          kiểm duyệt.
        </p>
      </Card>
      {restaurant.moderationStatus === "suspended" && (
        <Alert tone="warning">
          Nhà hàng đang bị đình chỉ. Bạn vẫn có thể tạm đóng hoặc đóng cửa vĩnh
          viễn; chưa thể mở lại khi còn bị đình chỉ.
        </Alert>
      )}
      {success && <Alert tone="success">{success}</Alert>}
      {error && (
        <div ref={feedback} tabIndex={-1}>
          <Alert>{error}</Alert>
        </div>
      )}
      <form
        className="stack"
        ref={form}
        noValidate
        onSubmit={review}
        aria-busy={busy}
      >
        <fieldset className="registration-fields" disabled={busy}>
          <Card title="Cập nhật trạng thái hoạt động" className="stack">
            <SelectField
              label="Trạng thái mới"
              name="operatingStatus"
              value={selected}
              error={errors.operatingStatus}
              onChange={(value) => {
                if (isOperatingStatus(value)) {
                  setSelected(value);
                  edited();
                }
              }}
              options={operatingStatuses.map((status) => ({
                value: status,
                label: operatingStatusLabels[status],
              }))}
            />
            <TextArea
              label="Lý do (không bắt buộc)"
              name="note"
              maxLength={500}
              value={note}
              error={errors.note}
              onChange={(event) => {
                setNote(event.target.value);
                edited();
              }}
              helper="Lý do đi kèm lần đổi trạng thái này."
            />
            {!changedStatus && (
              <p className="helper">
                Chọn trạng thái khác để cập nhật. Lý do không được lưu riêng khi
                trạng thái giữ nguyên.
              </p>
            )}
          </Card>
        </fieldset>
        <div className="actions registration-actions">
          <Button type="submit" disabled={!changedStatus || busy}>
            Cập nhật trạng thái
          </Button>
          <Button
            variant="secondary"
            disabled={!dirty || busy}
            onClick={() =>
              setDiscard({
                title: "Bỏ thay đổi trạng thái chưa lưu?",
                label: "Bỏ thay đổi",
                description:
                  "Thông tin sẽ được khôi phục về trạng thái đã lưu gần nhất.",
                action: reset,
              })
            }
          >
            Hủy thay đổi
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={!!request}
        title={
          request?.operatingStatus === "permanently_closed"
            ? "Xác nhận đóng cửa vĩnh viễn?"
            : "Cập nhật trạng thái hoạt động?"
        }
        destructive={request?.operatingStatus !== "open"}
        loading={busy}
        label="Xác nhận cập nhật"
        cancelLabel="Tiếp tục chỉnh sửa"
        onClose={() => {
          if (!busy) setRequest(null);
        }}
        onConfirm={() => {
          void save();
        }}
      >
        <div className="stack-sm">
          <p>Hiện tại: {operatingStatusLabels[restaurant.operatingStatus]}</p>
          <p>
            Trạng thái mới:{" "}
            {request ? operatingStatusLabels[request.operatingStatus] : ""}
          </p>
          {request?.note && <p>Lý do: {request.note}</p>}
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!discard}
        title={discard?.title ?? "Xác nhận thay đổi"}
        label={discard?.label}
        destructive
        cancelLabel="Tiếp tục chỉnh sửa"
        onClose={() => setDiscard(null)}
        onConfirm={() => {
          discard?.action();
          setDiscard(null);
        }}
      >
        <p>{discard?.description}</p>
      </ConfirmDialog>
    </div>
  );
}
