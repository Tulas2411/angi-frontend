import { describe, expect, it } from "vitest";
import {
  buildRestaurantRequest,
  emptyRestaurantForm,
  hiddenFieldMessages,
  restaurantFieldErrors,
  validateRestaurantForm,
  validateRestaurantImage,
} from "@/features/owner/registration-rules";

const values = {
  ...emptyRestaurantForm,
  name: "  Bếp Nhà  ",
  phone: "02438262648",
  addressLine: "24 Nguyễn Hữu Huân",
  provinceName: "Thành phố Hà Nội",
  district: "Quận Hoàn Kiếm",
};
const location = { name: "Nhà hàng", latitude: 21.0285, longitude: 105.8542 };

describe("restaurant registration contract", () => {
  it("requires an explicitly selected location and all mandatory fields", () => {
    expect(validateRestaurantForm(emptyRestaurantForm, null)).toHaveProperty(
      "location",
    );
    expect(
      Object.keys(validateRestaurantForm(emptyRestaurantForm, null)),
    ).toEqual([
      "name",
      "phone",
      "addressLine",
      "provinceName",
      "district",
      "location",
    ]);
    expect(validateRestaurantForm(values, location)).toEqual({});
    expect(
      validateRestaurantForm(values, { ...location, latitude: NaN }),
    ).toHaveProperty("location");
    expect(
      validateRestaurantForm(values, { ...location, longitude: 181 }),
    ).toHaveProperty("location");
    expect(
      validateRestaurantForm(values, {
        ...location,
        latitude: 0,
        longitude: 0,
      }),
    ).toEqual({});
  });
  it("rejects unsupported website protocols and invalid optional values", () => {
    const errors = validateRestaurantForm(
      {
        ...values,
        name: "a".repeat(201),
        email: "wrong",
        website: "javascript:alert(1)",
        priceLevel: "5",
      },
      location,
    );
    expect(errors).toHaveProperty("name");
    expect(errors).toHaveProperty("email");
    expect(errors).toHaveProperty("website");
    expect(errors).toHaveProperty("priceLevel");
  });
  it("uses numeric media IDs and omits blank optional fields without copying a fixture", () => {
    const request = JSON.parse(
      JSON.stringify(buildRestaurantRequest(values, location, 9001, [9002])),
    );
    expect(request).toEqual({
      name: "Bếp Nhà",
      phone: values.phone,
      addressLine: values.addressLine,
      provinceName: values.provinceName,
      district: values.district,
      latitude: location.latitude,
      longitude: location.longitude,
      coverMediaId: 9001,
      imageMediaIds: [9002],
    });
    expect(request).not.toHaveProperty("verificationStatus");
    expect(request).not.toHaveProperty("ownerId");
  });
  it("keeps backend PascalCase field errors associated with the form and coordinates", () => {
    expect(
      restaurantFieldErrors({
        Name: ["Tên không hợp lệ"],
        Latitude: ["Bắt buộc"],
        imageMediaIds: ["Không phải ảnh của bạn"],
      }),
    ).toEqual({
      name: "Tên không hợp lệ",
      location: "Bắt buộc",
      imageMediaIds: "Không phải ảnh của bạn",
    });
  });
  it("enforces image type and the 5 MB boundary", () => {
    expect(
      validateRestaurantImage({ type: "image/png", size: 5 * 1024 * 1024 }),
    ).toBeNull();
    expect(
      validateRestaurantImage({ type: "image/png", size: 5 * 1024 * 1024 + 1 }),
    ).toContain("5 MB");
    expect(
      validateRestaurantImage({ type: "application/pdf", size: 200 }),
    ).not.toBeNull();
  });
  it("shows the district error on its field and surfaces only rules no control can show", () => {
    const fields = restaurantFieldErrors({
      Name: ["Tên chưa hợp lệ."],
      District: ["Quận/huyện là bắt buộc."],
      Slug: ["Tên đã được dùng."],
    });
    expect(fields.district).toBe("Quận/huyện là bắt buộc.");
    expect(hiddenFieldMessages(fields)).toBe("Tên đã được dùng.");
    expect(hiddenFieldMessages({ name: "Tên chưa hợp lệ." })).toBe("");
  });
});
