"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Button } from "@/shared/ui";
import { Field } from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import type { RoleCode } from "@/features/auth/types";
import { roadmapService } from "@/features/roadmaps/roadmap-service";
import { rememberDestination } from "@/features/roadmaps/roadmap-destination";
import { roadmapDetailHref } from "@/features/roadmaps/routes";
import {
  clearHomeRoadmapDraft,
  emptyHomeRoadmap,
  homeRoadmapDayLimit,
  homeRoadmapRequest,
  parseHomeRoadmapDraft,
  readHomeRoadmapDraft,
  saveHomeRoadmapDraft,
  validateHomeRoadmap,
  type HomeRoadmapValues,
} from "./home-roadmap-rules";

function subscribeDraft(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("pageshow", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("pageshow", listener);
  };
}
const serverDraft = () => "";

export function HomeRoadmapForm({ role }: { role: RoleCode | null }) {
  const raw = useSyncExternalStore(
    subscribeDraft,
    readHomeRoadmapDraft,
    serverDraft,
  );
  return (
    <RoadmapFields
      key={raw}
      initialValues={parseHomeRoadmapDraft(raw) ?? emptyHomeRoadmap}
      role={role}
    />
  );
}

function RoadmapFields({
  initialValues,
  role,
}: {
  initialValues: HomeRoadmapValues;
  role: RoleCode | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdHref, setCreatedHref] = useState<string | null>(null);
  const submitting = useRef(false);
  const active = useRef(true);
  const form = useRef<HTMLFormElement>(null);
  const allowed = role === null || role === "TRAVELER";
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  function update(field: keyof HomeRoadmapValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "" }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !allowed) return;
    const invalid = validateHomeRoadmap(values);
    setErrors(invalid);
    setError(null);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    if (!role) {
      if (!saveHomeRoadmapDraft(values)) {
        setError(
          "Chưa giữ được thông tin chuyến đi. Hãy đăng nhập bằng nút phía trên rồi thử lại.",
        );
        return;
      }
      // Login returns Travelers to this homepage; the draft is restored, never submitted automatically.
      router.push("/login");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const created = await roadmapService.create(homeRoadmapRequest(values));
      rememberDestination(created.overview.id, values.province);
      clearHomeRoadmapDraft();
      if (!active.current) return;
      const href = roadmapDetailHref(created.overview.id);
      setCreatedHref(href);
      router.push(href);
      // Keep the submit lock until navigation, so a slow transition cannot create another record.
    } catch (caught) {
      if (!active.current) return;
      setError(getErrorMessage(caught));
      if (caught instanceof ApiError) {
        const names: Record<string, string> = {
          province: "province",
          startdate: "startDate",
          numdays: "numDays",
        };
        const fields: Record<string, string> = {};
        const other: string[] = [];
        for (const [key, messages] of Object.entries(caught.errors ?? {})) {
          const name = names[key.toLowerCase()];
          if (name) fields[name] = messages.join(" ");
          else other.push(...messages);
        }
        setErrors(fields);
        if (other.length)
          setError([getErrorMessage(caught), ...other].join(" "));
      }
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      ref={form}
      className="home-quick-form"
      onSubmit={submit}
      noValidate
      aria-label="Tạo lộ trình nhanh"
      aria-busy={busy}
    >
      <p className="home-quick-form-badge">
        <span aria-hidden>✦</span> Lên lịch ăn ngon
      </p>
      <div className="home-quick-fields">
        <div className="home-quick-province">
          <ProvinceField
            label="Tỉnh / thành phố"
            value={values.province}
            onChange={(value) => update("province", value)}
            required
            maxLength={100}
            disabled={busy || !allowed}
            error={errors.province}
            helper="Bạn muốn khám phá hương vị ở đâu?"
          />
        </div>
        <Field
          label="Ngày bắt đầu"
          type="date"
          value={values.startDate}
          onChange={(event) => update("startDate", event.target.value)}
          required
          disabled={busy || !allowed}
          error={errors.startDate}
          helper="Ngày đầu tiên của chuyến đi."
        />
        <Field
          label="Số ngày"
          type="number"
          inputMode="numeric"
          min={1}
          max={homeRoadmapDayLimit}
          step={1}
          value={values.numDays}
          onChange={(event) => update("numDays", event.target.value)}
          required
          disabled={busy || !allowed}
          error={errors.numDays}
          helper={`Từ 1 đến ${homeRoadmapDayLimit} ngày khám phá.`}
        />
      </div>
      {error && <Alert>{error}</Alert>}
      {createdHref && (
        <Alert tone="success">
          Đã tạo lộ trình của bạn. <Link href={createdHref}>Mở lộ trình →</Link>
        </Alert>
      )}
      <p className="home-quick-note">
        {!allowed
          ? "Tạo lộ trình dành cho tài khoản Người khám phá."
          : role
            ? "Tạo lịch trình của bạn, rồi chọn những món hợp gu cho từng bữa."
            : "Đăng nhập để lưu lộ trình. Thông tin bạn nhập sẽ được giữ lại."}
      </p>
      <Button
        type="submit"
        className="home-quick-submit"
        loading={busy}
        disabled={!allowed}
      >
        Tạo lộ trình ngay <span aria-hidden>↗</span>
      </Button>
    </form>
  );
}
