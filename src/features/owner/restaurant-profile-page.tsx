"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  ConfirmDialog,
  EmptyState,
  Field,
  Media,
  SelectField,
  Skeleton,
  Tabs,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";
import { ProvinceField } from "@/components/domain/province-field";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { MapPicker } from "@/components/domain/map-picker";
import {
  createMockRestaurantProfileService,
  ownerProfileFromDemo,
} from "@/mocks/restaurant-profile";
import {
  buildProfilePatch,
  profileFormFromRestaurant,
  profileToDemoView,
  validateProfilePatch,
} from "./profile-rules";
import { restaurantFieldErrors } from "./registration-rules";
import {
  restaurantProfileService,
  type RestaurantProfileService,
} from "./restaurant-profile-service";
import { RestaurantImageUpload } from "./restaurant-image-upload";
import { RestaurantLocationPicker } from "./restaurant-location-picker";
import type {
  MediaFileDto,
  OwnerRestaurantDto,
  RestaurantFormValues,
  RestaurantLocation,
} from "./restaurant-types";

export function RestaurantProfilePage({
  initialTab = "information",
}: {
  initialTab?: string;
}) {
  const { base } = useWorkspace();
  const { data, mode, mutate } = usePlatform();
  const [mockService] = useState(() => {
    const owner = data.restaurants.find(
      (item) => item.id === data.ownerRestaurantId,
    );
    return createMockRestaurantProfileService(
      owner ? ownerProfileFromDemo(owner, data.hours) : null,
    );
  });
  const demo = mode === "demo";
  const service = demo ? mockService : restaurantProfileService;
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
          <ActionLink href={`${base}/register`}>Đăng ký nhà hàng</ActionLink>
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
      demo={demo}
      initialTab={initialTab}
      onSaved={async (saved) => {
        if (demo)
          await mutate((next) => {
            const index = next.restaurants.findIndex(
              (item) => item.id === next.ownerRestaurantId,
            );
            if (index >= 0)
              next.restaurants[index] = profileToDemoView(
                next.restaurants[index],
                saved,
              );
          }, ""); // The editor shows success after the operation and fixture save finish.
        setRestaurant(saved);
      }}
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
  demo,
  initialTab,
  onSaved,
}: {
  restaurant: OwnerRestaurantDto;
  service: RestaurantProfileService;
  demo: boolean;
  initialTab: string;
  onSaved: (restaurant: OwnerRestaurantDto) => Promise<void>;
}) {
  const router = useRouter();
  const { base } = useWorkspace();
  const tab = ["information", "photos"].includes(initialTab)
    ? initialTab
    : "information";
  const [values, setValues] = useState(() =>
    profileFormFromRestaurant(restaurant),
  );
  const [location, setLocation] = useState<RestaurantLocation>({
    name: restaurant.name,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
  });
  const [cover, setCover] = useState<MediaFileDto[]>([]);
  const [gallery, setGallery] = useState<MediaFileDto[]>([]);
  const [clearCover, setClearCover] = useState(false);
  const [galleryMode, setGalleryMode] = useState<
    "unchanged" | "replace" | "clear"
  >("unchanged");
  const [coverPending, setCoverPending] = useState(false);
  const [galleryPending, setGalleryPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{
    field: string;
    tab: string;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const submitting = useRef(false);
  const blocked = saving || coverPending || galleryPending;
  const patch = buildProfilePatch(values, location, restaurant, {
    coverMediaId: cover[0]?.id ?? (clearCover ? null : undefined),
    imageMediaIds:
      galleryMode === "clear"
        ? []
        : galleryMode === "replace" && gallery.length
          ? gallery.map((file) => file.id)
          : undefined,
  });
  const dirty = Object.keys(patch).length > 0 || galleryMode === "replace";
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
    if (tab !== target) router.push(`${base}/profile?tab=${target}`);
  }
  function change(key: keyof RestaurantFormValues, value: string) {
    setFocusRequest(null);
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setSuccess("");
  }
  function resetDraft() {
    setFocusRequest(null);
    setValues(profileFormFromRestaurant(restaurant));
    setLocation({
      name: restaurant.name,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    });
    setCover([]);
    setGallery([]);
    setClearCover(false);
    setGalleryMode("unchanged");
    setErrors({});
    setError("");
    setSuccess("");
  }
  function changeTab(next: string) {
    if (blocked || next === tab) return;
    const navigate = () => router.push(`${base}/profile?tab=${next}`);
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
    if (galleryMode === "replace" && !gallery.length)
      invalid.imageMediaIds = "Chọn ít nhất một ảnh để thay thư viện hiện tại.";
    setErrors(invalid);
    setError("");
    setSuccess("");
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
      await onSaved(saved);
      if (!active.current) return;
      setValues(profileFormFromRestaurant(saved));
      setLocation({
        name: saved.name,
        latitude: saved.latitude,
        longitude: saved.longitude,
      });
      setCover([]);
      setGallery([]);
      setClearCover(false);
      setGalleryMode("unchanged");
      setErrors({});
      setFocusRequest(null);
      setSuccess(
        demo ? "Đã lưu hồ sơ trong bản minh họa." : "Đã lưu hồ sơ nhà hàng.",
      );
    } catch (caught) {
      if (!active.current) return;
      const fields =
        caught instanceof ApiError ? restaurantFieldErrors(caught.errors) : {};
      setErrors(fields);
      setError(getErrorMessage(caught));
      focusErrors(fields);
    } finally {
      submitting.current = false;
      if (active.current) setSaving(false);
    }
  }
  return (
    <div className="stack registration-page">
      <PageHeading
        title="Nhà hàng của tôi"
        description={`${restaurant.name} · Chỉ các thông tin bạn thay đổi được lưu.`}
      />
      <Tabs
        value={tab}
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
              <Card title="Thông tin nhà hàng" className="stack">
                <Field
                  label="Tên nhà hàng"
                  name="name"
                  required
                  maxLength={200}
                  value={values.name}
                  error={errors.name}
                  onChange={(event) => change("name", event.target.value)}
                />
                <div className="grid-2">
                  <Field
                    label="Số điện thoại nhà hàng"
                    name="phone"
                    type="tel"
                    maxLength={20}
                    value={values.phone}
                    error={errors.phone}
                    onChange={(event) => change("phone", event.target.value)}
                  />
                  <Field
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
                <TextArea
                  label="Mô tả"
                  name="description"
                  maxLength={2000}
                  value={values.description}
                  error={errors.description}
                  onChange={(event) =>
                    change("description", event.target.value)
                  }
                />
                <Field
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
                <div className="grid-3">
                  <ProvinceField
                    label="Tỉnh / thành phố"
                    name="provinceName"
                    maxLength={100}
                    value={values.provinceName}
                    error={errors.provinceName}
                    onChange={(value) => change("provinceName", value)}
                  />
                  <Field
                    label="Quận / huyện"
                    name="district"
                    maxLength={100}
                    value={values.district}
                    error={errors.district}
                    onChange={(event) => change("district", event.target.value)}
                  />
                  <Field
                    label="Phường / xã"
                    name="ward"
                    maxLength={100}
                    value={values.ward}
                    error={errors.ward}
                    onChange={(event) => change("ward", event.target.value)}
                  />
                </div>
                <Button
                  name="location"
                  variant="secondary"
                  aria-invalid={!!errors.location}
                  aria-describedby="profile-location-help"
                  onClick={() => setMapOpen(true)}
                >
                  Chọn vị trí trên bản đồ
                </Button>
                <p
                  id="profile-location-help"
                  className={errors.location ? "field-error" : "helper"}
                >
                  {errors.location ||
                    `Tọa độ: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`}
                </p>
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
            ) : (
              <Card title="Hình ảnh nhà hàng" className="stack">
                {!cover.length && !clearCover && restaurant.coverUrl && (
                  <div className="stack-sm">
                    <p>Ảnh bìa hiện tại</p>
                    <div className="upload-grid">
                      <Media src={restaurant.coverUrl} alt="Ảnh bìa hiện tại" />
                    </div>
                  </div>
                )}
                {clearCover && (
                  <Alert tone="warning">
                    Ảnh bìa sẽ được xóa khi bạn lưu thay đổi.
                  </Alert>
                )}
                <RestaurantImageUpload
                  label="Ảnh bìa mới"
                  max={1}
                  files={cover}
                  disabled={blocked}
                  error={errors.coverMediaId}
                  service={service}
                  onPending={setCoverPending}
                  onChange={(files) => {
                    setFocusRequest(null);
                    setCover(files);
                    setClearCover(false);
                    setSuccess("");
                    setErrors((current) => ({ ...current, coverMediaId: "" }));
                  }}
                />
                {restaurant.coverUrl && !clearCover && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setConfirmation({
                        title: "Bỏ ảnh bìa hiện tại?",
                        description: "Ảnh bìa sẽ được bỏ khi bạn lưu hồ sơ.",
                        label: "Bỏ ảnh bìa",
                        action: () => {
                          setCover([]);
                          setClearCover(true);
                          setSuccess("");
                        },
                      })
                    }
                  >
                    Bỏ ảnh bìa hiện tại
                  </Button>
                )}
                {!!restaurant.images.length && (
                  <>
                    <h3>Thư viện ảnh hiện tại</h3>
                    <div className="upload-grid">
                      {restaurant.images.map((url, index) => (
                        <Media
                          key={`${url}-${index}`}
                          src={url}
                          alt={`Ảnh nhà hàng ${index + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
                {galleryMode === "unchanged" && !!restaurant.images.length ? (
                  <div className="actions">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setConfirmation({
                          title: "Thay thư viện ảnh?",
                          description:
                            "Ảnh bạn chọn sẽ thay toàn bộ thư viện hiện tại sau khi lưu hồ sơ.",
                          label: "Chọn ảnh thay thế",
                          action: () => {
                            setGalleryMode("replace");
                            setSuccess("");
                          },
                        })
                      }
                    >
                      Thay thư viện ảnh
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        setConfirmation({
                          title: "Xóa toàn bộ thư viện ảnh?",
                          description:
                            "Tất cả ảnh trong thư viện hiện tại sẽ được bỏ khi bạn lưu hồ sơ.",
                          label: "Xóa toàn bộ ảnh",
                          action: () => {
                            setGallery([]);
                            setGalleryMode("clear");
                            setSuccess("");
                          },
                        })
                      }
                    >
                      Xóa toàn bộ ảnh
                    </Button>
                  </div>
                ) : (
                  <>
                    {galleryMode === "clear" ? (
                      <Alert tone="warning">
                        Thư viện ảnh sẽ được xóa khi bạn lưu thay đổi.
                      </Alert>
                    ) : (
                      !!restaurant.images.length && (
                        <Alert tone="info">
                          Ảnh mới sẽ thay toàn bộ thư viện hiện tại khi lưu.
                        </Alert>
                      )
                    )}
                    <RestaurantImageUpload
                      label="Ảnh nhà hàng mới"
                      max={10}
                      files={gallery}
                      disabled={blocked}
                      error={errors.imageMediaIds}
                      service={service}
                      onPending={setGalleryPending}
                      onChange={(files) => {
                        setFocusRequest(null);
                        setGallery(files);
                        setGalleryMode(
                          files.length || restaurant.images.length
                            ? "replace"
                            : "unchanged",
                        );
                        setSuccess("");
                        setErrors((current) => ({
                          ...current,
                          imageMediaIds: "",
                        }));
                      }}
                    />
                    {!!restaurant.images.length && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const keep = () => {
                            setGallery([]);
                            setGalleryMode("unchanged");
                            setErrors((current) => ({
                              ...current,
                              imageMediaIds: "",
                            }));
                          };
                          if (gallery.length)
                            setConfirmation({
                              title: "Giữ thư viện hiện tại?",
                              description:
                                "Các ảnh mới bạn chọn sẽ được bỏ khỏi bản chỉnh sửa.",
                              label: "Giữ thư viện hiện tại",
                              action: keep,
                            });
                          else keep();
                        }}
                      >
                        Giữ thư viện hiện tại
                      </Button>
                    )}
                  </>
                )}
              </Card>
            )}
          </fieldset>
          <div className="actions registration-actions">
            <Button
              type="submit"
              loading={saving}
              disabled={
                !dirty ||
                coverPending ||
                galleryPending ||
                (galleryMode === "replace" && !gallery.length)
              }
            >
              Lưu thay đổi
            </Button>
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
      {mapOpen &&
        (demo ? (
          <MapPicker
            open
            initialLocation={location}
            onClose={closeMap}
            onSelect={(point) => {
              setFocusRequest(null);
              setLocation(point);
              setErrors((current) => ({ ...current, location: "" }));
              setSuccess("");
            }}
          />
        ) : (
          <RestaurantLocationPicker
            location={location}
            onClose={closeMap}
            onSelect={(point) => {
              setFocusRequest(null);
              setLocation(point);
              setErrors((current) => ({ ...current, location: "" }));
              setSuccess("");
            }}
          />
        ))}
    </div>
  );
}
