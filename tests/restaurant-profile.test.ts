import { describe, expect, it } from "vitest";
import {
  buildProfilePatch,
  profileFormFromRestaurant,
  profileToDemoView,
  validateProfilePatch,
} from "@/features/owner/profile-rules";
import { createMockRestaurantProfileService } from "@/mocks/restaurant-profile";
import { initialData } from "@/mocks/fixtures";
import { ownerRestaurantSample as original } from "./fixtures/owner-restaurant";

const values = profileFormFromRestaurant(original);
const location = {
  name: original.name,
  latitude: original.latitude,
  longitude: original.longitude,
};

describe("OWN-03 partial updates", () => {
  it("omits unchanged values and all independently managed data", () => {
    expect(buildProfilePatch(values, location, original)).toEqual({});
    const patch = buildProfilePatch(
      { ...values, name: "  Quán mới  " },
      location,
      original,
    );
    expect(patch).toEqual({ name: "Quán mới" });
    expect(patch).not.toHaveProperty("businessHours");
    expect(patch).not.toHaveProperty("verificationStatus");
    expect(patch).not.toHaveProperty("coverMediaId");
    expect(patch).not.toHaveProperty("imageMediaIds");
  });
  it("uses explicit null to clear optional fields while leaving other values untouched", () => {
    expect(
      buildProfilePatch(
        {
          ...values,
          email: " ",
          description: "",
          website: "",
          ward: "",
          priceLevel: "",
        },
        location,
        original,
      ),
    ).toEqual({
      email: null,
      description: null,
      website: null,
      ward: null,
      priceLevel: null,
    });
  });
  it("allows zero coordinates, rejects non-finite coordinates, and validates only edited fields", () => {
    const patch = buildProfilePatch(
      values,
      { ...location, latitude: 0, longitude: 0 },
      original,
    );
    expect(patch).toEqual({ latitude: 0, longitude: 0 });
    expect(validateProfilePatch(patch)).toEqual({});
    expect(validateProfilePatch({ latitude: NaN })).toHaveProperty("location");
    expect(validateProfilePatch({ longitude: 181 })).toHaveProperty("location");
    expect(validateProfilePatch({ description: "Mô tả mới" })).toEqual({});
    expect(
      validateProfilePatch({
        name: "",
        district: "",
        phone: "",
        website: "javascript:alert(1)",
        email: "bad",
        priceLevel: 5,
      }),
    ).toMatchObject({
      name: expect.any(String),
      district: expect.any(String),
      phone: expect.any(String),
      website: expect.any(String),
      email: expect.any(String),
      priceLevel: expect.any(String),
    });
  });
  it("uses numeric uploaded IDs and intentional null/empty-array media removal", () => {
    expect(
      buildProfilePatch(values, location, original, {
        coverMediaId: null,
        imageMediaIds: [],
      }),
    ).toEqual({ coverMediaId: null, imageMediaIds: [] });
    expect(
      buildProfilePatch(values, location, original, {
        coverMediaId: 9001,
        imageMediaIds: [9002],
      }),
    ).toEqual({ coverMediaId: 9001, imageMediaIds: [9002] });
    expect(
      validateProfilePatch({ imageMediaIds: [9001, 9001] }),
    ).toHaveProperty("imageMediaIds");
    expect(
      validateProfilePatch({
        imageMediaIds: Array.from({ length: 11 }, (_, index) => index + 1),
      }),
    ).toHaveProperty("imageMediaIds");
    expect(validateProfilePatch({ coverMediaId: 0 })).toHaveProperty(
      "coverMediaId",
    );
    expect(
      validateProfilePatch({ imageMediaIds: [], coverMediaId: null }),
    ).toEqual({});
  });
  it("keeps fixture IDs, statuses and related entities when publishing a saved profile", () => {
    const current = initialData.restaurants[0];
    const saved = profileToDemoView(current, {
      ...original,
      name: "Đã cập nhật",
      ward: "Phường mới",
    });
    expect(saved).toMatchObject({
      id: current.id,
      name: "Đã cập nhật",
      ward: "Phường mới",
      verification: current.verification,
      operating: current.operating,
      moderation: current.moderation,
    });
    expect(current.name).not.toBe("Đã cập nhật");
  });
  it("returns the saved wire state without losing read-only fields or exposing request-only keys", async () => {
    const service = createMockRestaurantProfileService(original);
    const result = await service.updateProfile({
      name: "  Quán mới  ",
      email: null,
      imageMediaIds: [],
    });
    expect(result).toMatchObject({
      name: "Quán mới",
      email: null,
      images: [],
      businessHours: original.businessHours,
      openMenuSubmission: original.openMenuSubmission,
      verificationStatus: "verified",
      operatingStatus: "open",
      moderationStatus: "visible",
    });
    expect(result).not.toHaveProperty("imageMediaIds");
    expect((await service.getOwnerRestaurant()).name).toBe("Quán mới");
    result.images.push("outside mutation");
    expect((await service.getOwnerRestaurant()).images).toEqual([]);
  });
  it("does not mutate the restaurant when validation or media ownership fails", async () => {
    const service = createMockRestaurantProfileService(original);
    await expect(service.updateProfile({ name: "" })).rejects.toMatchObject({
      errorCode: "VALIDATION_FAILED",
    });
    await expect(
      service.updateProfile({ name: "Quán mới", coverMediaId: 999 }),
    ).rejects.toMatchObject({
      errorCode: "VALIDATION_FAILED",
      errors: { coverMediaId: expect.any(Array) },
    });
    expect((await service.getOwnerRestaurant()).name).toBe(original.name);
  });
  it("reports missing owner data instead of substituting another fixture", async () => {
    const service = createMockRestaurantProfileService(null);
    await expect(service.getOwnerRestaurant()).rejects.toMatchObject({
      status: 404,
      errorCode: "RESTAURANT_NOT_FOUND",
    });
    await expect(
      service.updateProfile({ name: "Quán mới" }),
    ).rejects.toMatchObject({ errorCode: "RESTAURANT_NOT_FOUND" });
  });
});
