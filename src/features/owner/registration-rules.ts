import type {
  RegisterRestaurantRequestDto,
  RestaurantFormValues,
  RestaurantLocation,
} from "./restaurant-types";

export const emptyRestaurantForm: RestaurantFormValues = {
  name: "",
  phone: "",
  email: "",
  website: "",
  description: "",
  addressLine: "",
  provinceName: "",
  district: "",
  ward: "",
  priceLevel: "",
};

export function validateRestaurantForm(
  values: RestaurantFormValues,
  location: RestaurantLocation | null,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const limits = {
    name: 200,
    phone: 20,
    addressLine: 255,
    provinceName: 100,
    district: 100,
    ward: 100,
    description: 2000,
  };
  const labels = {
    name: "Tên nhà hàng",
    phone: "Số điện thoại",
    addressLine: "Địa chỉ",
    provinceName: "Tỉnh / thành phố",
    district: "Quận / huyện",
    ward: "Phường / xã",
    description: "Mô tả",
  };
  for (const field of Object.keys(limits) as (keyof typeof limits)[]) {
    const value = values[field].trim();
    if (
      ["name", "phone", "addressLine", "provinceName", "district"].includes(
        field,
      ) &&
      !value
    )
      errors[field] = `${labels[field]} là bắt buộc.`;
    else if (value.length > limits[field])
      errors[field] =
        `${labels[field]} không được vượt quá ${limits[field]} ký tự.`;
  }
  if (
    values.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
  )
    errors.email = "Email không đúng định dạng.";
  if (values.website.trim()) {
    try {
      const url = new URL(values.website.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      errors.website = "Website phải là URL http hoặc https.";
    }
  }
  if (values.priceLevel && !["1", "2", "3", "4"].includes(values.priceLevel))
    errors.priceLevel = "Mức giá phải từ 1 đến 4.";
  if (
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    Math.abs(location.latitude) > 90 ||
    Math.abs(location.longitude) > 180
  )
    errors.location = "Chọn vị trí nhà hàng hoặc nhập tọa độ hợp lệ.";
  return errors;
}

export function buildRestaurantRequest(
  values: RestaurantFormValues,
  location: RestaurantLocation,
  coverMediaId?: number,
  imageMediaIds: number[] = [],
): RegisterRestaurantRequestDto {
  const optional = (field: keyof RestaurantFormValues) =>
    values[field].trim() || undefined;
  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    addressLine: values.addressLine.trim(),
    district: values.district.trim(),
    provinceName: values.provinceName.trim(),
    latitude: location.latitude,
    longitude: location.longitude,
    description: optional("description"),
    email: optional("email"),
    website: optional("website"),
    ward: optional("ward"),
    priceLevel: values.priceLevel ? Number(values.priceLevel) : undefined,
    coverMediaId,
    imageMediaIds: imageMediaIds.length ? imageMediaIds : undefined,
  };
}

export function restaurantFieldErrors(
  errors?: Record<string, string[]>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors ?? {}).map(([key, messages]) => [
      /^(latitude|longitude)$/i.test(key)
        ? "location"
        : key[0].toLowerCase() + key.slice(1),
      messages.join(" "),
    ]),
  );
}

export function validateRestaurantImage(
  file: Pick<File, "type" | "size">,
): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.";
  if (file.size > 5 * 1024 * 1024) return "Mỗi ảnh không được vượt quá 5 MB.";
  if (!file.size) return "Ảnh không được là tệp rỗng.";
  return null;
}
