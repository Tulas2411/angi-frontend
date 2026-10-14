"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { MapPicker } from "@/components/domain/map-picker";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";
import { api } from "@/shared/api/client";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { createMockRestaurantRegistrationService } from "@/mocks/restaurant-registration";
import {
  buildRestaurantRequest,
  emptyRestaurantForm,
  restaurantFieldErrors,
  validateRestaurantForm,
} from "./registration-rules";
import { restaurantService } from "./restaurant-service";
import { RestaurantImageUpload } from "./restaurant-image-upload";
import { RestaurantLocationPicker } from "./restaurant-location-picker";
import type {
  MediaFileDto,
  OwnerRestaurantDto,
  RestaurantFormValues,
  RestaurantLocation,
} from "./restaurant-types";

export function RestaurantRegistrationPage() {
  const router = useRouter();
  const { base } = useWorkspace();
  const { data, mode, mutate } = usePlatform();
  const demo = mode === "demo";
  const mockService = useMemo(
    () => createMockRestaurantRegistrationService(),
    [],
  );
  const service = demo ? mockService : restaurantService;
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
  const [loadStatus, setLoadStatus] = useState(demo ? "ready" : "loading");
  const [attempt, setAttempt] = useState(0);
  const [provinces, setProvinces] = useState<{ name: string }[]>(
    demo
      ? [
          { name: "Thành phố Hà Nội" },
          { name: "Thành phố Đà Nẵng" },
          { name: "Thành phố Hồ Chí Minh" },
        ]
      : [],
  );
  const [provinceError, setProvinceError] = useState(false);
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
    if (demo) return;
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
  }, [demo, attempt]);
  useEffect(() => {
    if (demo) return;
    let ignore = false;
    api
      .getPublic<{ name: string }[]>("locations/provinces")
      .then((items) => {
        if (!ignore) {
          setProvinces(items);
          setProvinceError(false);
        }
      })
      .catch(() => {
        if (!ignore) setProvinceError(true);
      });
    return () => {
      ignore = true;
    };
  }, [demo]);
  const demoExisting = demo
    ? data.restaurants.find((item) => item.id === data.ownerRestaurantId)
    : undefined;
  const blocked = busy || coverPending || galleryPending;
  function update(field: keyof RestaurantFormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
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
    router.back();
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
      if (demo)
        await mutate((next) => {
          const id = `owner-restaurant-${restaurant.id}`;
          next.restaurants.push({
            id,
            name: restaurant.name,
            address: restaurant.addressLine,
            province: restaurant.provinceName ?? "",
            district: restaurant.district ?? "",
            phone: restaurant.phone ?? "",
            email: restaurant.email ?? "",
            website: restaurant.website ?? "",
            description: restaurant.description ?? "",
            image: restaurant.coverUrl ?? "",
            photos: restaurant.images,
            latitude: restaurant.latitude,
            longitude: restaurant.longitude,
            verification: restaurant.verificationStatus,
            moderation: restaurant.moderationStatus,
            operating:
              restaurant.operatingStatus === "open" ? "open" : "closed",
            rating: restaurant.ratingAvg,
          });
          next.ownerRestaurantId = id;
          next.hours = [];
        }, "Đã tạo hồ sơ nhà hàng trong bản minh họa.");
      if (active.current) setCreated(restaurant);
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
        setError(getErrorMessage(caught));
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
  if (created || existing || demoExisting || conflict) {
    const restaurant = created ?? existing ?? demoExisting;
    return (
      <div className="stack registration-page">
        <PageHeading
          title={created ? "Đăng ký nhà hàng thành công" : "Bạn đã có nhà hàng"}
        />
        <Card className="stack elevated">
          <Alert tone={created ? "success" : "info"}>
            {created
              ? demo
                ? "Hồ sơ đã được tạo trong bản minh họa."
                : "Hồ sơ nhà hàng đã được tạo thành công."
              : "Mỗi tài khoản chủ nhà hàng chỉ đăng ký được một nhà hàng."}
          </Alert>
          {restaurant && (
            <>
              <h2>{restaurant.name}</h2>
              {"addressLine" in restaurant ? (
                <p>{restaurant.addressLine}</p>
              ) : (
                <p>{restaurant.address}</p>
              )}
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
            <ActionLink href={`${base}/verification`}>
              Đến hồ sơ xác minh
            </ActionLink>
            <ActionLink href={base} secondary>
              Về tổng quan
            </ActionLink>
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="stack registration-page">
      <PageHeading
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
          <Card title="Thông tin nhà hàng" className="elevated">
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
            <div className="grid-3">
              <div>
                <Field
                  label="Tỉnh / thành phố"
                  name="provinceName"
                  value={values.provinceName}
                  required
                  maxLength={100}
                  list="restaurant-provinces"
                  error={errors.provinceName}
                  helper={
                    provinceError
                      ? "Chưa tải được gợi ý. Nhập tên đầy đủ, ví dụ Thành phố Hà Nội."
                      : "Nhập tên đầy đủ hoặc chọn từ gợi ý."
                  }
                  onChange={(event) =>
                    update("provinceName", event.target.value)
                  }
                />
                <datalist id="restaurant-provinces">
                  {provinces.map((item) => (
                    <option value={item.name} key={item.name} />
                  ))}
                </datalist>
              </div>
              <Field
                label="Quận / huyện"
                name="district"
                value={values.district}
                required
                maxLength={100}
                error={errors.district}
                onChange={(event) => update("district", event.target.value)}
              />
              <Field
                label="Phường / xã"
                name="ward"
                value={values.ward}
                maxLength={100}
                error={errors.ward}
                onChange={(event) => update("ward", event.target.value)}
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
            {demo && (
              <p className="helper">
                Ảnh trong bản minh họa chỉ được đọc trên thiết bị của bạn.
              </p>
            )}
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
      {mapOpen &&
        (demo ? (
          <MapPicker
            open
            onClose={closeMap}
            onSelect={(point) => {
              setLocation(point);
              setErrors((previous) => ({ ...previous, location: "" }));
            }}
          />
        ) : (
          <RestaurantLocationPicker
            location={location}
            onClose={closeMap}
            onSelect={(point) => {
              setLocation(point);
              setErrors((previous) => ({ ...previous, location: "" }));
            }}
          />
        ))}
    </div>
  );
}
