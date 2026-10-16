"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  ConfirmDialog,
  EmptyState,
  Field,
  Skeleton,
  Tabs,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { verificationLabels } from "@/components/domain/cards";
import { usePlatform } from "@/features/platform/provider";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { ownerProfileFromDemo } from "@/mocks/restaurant-profile";
import {
  createMockVerificationService,
  verificationFromDemo,
} from "@/mocks/restaurant-verification";
import { VerificationDocumentUpload } from "./verification-document-upload";
import { VerificationHistory } from "./verification-history";
import {
  buildVerificationRequest,
  emptyVerificationForm,
  validateVerificationRequest,
  verificationErrorMessage,
  verificationFieldErrors,
  verificationSubmissionBlock,
} from "./verification-rules";
import {
  verificationService,
  type VerificationService,
} from "./verification-service";
import type {
  OwnerRestaurantDto,
  VerificationUpload,
} from "./restaurant-types";
import type {
  GetVerificationStatusResponseDto,
  SubmitVerificationRequestDto,
  VerificationDto,
  VerificationFormValues,
} from "./verification-types";
import "./restaurant-verification.css";

export function RestaurantVerificationPage({
  initialTab,
}: {
  initialTab?: string;
}) {
  const { base } = useWorkspace();
  const { mode, data, mutate } = usePlatform();
  const demo = mode === "demo";
  const [mock] = useState(() => {
    const owner = data.restaurants.find(
      (item) => item.id === data.ownerRestaurantId,
    );
    const seed = owner ? ownerProfileFromDemo(owner, data.hours) : null;
    const records = data.submissions.filter(
      (item) =>
        item.kind === "verification" &&
        item.restaurantId === data.ownerRestaurantId,
    );
    const history = seed
      ? records.map((record, index) =>
          verificationFromDemo(record, seed.id, 21 + index),
        )
      : [];
    if (seed && history.length) seed.latestVerification = history[0];
    return createMockVerificationService(seed, history);
  });
  const service = demo ? mock : verificationService;
  const [restaurant, setRestaurant] = useState<OwnerRestaurantDto | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const onHistoryLoaded = useCallback(
    (result: GetVerificationStatusResponseDto) => {
      setRestaurant((current) =>
        current
          ? {
              ...current,
              verificationStatus: result.verificationStatus,
              latestVerification: result.items[0] ?? null,
            }
          : current,
      );
    },
    [],
  );
  useEffect(() => {
    let ignore = false;
    service
      .getOwnerRestaurant()
      .then((result) => {
        if (!ignore) {
          setRestaurant(result);
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
  function reload() {
    setStatus("loading");
    setError("");
    setAttempt((value) => value + 1);
  }
  if (status === "loading") return <Skeleton />;
  if (status === "missing")
    return (
      <EmptyState
        title="Bạn chưa đăng ký nhà hàng"
        action={
          <ActionLink href={`${base}/register`}>Đăng ký nhà hàng</ActionLink>
        }
      >
        Đăng ký nhà hàng trước khi nộp hồ sơ xác minh.
      </EmptyState>
    );
  if (status === "error")
    return (
      <Card title="Chưa tải được hồ sơ nhà hàng">
        <Alert>{error}</Alert>
        <Button onClick={reload}>Thử lại</Button>
      </Card>
    );
  if (!restaurant) return null;
  return (
    <VerificationEditor
      restaurant={restaurant}
      initialTab={initialTab}
      onHistoryLoaded={onHistoryLoaded}
      service={service}
      demo={demo}
      onReload={reload}
      onSaved={async (result, documents) => {
        setRestaurant((current) =>
          current
            ? {
                ...current,
                verificationStatus: "pending",
                latestVerification: result,
              }
            : current,
        );
        if (demo)
          await mutate((next) => {
            const owner = next.restaurants.find(
              (item) => item.id === next.ownerRestaurantId,
            );
            if (!owner) return;
            owner.verification = "pending";
            next.submissions.unshift({
              id: `verification-${result.id}`,
              kind: "verification",
              restaurantId: owner.id,
              status: "pending",
              date: result.submittedAt,
              note: result.ownerNote ?? "",
              legalName: result.legalName,
              license: result.businessLicenseNo,
              taxCode: result.taxCode ?? "",
              documents: result.documents.map((document) => ({
                type: document.docType,
                name:
                  documents.find((item) => item.media.id === document.mediaId)
                    ?.fileName ?? "Tài liệu xác minh",
                mediaId: document.mediaId,
                url: document.url,
              })),
            });
          }, "");
      }}
    />
  );
}

type Confirmation =
  | { kind: "submit"; request: SubmitVerificationRequestDto }
  | { kind: "remove"; document: VerificationUpload }
  | { kind: "discard" }
  | { kind: "reload" };

function VerificationEditor({
  restaurant,
  initialTab,
  onHistoryLoaded,
  service,
  demo,
  onReload,
  onSaved,
}: {
  restaurant: OwnerRestaurantDto;
  initialTab?: string;
  onHistoryLoaded: (result: GetVerificationStatusResponseDto) => void;
  service: VerificationService;
  demo: boolean;
  onReload: () => void;
  onSaved: (
    result: VerificationDto,
    documents: VerificationUpload[],
  ) => Promise<void>;
}) {
  const [tab, setTab] = useState(
    initialTab === "status" || verificationSubmissionBlock(restaurant)
      ? "status"
      : "new",
  );
  const [values, setValues] = useState<VerificationFormValues>({
    ...emptyVerificationForm,
  });
  const [documents, setDocuments] = useState<VerificationUpload[]>([]);
  const [uploadRevision, setUploadRevision] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ name: string } | null>(
    null,
  );
  const form = useRef<HTMLFormElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const submitting = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    // Wait for the dialog to close and disabled fields to be enabled by the commit.
    if (busy || confirmation || !focusRequest) return;
    const target = form.current?.elements.namedItem(focusRequest.name);
    if (target instanceof HTMLElement) target.focus();
    else feedback.current?.focus();
  }, [busy, confirmation, focusRequest]);
  const blocked = busy || uploading;
  const stateBlock = conflict || verificationSubmissionBlock(restaurant);
  const publishHistory = useCallback(
    (result: GetVerificationStatusResponseDto) => {
      setConflict("");
      onHistoryLoaded(result);
    },
    [onHistoryLoaded],
  );
  const dirty = Object.values(values).some(Boolean) || documents.length > 0;
  function change(field: keyof VerificationFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setError("");
    setFocusRequest(null);
  }
  function focusInvalid(fields: Record<string, string>) {
    setFocusRequest({
      name: Object.keys(fields).find((key) => fields[key]) ?? "",
    });
  }
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || stateBlock || submitting.current) return;
    const request = buildVerificationRequest(values, documents);
    const invalid = validateVerificationRequest(request);
    setErrors(invalid);
    setError("");
    setSuccess("");
    if (Object.keys(invalid).length) {
      focusInvalid(invalid);
      return;
    }
    setFocusRequest(null);
    setConfirmation({ kind: "submit", request });
  }
  async function send(request: SubmitVerificationRequestDto) {
    if (submitting.current || stateBlock || uploading) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await service.submit(request);
      if (!alive.current) return;
      setFocusRequest(null);
      setValues({ ...emptyVerificationForm });
      setDocuments([]);
      setConfirmation(null);
      setTab("status");
      setSuccess(
        demo
          ? "Đã gửi hồ sơ minh họa. Trạng thái: Chờ duyệt."
          : "Đã gửi hồ sơ xác minh. Trạng thái: Chờ duyệt.",
      );
      await onSaved(result, documents);
    } catch (caught) {
      if (!alive.current) return;
      setConfirmation(null);
      setError(verificationErrorMessage(caught));
      let fields: Record<string, string> = {};
      if (caught instanceof ApiError) {
        if (caught.errorCode === "VALIDATION_FAILED") {
          fields = verificationFieldErrors(caught.errors);
          setErrors(fields);
        }
        if (
          [
            "VERIFICATION_ALREADY_PENDING",
            "RESTAURANT_ALREADY_VERIFIED",
            "VERIFICATION_RESUBMIT_REQUIRED",
            "RESTAURANT_NOT_FOUND",
          ].includes(caught.errorCode)
        ) {
          setConflict(verificationErrorMessage(caught));
          setTab("status");
        }
      }
      focusInvalid(fields);
    } finally {
      submitting.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function confirm() {
    if (!confirmation || blocked) return;
    if (confirmation.kind === "submit") {
      void send(confirmation.request);
      return;
    }
    if (confirmation.kind === "remove") {
      const key = confirmation.document.key;
      setDocuments((current) =>
        current.filter((document) => document.key !== key),
      );
      setErrors({});
    } else if (confirmation.kind === "reload") {
      setConfirmation(null);
      onReload();
      return;
    } else {
      setValues({ ...emptyVerificationForm });
      setDocuments([]);
      setErrors({});
      setError("");
    }
    setUploadRevision((value) => value + 1);
    setConfirmation(null);
  }
  return (
    <div className="stack restaurant-verification-page">
      <PageHeading
        title="Xác minh nhà hàng"
        description="Gửi thông tin pháp lý và tài liệu để yêu cầu xác minh nhà hàng."
      />
      <div className="between verification-summary">
        <div>
          <strong>{restaurant.name}</strong>
          <p>
            Trạng thái nhà hàng:{" "}
            <Badge>{verificationLabels[restaurant.verificationStatus]}</Badge>
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={blocked}
          onClick={() =>
            dirty ? setConfirmation({ kind: "reload" }) : onReload()
          }
        >
          Tải lại trạng thái
        </Button>
      </div>
      <div ref={feedback} tabIndex={-1} className="stack-sm">
        {success && <Alert tone="success">{success}</Alert>}
        {error && <Alert>{error}</Alert>}
      </div>
      <Tabs
        value={tab}
        onChange={(value) => {
          if (!blocked) setTab(value);
        }}
        items={[
          { value: "status", label: "Trạng thái xác minh" },
          { value: "new", label: "Hồ sơ xác minh" },
        ]}
      />
      {tab === "status" ? (
        <VerificationHistory
          service={service}
          onLoaded={publishHistory}
          onPrepare={() => setTab("new")}
        />
      ) : stateBlock ? (
        <Alert tone="info">{stateBlock}</Alert>
      ) : (
        <Card title="Hồ sơ xác minh">
          <form ref={form} className="stack" onSubmit={prepare} noValidate>
            <div className="grid-2">
              <Field
                label="Tên pháp lý"
                name="legalName"
                required
                maxLength={255}
                value={values.legalName}
                disabled={blocked}
                error={errors.legalName}
                onChange={(event) => change("legalName", event.target.value)}
              />
              <Field
                label="Số giấy phép kinh doanh"
                name="businessLicenseNo"
                required
                maxLength={50}
                value={values.businessLicenseNo}
                disabled={blocked}
                error={errors.businessLicenseNo}
                onChange={(event) =>
                  change("businessLicenseNo", event.target.value)
                }
              />
            </div>
            <Field
              label="Mã số thuế (không bắt buộc)"
              name="taxCode"
              maxLength={20}
              value={values.taxCode}
              disabled={blocked}
              error={errors.taxCode}
              onChange={(event) => change("taxCode", event.target.value)}
            />
            <div>
              <h3>Tài liệu xác minh</h3>
              <VerificationDocumentUpload
                key={uploadRevision}
                documents={documents}
                disabled={busy}
                errors={errors}
                service={service}
                onPending={setUploading}
                onRemove={(document) =>
                  setConfirmation({ kind: "remove", document })
                }
                onChange={(next) => {
                  setDocuments(next);
                  setErrors({});
                  setError("");
                }}
              />
            </div>
            <TextArea
              label="Ghi chú gửi người duyệt (không bắt buộc)"
              name="ownerNote"
              maxLength={1000}
              value={values.ownerNote}
              disabled={blocked}
              error={errors.ownerNote}
              onChange={(event) => change("ownerNote", event.target.value)}
            />
            <Alert tone="info">
              {demo
                ? "Tài liệu và hồ sơ trong bản minh họa không được gửi ra ngoài."
                : "Tài liệu được tải lên để phục vụ xác minh. Kiểm tra đúng loại tài liệu trước khi gửi hồ sơ."}
            </Alert>
            <div className="actions">
              <Button type="submit" disabled={blocked}>
                Gửi hồ sơ xác minh
              </Button>
              <Button
                variant="secondary"
                disabled={blocked || !dirty}
                onClick={() => setConfirmation({ kind: "discard" })}
              >
                Hủy thay đổi
              </Button>
            </div>
          </form>
        </Card>
      )}
      <ConfirmDialog
        open={!!confirmation}
        title={
          confirmation?.kind === "submit"
            ? "Gửi hồ sơ xác minh?"
            : confirmation?.kind === "remove"
              ? "Bỏ tài liệu khỏi hồ sơ?"
              : confirmation?.kind === "reload"
                ? "Tải lại và bỏ thay đổi?"
                : "Bỏ thay đổi hồ sơ?"
        }
        label={
          confirmation?.kind === "submit"
            ? "Xác nhận gửi hồ sơ"
            : confirmation?.kind === "remove"
              ? "Bỏ tài liệu"
              : "Bỏ thay đổi"
        }
        cancelLabel="Tiếp tục chỉnh sửa"
        destructive={confirmation?.kind !== "submit"}
        loading={busy}
        onClose={() => {
          if (!busy) setConfirmation(null);
        }}
        onConfirm={confirm}
      >
        {confirmation?.kind === "submit" ? (
          <>
            <p>
              Hồ sơ của {restaurant.name} sẽ chuyển sang chờ duyệt. Kiểm tra
              thông tin trước khi xác nhận.
            </p>
            <p>
              {confirmation.request.legalName} ·{" "}
              {confirmation.request.businessLicenseNo} ·{" "}
              {confirmation.request.documents.length} tài liệu
            </p>
          </>
        ) : (
          <p>
            {confirmation?.kind === "remove"
              ? `Bỏ ${confirmation.document.fileName} khỏi hồ sơ đang soạn?`
              : "Thông tin và tài liệu đã chọn trong bản nháp sẽ bị bỏ."}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
