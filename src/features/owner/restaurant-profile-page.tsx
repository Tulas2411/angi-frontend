"use client";
import { notify } from "@/shared/ui/notify";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  ConfirmDialog,
  EmptyState,
  Field,
  SelectField,
  Skeleton,
  TextArea,
} from "@/components/ui/primitives";
import { RestaurantProfileHeader } from "./restaurant-profile-header";
import { ProvinceField } from "@/components/domain/province-field";
import { WardField } from "@/components/domain/ward-field";
import { provinceNameKey } from "@/shared/locations/provinces";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import {
  buildProfilePatch,
  profileFormFromRestaurant,
  validateProfilePatch,
} from "./profile-rules";
import { ownerProfileHref, ownerRoutes, type OwnerProfileTab } from "./routes";
import {
  hiddenFieldMessages,
  restaurantFieldErrors,
} from "./registration-rules";
import {
  restaurantProfileService,
  type RestaurantProfileService,
} from "./restaurant-profile-service";
import { RestaurantCoverField } from "./restaurant-cover-field";
import {
  GALLERY_LIMIT,
  RestaurantGalleryField,
  type GalleryPhoto,
} from "./restaurant-gallery-field";
import { RestaurantLocationPicker } from "./restaurant-location-picker";
import {
  fillRestaurantFromPlace,
  restaurantLocationFromProfile,
} from "./restaurant-location-rules";
import type {
  MediaFileDto,
  OwnerRestaurantDto,
  RestaurantFormValues,
  RestaurantLocation,
} from "./restaurant-types";

/** Saved gallery from OWN-02: `imageMediaIds` follows the order of `images`. */
function savedGalleryPhotos(restaurant: OwnerRestaurantDto): GalleryPhoto[] {
  return restaurant.imageMediaIds.map((id, index) => ({
    id,
    url: restaurant.images[index] ?? "",
  }));
}

