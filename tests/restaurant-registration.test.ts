import { describe, expect, it } from "vitest";
import {
  buildRestaurantRequest,
  emptyRestaurantForm,
  restaurantFieldErrors,
  validateRestaurantForm,
  validateRestaurantImage,
} from "@/features/owner/registration-rules";
import { locationFromMapPoint } from "@/features/owner/location-service";
import { createMockRestaurantRegistrationService } from "@/mocks/restaurant-registration";

const values = {
  ...emptyRestaurantForm,
  name: "  Bếp Nhà  ",
  phone: "02438262648",
  addressLine: "24 Nguyễn Hữu Huân",
  provinceName: "Thành phố Hà Nội",
};
const location = { name: "Nhà hàng", latitude: 21.0285, longitude: 105.8542 };

describe("restaurant registration contract", () => {
  it("requires an explicitly selected location and all mandatory fields", () => {
    expect(validateRestaurantForm(emptyRestaurantForm, null)).toHaveProperty(
      "location",
    );
    expect(
      Object.keys(validateRestaurantForm(emptyRestaurantForm, null)),
    ).toEqual(["name", "phone", "addressLine", "provinceName", "location"]);
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
      latitude: location.latitude,
      longitude: location.longitude,
      coverMediaId: 9001,
      imageMediaIds: [9002],
    });
    expect(request).not.toHaveProperty("verificationStatus");
    expect(request).not.toHaveProperty("ownerId");
    expect(request).not.toHaveProperty("district");
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
  it("creates a coherent unverified wire response and refuses a second demo registration", async () => {
    const service = createMockRestaurantRegistrationService();
    const result = await service.register(
      buildRestaurantRequest(values, location),
    );
    expect(result).toMatchObject({
      name: "Bếp Nhà",
      id: 7,
      verificationStatus: "unverified",
      operatingStatus: "open",
      moderationStatus: "visible",
      ratingAvg: 0,
      ratingCount: 0,
      businessHours: [],
      latestVerification: null,
    });
    await expect(
      service.register(buildRestaurantRequest(values, location)),
    ).rejects.toMatchObject({
      status: 409,
      errorCode: "OWNER_ALREADY_HAS_RESTAURANT",
    });
  });
  it("maps the center to itself and map movement to the correct hemisphere", () => {
    expect(locationFromMapPoint(location, 14, 0, 0).latitude).toBeCloseTo(
      location.latitude,
    );
    expect(locationFromMapPoint(location, 14, 0, 0).longitude).toBeCloseTo(
      location.longitude,
    );
    const eastAndNorth = locationFromMapPoint(location, 14, 100, -100);
    expect(eastAndNorth.longitude).toBeGreaterThan(location.longitude);
    expect(eastAndNorth.latitude).toBeGreaterThan(location.latitude);
  });
});
