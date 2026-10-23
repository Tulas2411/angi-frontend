"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  ConfirmDialog,
  Field,
  SelectField,
  Skeleton,
  TextArea,
} from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { WardField } from "@/components/domain/ward-field";
import { provinceNameKey } from "@/shared/locations/provinces";
import { PageHeading } from "@/components/layout/page-heading";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { ownerProfileHref, ownerRoutes, ownerVerificationHref } from "./routes";
import {
  buildRestaurantRequest,
  emptyRestaurantForm,
  hiddenFieldMessages,
  restaurantFieldErrors,
  validateRestaurantForm,
} from "./registration-rules";
import { restaurantService } from "./restaurant-service";
import { RestaurantImageUpload } from "./restaurant-image-upload";
import { RestaurantLocationPicker } from "./restaurant-location-picker";
import { fillRestaurantFromPlace } from "./restaurant-location-rules";
import type {
  MediaFileDto,
  OwnerRestaurantDto,
  RestaurantFormValues,
  RestaurantLocation,
} from "./restaurant-types";

export function RestaurantRegistrationPage() {
  const router = useRouter();
  const service = restaurantService;
  const [values, setValues] = useState<RestaurantFormValues>({
    ...emptyRestaurantForm,
  });
  const [location, setLocation] = useState<RestaurantLocation | null>(null);
  const [cover, setCover] = useState<MediaFileDto[]>([]);
  const [gallery, setGallery] = useState<MediaFileDto[]>([]);
  const [coverPending, setCoverPending] = useState(false);
  const [galleryPending, setGalleryPending] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<OwnerRestaurantDto | null>(null);
  const [created, setCreated] = useState<OwnerRestaurantDto | null>(null);
  const [conflict, setConflict] = useState(false);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let ignore = false;
    restaurantService
      .getOwnerRestaurant()
      .then((restaurant) => {
        if (!ignore) {
          setExisting(restaurant);
          setLoadStatus("ready");
        }
      })
      .catch((caught) => {
        if (ignore) return;
        if (
          caught instanceof ApiError &&
          caught.errorCode === "RESTAURANT_NOT_FOUND"
        )
          setLoadStatus("ready");
        else {
          setError(getErrorMessage(caught));
          setLoadStatus("error");
        }
      });
    return () => {
      ignore = true;
    };
  }, [attempt]);
  const blocked = busy || coverPending || galleryPending;
  function update(field: keyof RestaurantFormValues, value: string) {
    setValues((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "provinceName" &&
      provinceNameKey(value) !== provinceNameKey(previous.provinceName)
        ? { ward: "" }
        : {}),
    }));
    setErrors((previous) => ({ ...previous, [field]: "" }));
  }
  function closeMap() {
    setMapOpen(false);
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[name="location"]')?.focus();
    });
  }
  function discardRegistration() {
    setCancelOpen(false);
    setValues({ ...emptyRestaurantForm });
    setLocation(null);
    setCover([]);
    setGallery([]);
    setErrors({});
    setError("");
    router.push(ownerRoutes.overview);
  }
  function requestCancel() {
    if (blocked) return;
    if (
      Object.values(values).some(Boolean) ||
      location ||
      cover.length ||
      gallery.length
    )
      setCancelOpen(true);
    else discardRegistration();
  }
  function focusError(invalid: Record<string, string>) {
    requestAnimationFrame(() => {
      const field = Object.keys(invalid)[0];
      const control = formRef.current?.elements.namedItem(field);
      if (control instanceof HTMLElement) control.focus();
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || submitting.current) return;
    const invalid = validateRestaurantForm(values, location);
    setErrors(invalid);
    setError("");
    if (Object.keys(invalid).length || !location) {
      focusError(invalid);
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const restaurant = await service.register(
        buildRestaurantRequest(
          values,
          location,
          cover[0]?.id,
          gallery.map((item) => item.id),
        ),
      );
      if (!active.current) return;
      setCreated(restaurant);
    } catch (caught) {
      if (!active.current) return;
      if (
        caught instanceof ApiError &&
        caught.errorCode === "OWNER_ALREADY_HAS_RESTAURANT"
      ) {
        setConflict(true);
      } else {
        const fields =
          caught instanceof ApiError
            ? restaurantFieldErrors(caught.errors)
            : {};
        setErrors(fields);
        setError(
          [getErrorMessage(caught), hiddenFieldMessages(fields)]
            .filter(Boolean)
            .join(" "),
        );
        focusError(fields);
      }
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  }
  if (loadStatus === "loading") return <Skeleton />;
  if (loadStatus === "error")
    return (
      <Card title="Chưa tải được thông tin nhà hàng">
        <Alert>{error}</Alert>
        <Button
          onClick={() => {
            setError("");
            setLoadStatus("loading");
            setAttempt(attempt + 1);
          }}
        >
          Thử lại
        </Button>
      </Card>
    );
  if (created || existing || conflict) {
    const restaurant = created ?? existing;
    return (
      <div className="stack form-page">
        <PageHeading
          title={created ? "Đăng ký nhà hàng thành công" : "Bạn đã có nhà hàng"}
        />
        <Card className="stack">
          <Alert tone={created ? "success" : "info"}>
            {created
              ? "Hồ sơ nhà hàng đã được tạo thành công."
              : "Mỗi tài khoản chủ nhà hàng chỉ đăng ký được một nhà hàng."}
          </Alert>
          {restaurant && (
            <>
              <h2>{restaurant.name}</h2>
              <p>{restaurant.addressLine}</p>
            </>
          )}
          {created && (
            <>
              <Badge tone="warning">Chưa xác minh</Badge>
              <p>
                Nhà hàng chưa hiển thị công khai. Bạn cần gửi hồ sơ xác minh
                trước khi tạo thực đơn.
              </p>
            </>
          )}
          <div className="actions">
            <ActionLink href={ownerVerificationHref()}>
              Đến hồ sơ xác minh
            </ActionLink>
            <ActionLink href={ownerProfileHref()} secondary>
              Quản lý hồ sơ
            </ActionLink>
            <ActionLink href={ownerRoutes.overview} secondary>
              Về tổng quan
            </ActionLink>
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="stack form-page">
      <PageHeading
        eyebrow="Dành cho chủ nhà hàng"
        title="Đăng ký nhà hàng của bạn"
        description="Một tài khoản chủ nhà hàng chỉ đăng ký một nhà hàng. Bạn có thể bổ sung giờ mở cửa sau."
      />
      <Alert tone="info">
        Sau khi đăng ký, nhà hàng ở trạng thái chưa xác minh và chưa hiển thị
        công khai.
      </Alert>
      <form
        className="stack"
        noValidate
        onSubmit={submit}
        ref={formRef}
        aria-busy={blocked}
      >
        {error && <Alert>{error}</Alert>}
        <fieldset disabled={blocked} className="registration-fields stack">
          <Card title="Thông tin nhà hàng">
            <p className="helper">Các mục có dấu * là bắt buộc.</p>
            <Field
              label="Tên nhà hàng"
              name="name"
              value={values.name}
              required
              maxLength={200}
              autoComplete="organization"
              error={errors.name}
              onChange={(event) => update("name", event.target.value)}
            />
            <div className="grid-2">
              <Field
                label="Số điện thoại nhà hàng"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={values.phone}
                required
                maxLength={20}
                error={errors.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
              <Field
                label="Email nhà hàng"
                name="email"
                type="email"
                autoComplete="email"
                value={values.email}
                error={errors.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </div>
            <Field
              label="Website"
              name="website"
              type="url"
              placeholder="https://"
              value={values.website}
              error={errors.website}
              onChange={(event) => update("website", event.target.value)}
            />
            <TextArea
              label="Mô tả"
              name="description"
              value={values.description}
              maxLength={2000}
              error={errors.description}
              onChange={(event) => update("description", event.target.value)}
            />
            <Field
              label="Địa chỉ"
              name="addressLine"
              value={values.addressLine}
              required
              maxLength={255}
              autoComplete="street-address"
              error={errors.addressLine}
              onChange={(event) => update("addressLine", event.target.value)}
            />
            <div className="grid-2">
              <ProvinceField
                label="Tỉnh / thành phố"
                name="provinceName"
                value={values.provinceName}
                required
                maxLength={100}
                error={errors.provinceName}
                onChange={(value) => update("provinceName", value)}
              />
              <WardField
                label="Phường / xã"
                name="ward"
                provinceName={values.provinceName}
                value={values.ward}
                maxLength={100}
                error={errors.ward}
                onChange={(value) => update("ward", value)}
              />
            </div>
            <div className="stack-sm">
              <Button
                name="location"
                variant="secondary"
                aria-invalid={!!errors.location}
                aria-describedby="restaurant-location-help"
                onClick={() => setMapOpen(true)}
              >
                Chọn vị trí trên bản đồ *
              </Button>
              <p
                id="restaurant-location-help"
                className={errors.location ? "field-error" : "helper"}
              >
                {errors.location ||
                  (location
                    ? `Đã chọn: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                    : "Chọn vị trí chính xác của nhà hàng để khách có thể tìm đường.")}
              </p>
              {location?.addressNotice && (
                <p className="helper" role="status">
                  {location.addressNotice}
                </p>
              )}
            </div>
            <SelectField
              label="Mức giá (không bắt buộc)"
              name="priceLevel"
              error={errors.priceLevel}
              value={values.priceLevel}
              onChange={(value) => update("priceLevel", value)}
              options={[
                { value: "", label: "Chưa chọn" },
                ...[1, 2, 3, 4].map((level) => ({
                  value: String(level),
                  label: `Mức giá ${level} · ${"₫".repeat(level)}`,
                })),
              ]}
            />
          </Card>
          <Card title="Hình ảnh nhà hàng">
            <RestaurantImageUpload
              label="Ảnh bìa"
              max={1}
              files={cover}
              disabled={blocked}
              error={errors.coverMediaId}
              onChange={(files) => {
                setCover(files);
                setErrors((previous) => ({ ...previous, coverMediaId: "" }));
              }}
              onPending={setCoverPending}
              service={service}
            />
            <RestaurantImageUpload
              label="Ảnh nhà hàng"
              max={10}
              files={gallery}
              disabled={blocked}
              error={errors.imageMediaIds}
              onChange={(files) => {
                setGallery(files);
                setErrors((previous) => ({ ...previous, imageMediaIds: "" }));
              }}
              onPending={setGalleryPending}
              service={service}
            />
          </Card>
        </fieldset>
        <div className="actions registration-actions">
          <Button
            type="submit"
            loading={busy}
            disabled={coverPending || galleryPending}
          >
            Đăng ký nhà hàng
          </Button>
          <Button
            variant="secondary"
            disabled={blocked}
            onClick={requestCancel}
          >
            Hủy
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={cancelOpen}
        title="Hủy đăng ký nhà hàng?"
        destructive
        label="Hủy đăng ký"
        cancelLabel="Tiếp tục đăng ký"
        onClose={() => setCancelOpen(false)}
        onConfirm={discardRegistration}
      >
        <p>Thông tin và ảnh bạn đã chọn sẽ bị bỏ nếu hủy đăng ký.</p>
      </ConfirmDialog>
      {mapOpen && (
        <RestaurantLocationPicker
          location={location}
          onClose={closeMap}
          onSelect={(point) => {
            setLocation(point);
            setValues((current) => fillRestaurantFromPlace(current, point));
            setErrors((previous) => ({
              ...previous,
              location: "",
              addressLine: "",
              provinceName: "",
              ward: "",
            }));
          }}
        />
      )}
    </div>
  );
}