export function RestaurantProfilePage({
  initialTab = "information",
}: {
  initialTab?: string;
}) {
  const service = restaurantProfileService;
  const [restaurant, setRestaurant] = useState<OwnerRestaurantDto | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
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
        if (
          caught instanceof ApiError &&
          caught.errorCode === "RESTAURANT_NOT_FOUND"
        )
          setStatus("missing");
        else {
          setError(getErrorMessage(caught));
          setStatus("error");
        }
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
        Đăng ký nhà hàng trước khi quản lý hồ sơ.
      </EmptyState>
    );
  if (status === "error")
    return (
      <Card title="Chưa tải được hồ sơ nhà hàng">
        <Alert>{error}</Alert>
        <Button
          onClick={() => {
            setStatus("loading");
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          Thử lại
        </Button>
      </Card>
    );
  if (!restaurant) return null;
  return (
    <RestaurantProfileEditor
      restaurant={restaurant}
      service={service}
      initialTab={initialTab}
      onSaved={setRestaurant}
    />
  );
}

type Confirmation = {
  title: string;
  description: string;
  label: string;
  action: () => void;
};

function RestaurantProfileEditor({
  restaurant,
  service,
  initialTab,
  onSaved,
}: {
  restaurant: OwnerRestaurantDto;
  service: RestaurantProfileService;
  initialTab: string;
  onSaved: (restaurant: OwnerRestaurantDto) => void;
}) {
  const router = useRouter();
  const tab = ["information", "photos"].includes(initialTab)
    ? initialTab
    : "information";
  const [values, setValues] = useState(() =>
    profileFormFromRestaurant(restaurant),
  );
  const [location, setLocation] = useState<RestaurantLocation | null>(() =>
    restaurantLocationFromProfile(restaurant),
  );
  const [cover, setCover] = useState<MediaFileDto[]>([]);
  const [clearCover, setClearCover] = useState(false);
  // null keeps the saved gallery; otherwise the edited list sent as imageMediaIds.
  const [galleryDraft, setGalleryDraft] = useState<GalleryPhoto[] | null>(null);
  const [coverPending, setCoverPending] = useState(false);
  const [galleryPending, setGalleryPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{
    field: string;
    tab: string;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const submitting = useRef(false);
  const blocked = saving || coverPending || galleryPending;
  const savedGallery = savedGalleryPhotos(restaurant);
  const galleryChanged =
    !!galleryDraft &&
    galleryDraft.map((photo) => photo.id).join() !==
      savedGallery.map((photo) => photo.id).join();
  const patch = buildProfilePatch(values, location, restaurant, {
    coverMediaId: cover[0]?.id ?? (clearCover ? null : undefined),
    imageMediaIds:
      galleryChanged && galleryDraft
        ? galleryDraft.map((photo) => photo.id)
        : undefined,
  });
  const dirty = Object.keys(patch).length > 0;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!focusRequest || tab !== focusRequest.tab) return;
    const control = formRef.current?.elements.namedItem(focusRequest.field);
    if (control instanceof HTMLElement) control.focus();
    else errorRef.current?.focus();
  }, [focusRequest, tab]);
  function focusErrors(fields: Record<string, string>) {
    const field = Object.keys(fields).find((key) => fields[key]);
    if (!field) {
      setFocusRequest(null);
      return;
    }
    const target = ["coverMediaId", "imageMediaIds"].includes(field)
      ? "photos"
      : "information";
    setFocusRequest({ field, tab: target });
    if (tab !== target) router.push(ownerProfileHref(target));
  }
  function change(key: keyof RestaurantFormValues, value: string) {
    setFocusRequest(null);
    setValues((current) => ({
      ...current,
      [key]: value,
      ...(key === "provinceName" &&
      provinceNameKey(value) !== provinceNameKey(current.provinceName)
        ? { ward: "" }
        : {}),
    }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }
  function resetDraft() {
    setFocusRequest(null);
    setValues(profileFormFromRestaurant(restaurant));
    setLocation(restaurantLocationFromProfile(restaurant));
    setCover([]);
    setClearCover(false);
    setGalleryDraft(null);
    setErrors({});
    setError("");
  }
  function changeTab(next: string) {
    if (blocked || next === tab) return;
    const navigate = () =>
      router.push(ownerProfileHref(next as OwnerProfileTab));
    if (dirty && ["hours", "status"].includes(next))
      setConfirmation({
        title: "Bỏ thay đổi chưa lưu?",
        description:
          "Thông tin và ảnh bạn đang chỉnh sửa sẽ bị bỏ khi chuyển thẻ.",
        label: "Bỏ thay đổi và chuyển thẻ",
        action: navigate,
      });
    else navigate();
  }
  function closeMap() {
    setMapOpen(false);
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>('[name="location"]')?.focus(),
    );
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || submitting.current || !dirty) return;
    const invalid = validateProfilePatch(patch);
    setErrors(invalid);
    setError("");
    if (Object.keys(invalid).length) {
      setError("Vui lòng kiểm tra thông tin đã nhập.");
      focusErrors(invalid);
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const saved = await service.updateProfile(patch);
      if (!active.current) return;
      onSaved(saved);
      if (!active.current) return;
      setValues(profileFormFromRestaurant(saved));
      setLocation(restaurantLocationFromProfile(saved));
      setCover([]);
      setClearCover(false);
      setGalleryDraft(null);
      setErrors({});
      setFocusRequest(null);
      notify.success("Đã lưu hồ sơ nhà hàng.");
    } catch (caught) {
      if (!active.current) return;
      const fields =
        caught instanceof ApiError ? restaurantFieldErrors(caught.errors) : {};
      setErrors(fields);
      setError(
        [getErrorMessage(caught), hiddenFieldMessages(fields)]
          .filter(Boolean)
          .join(" "),
      );
      focusErrors(fields);
    } finally {
      submitting.current = false;
      if (active.current) setSaving(false);
    }
  }
  return (
    <div className="stack form-page rp-page">
      <RestaurantProfileHeader
        restaurant={restaurant}
        tab={tab === "photos" ? "photos" : "information"}
        onTab={changeTab}
      />
      {error && (
        <div ref={errorRef} tabIndex={-1}>
          <Alert>{error}</Alert>
        </div>
      )}
      {tab === "information" || tab === "photos" ? (
        <form
          className="stack"
          noValidate
          ref={formRef}
          onSubmit={save}
          aria-busy={blocked}
        >
          <fieldset className="registration-fields stack" disabled={blocked}>
            {tab === "information" ? (
              <div className="rp-grid">
                <Card title="Giới thiệu & liên hệ" className="stack">
                  <Field
                    placeholder="Ví dụ: Bún Bò Bà Diệu"
                    label="Tên nhà hàng"
                    name="name"
                    required
                    maxLength={200}
                    value={values.name}
                    error={errors.name}
                    onChange={(event) => change("name", event.target.value)}
                  />
                  <TextArea
                    placeholder="Món đặc trưng, không gian, điều làm quán khác biệt…"
                    label="Mô tả"
                    name="description"
                    maxLength={2000}
                    value={values.description}
                    error={errors.description}
                    onChange={(event) =>
                      change("description", event.target.value)
                    }
                  />
                  <div className="grid-2">
                    <Field
                      placeholder="Ví dụ: 0236 3812 345"
                      label="Số điện thoại nhà hàng"
                      name="phone"
                      type="tel"
                      maxLength={20}
                      value={values.phone}
                      error={errors.phone}
                      onChange={(event) => change("phone", event.target.value)}
                    />
                    <Field
                      placeholder="lienhe@nhahang.vn"
                      label="Email nhà hàng"
                      name="email"
                      type="email"
                      value={values.email}
                      error={errors.email}
                      onChange={(event) => change("email", event.target.value)}
                    />
                  </div>
                  <Field
                    label="Website"
                    name="website"
                    type="url"
                    placeholder="https://"
                    value={values.website}
                    error={errors.website}
                    onChange={(event) => change("website", event.target.value)}
                  />
                  <SelectField
                    label="Mức giá (không bắt buộc)"
                    name="priceLevel"
                    error={errors.priceLevel}
                    value={values.priceLevel}
                    onChange={(value) => change("priceLevel", value)}
                    options={[
                      { value: "", label: "Chưa chọn" },
                      ...[1, 2, 3, 4].map((level) => ({
                        value: String(level),
                        label: `Mức giá ${level} · ${"₫".repeat(level)}`,
                      })),
                    ]}
                  />
                </Card>
                <Card title="Địa chỉ & vị trí" className="stack">
                  <div className="grid-2">
                    <ProvinceField
                      label="Tỉnh / thành phố"
                      name="provinceName"
                      maxLength={100}
                      value={values.provinceName}
                      error={errors.provinceName}
                      onChange={(value) => change("provinceName", value)}
                    />
                    <WardField
                      label="Phường / xã"
                      name="ward"
                      provinceName={values.provinceName}
                      maxLength={100}
                      value={values.ward}
                      error={errors.ward}
                      onChange={(value) => change("ward", value)}
                    />
                  </div>
                  <Field
                    placeholder="Số nhà, tên đường"
                    label="Địa chỉ"
                    name="addressLine"
                    required
                    maxLength={255}
                    value={values.addressLine}
                    error={errors.addressLine}
                    onChange={(event) =>
                      change("addressLine", event.target.value)
                    }
                  />
                  <div className="rp-location">
                    <strong>Vị trí trên bản đồ</strong>
                    <p
                      id="profile-location-help"
                      className={errors.location ? "field-error" : "helper"}
                    >
                      {errors.location ||
                        (location
                          ? `Tọa độ: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                          : "Chưa có tọa độ. Bạn có thể chọn vị trí trên bản đồ.")}
                    </p>
                    {location?.addressNotice && (
                      <p className="helper" role="status">
                        {location.addressNotice}
                      </p>
                    )}
                    <Button
                      name="location"
                      variant="secondary"
                      aria-invalid={!!errors.location}
                      aria-describedby="profile-location-help"
                      onClick={() => setMapOpen(true)}
                    >
                      {location
                        ? "Đổi vị trí trên bản đồ"
                        : "Chọn vị trí trên bản đồ"}
                    </Button>
                  </div>
                </Card>
              </div>
            ) : (
              <Card title="Hình ảnh nhà hàng" className="stack">
                <section
                  className="photos-section"
                  aria-labelledby="cover-heading"
                >
                  <h3 id="cover-heading">Ảnh bìa</h3>
                  <RestaurantCoverField
                    savedUrl={restaurant.coverUrl}
                    files={cover}
                    cleared={clearCover}
                    disabled={blocked}
                    error={errors.coverMediaId}
                    service={service}
                    onPending={setCoverPending}
                    onChange={(files) => {
                      setFocusRequest(null);
                      setCover(files);
                      setClearCover(false);
                      setErrors((current) => ({
                        ...current,
                        coverMediaId: "",
                      }));
                    }}
                    onRemove={() => {
                      const remove = () => {
                        setCover([]);
                        setClearCover(!!restaurant.coverUrl);
                        setErrors((current) => ({
                          ...current,
                          coverMediaId: "",
                        }));
                      };
                      // Only the saved cover needs a confirmation; a fresh pick is simply dropped.
                      if (restaurant.coverUrl && !cover.length)
                        setConfirmation({
                          title: "Bỏ ảnh bìa hiện tại?",
                          description: "Ảnh bìa sẽ được bỏ khi bạn lưu hồ sơ.",
                          label: "Bỏ ảnh bìa",
                          action: remove,
                        });
                      else remove();
                    }}
                    onRestore={() => {
                      setCover([]);
                      setClearCover(false);
                      setErrors((current) => ({
                        ...current,
                        coverMediaId: "",
                      }));
                    }}
                  />
                </section>
                <section
                  className="photos-section"
                  aria-labelledby="gallery-heading"
                >
                  <div className="between">
                    <h3 id="gallery-heading">Thư viện ảnh</h3>
                    <span className="helper">
                      {(galleryDraft ?? savedGallery).length} / {GALLERY_LIMIT}
                    </span>
                  </div>
                  <p className="helper">
                    Ảnh đầu tiên hiện lớn ở trang tổng quan. Dùng mũi tên để đổi
                    thứ tự; thay đổi chỉ được lưu khi bạn bấm Lưu thay đổi.
                  </p>
                  <RestaurantGalleryField
                    photos={galleryDraft ?? savedGallery}
                    changed={galleryChanged}
                    disabled={blocked}
                    error={errors.imageMediaIds}
                    service={service}
                    onPending={setGalleryPending}
                    onChange={(photos) => {
                      setFocusRequest(null);
                      setGalleryDraft(photos);
                      setErrors((current) => ({
                        ...current,
                        imageMediaIds: "",
                      }));
                    }}
                    onRestore={() => {
                      setGalleryDraft(null);
                      setErrors((current) => ({
                        ...current,
                        imageMediaIds: "",
                      }));
                    }}
                    onClear={() =>
                      setConfirmation({
                        title: "Xóa toàn bộ thư viện ảnh?",
                        description:
                          "Tất cả ảnh trong thư viện sẽ được bỏ khi bạn lưu hồ sơ.",
                        label: "Xóa toàn bộ ảnh",
                        action: () => {
                          setGalleryDraft([]);
                        },
                      })
                    }
                  />
                </section>
              </Card>
            )}
          </fieldset>
          <div className="rp-savebar" data-dirty={dirty || undefined}>
            <p>
              {dirty
                ? "Bạn có thay đổi chưa lưu."
                : "Chỉ các thông tin bạn thay đổi mới được lưu."}
            </p>
            <div className="actions">
              <Button
                variant="secondary"
                disabled={!dirty || blocked}
                onClick={() =>
                  setConfirmation({
                    title: "Bỏ thay đổi chưa lưu?",
                    description:
                      "Thông tin và ảnh bạn đang chỉnh sửa sẽ được khôi phục về lần lưu gần nhất.",
                    label: "Bỏ thay đổi",
                    action: resetDraft,
                  })
                }
              >
                Hủy thay đổi
              </Button>
              <Button
                type="submit"
                loading={saving}
                disabled={!dirty || coverPending || galleryPending}
              >
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </form>
      ) : null}
      <ConfirmDialog
        open={!!confirmation}
        title={confirmation?.title ?? "Xác nhận thay đổi"}
        destructive
        label={confirmation?.label}
        cancelLabel="Tiếp tục chỉnh sửa"
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          confirmation?.action();
          setConfirmation(null);
        }}
      >
        <p>{confirmation?.description}</p>
      </ConfirmDialog>
      {mapOpen && (
        <RestaurantLocationPicker
          location={location}
          onClose={closeMap}
          onSelect={(point) => {
            setFocusRequest(null);
            setLocation(point);
            setValues((current) => fillRestaurantFromPlace(current, point));
            setErrors((current) => ({
              ...current,
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
