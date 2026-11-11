import type { ComponentType, CSSProperties, ReactNode, SVGProps } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/20/solid";
import { Badge } from "@/shared/ui";
import "./restaurant-profile.css";
import { verificationLabels } from "./status-labels";
import {
  buildVerificationRequest,
  validateVerificationRequest,
} from "./verification-rules";
import type {
  OwnerRestaurantDto,
  VerificationDocumentSelection,
} from "./restaurant-types";
import type { VerificationFormValues } from "./verification-types";

type Tone = "neutral" | "success" | "warning" | "error";

const heroCopy: Record<
  "verified" | "pending" | "needs_more_info" | "rejected" | "unverified",
  {
    tone: Tone;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    title: string;
    text: string;
  }
> = {
  verified: {
    tone: "success",
    icon: ShieldCheckIcon,
    title: "Nhà hàng đã được xác minh",
    text: "Hồ sơ pháp lý đã được duyệt. Bạn có thể tạo và gửi duyệt thực đơn.",
  },
  pending: {
    tone: "warning",
    icon: ClockIcon,
    title: "Hồ sơ đang chờ duyệt",
    text: "Người kiểm duyệt sẽ xem hồ sơ và phản hồi tại đây. Bạn sẽ nhận thông báo khi có kết quả.",
  },
  needs_more_info: {
    tone: "warning",
    icon: ExclamationTriangleIcon,
    title: "Hồ sơ cần bổ sung",
    text: "Đọc phản hồi của người duyệt, sửa thông tin hoặc thêm tài liệu rồi gửi lại hồ sơ.",
  },
  rejected: {
    tone: "error",
    icon: XCircleIcon,
    title: "Hồ sơ bị từ chối",
    text: "Đọc phản hồi của người duyệt để biết lý do, sau đó gửi lại hồ sơ đã chỉnh sửa.",
  },
  unverified: {
    tone: "neutral",
    icon: DocumentTextIcon,
    title: "Nhà hàng chưa được xác minh",
    text: "Gửi thông tin pháp lý và tài liệu để yêu cầu xác minh. Cần xác minh trước khi tạo thực đơn.",
  },
};

const badgeTone: Record<OwnerRestaurantDto["verificationStatus"], Tone> = {
  verified: "success",
  pending: "warning",
  unverified: "neutral",
  rejected: "error",
};

/** The head of the verification page: where the restaurant stands and what to do next. */
export function VerificationHero({
  restaurant,
  reload,
}: {
  restaurant: OwnerRestaurantDto;
  reload: ReactNode;
}) {
  const status = restaurant.verificationStatus;
  const copy =
    heroCopy[
      status !== "verified" &&
      restaurant.latestVerification?.status === "needs_more_info"
        ? "needs_more_info"
        : status
    ];
  const Icon = copy.icon;
  return (
    <header className="vf-hero verification-summary" data-tone={copy.tone}>
      <span className="vf-hero-icon" aria-hidden>
        <Icon />
      </span>
      <div className="vf-hero-body">
        <p className="rp-eyebrow">Xác minh · {restaurant.name}</p>
        <h1>{copy.title}</h1>
        <p>{copy.text}</p>
      </div>
      <div className="vf-hero-side">
        <span className="vf-hero-label">
          Trạng thái nhà hàng{" "}
          <Badge tone={badgeTone[status]}>{verificationLabels[status]}</Badge>
        </span>
        {reload}
      </div>
    </header>
  );
}

/** A live checklist beside the form, built from the same rules the submit button checks. */
export function VerificationChecklist({
  values,
  documents,
  mode,
}: {
  values: VerificationFormValues;
  documents: VerificationDocumentSelection[];
  mode: "initial" | "resubmit";
}) {
  const errors = validateVerificationRequest(
    buildVerificationRequest(values, documents),
    mode,
  );
  const has = (type: string) =>
    documents.some((document) => document.docType === type);
  const items: { label: string; done: boolean; optional?: boolean }[] = [
    { label: "Tên pháp lý", done: !!values.legalName.trim() && !errors.legalName },
    {
      label: "Số giấy phép kinh doanh đúng định dạng",
      done: !!values.businessLicenseNo && !errors.businessLicenseNo,
    },
    {
      label:
        mode === "resubmit"
          ? "Ít nhất một tài liệu"
          : "Ảnh hoặc bản PDF giấy phép kinh doanh",
      done: !errors.documents && documents.length > 0,
    },
    {
      label: "Mã số thuế",
      done: !!values.taxCode && !errors.taxCode,
      optional: true,
    },
    {
      label: "Giấy chứng nhận an toàn thực phẩm",
      done: has("food_safety_cert"),
      optional: true,
    },
    {
      label: "Ảnh mặt tiền nhà hàng",
      done: has("storefront_photo"),
      optional: true,
    },
  ];
  const required = items.filter((item) => !item.optional);
  const ready = required.filter((item) => item.done).length;
  return (
    <aside className="card vf-checklist" aria-label="Kiểm tra hồ sơ">
      <h2>Kiểm tra hồ sơ</h2>
      <p className="vf-checklist-progress">
        <strong>
          {ready}/{required.length}
        </strong>{" "}
        mục bắt buộc đã xong
      </p>
      <div
        className="vf-checklist-bar"
        style={{ "--done": `${(ready / required.length) * 100}%` } as CSSProperties}
        aria-hidden
      />
      <ul>
        {items.map((item) => (
          <li key={item.label} data-done={item.done || undefined}>
            <span className="vf-check" aria-hidden>
              {item.done && <CheckIcon />}
            </span>
            <span>
              {item.label}
              {item.optional && <small> · nên có</small>}
              <span className="sr-only">
                {item.done ? " (đã xong)" : " (chưa xong)"}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="vf-checklist-note">
        <CheckCircleIcon aria-hidden />
        Ảnh JPG, PNG, WEBP tối đa 5 MB; PDF tối đa 10 MB. Chụp rõ, đủ bốn góc
        giấy tờ để duyệt nhanh hơn.
      </p>
    </aside>
  );
}
