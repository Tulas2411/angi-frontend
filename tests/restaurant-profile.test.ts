import { describe, expect, it } from "vitest";
import {
  buildProfilePatch,
  profileFormFromRestaurant,
  validateProfilePatch,
} from "@/features/owner/profile-rules";
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
      phone: expect.any(String),
      website: expect.any(String),
      email: expect.any(String),
      priceLevel: expect.any(String),
    });
  });
  it("sends the district like the other address fields: only when it changes, null when emptied", () => {
    expect(
      buildProfilePatch(
        { ...values, ward: "Phường Hải Châu" },
        location,
        original,
      ),
    ).toEqual({ ward: "Phường Hải Châu" });
    expect(
      buildProfilePatch(
        { ...values, district: "Quận Thanh Khê" },
        location,
        original,
      ),
    ).toEqual({ district: "Quận Thanh Khê" });
    expect(
      buildProfilePatch({ ...values, district: " " }, location, original),
    ).toEqual({ district: null });
    expect(validateProfilePatch({ district: null })).toEqual({});
    expect(validateProfilePatch({ district: "a".repeat(101) })).toEqual({
      district: "Quận / huyện không được vượt quá 100 ký tự.",
    });
    expect(
      buildProfilePatch({ ...values, name: "Quán A" }, location, original),
    ).not.toHaveProperty("district");
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
});
