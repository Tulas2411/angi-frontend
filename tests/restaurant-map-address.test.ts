import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readMapAddress, type MapLocation } from "@/shared/maps/mapbox";
import { loadProvinceCatalog } from "@/shared/locations/province-service";
import {
  loadDistrictCatalog,
  loadWardCatalog,
} from "@/shared/locations/ward-service";
import {
  matchMapDistrict,
  matchMapProvince,
  matchMapWard,
} from "@/features/owner/restaurant-address-rules";
import { fillRestaurantFromPlace } from "@/features/owner/restaurant-location-rules";
import { resolveRestaurantAddress } from "@/features/owner/location-service";
import {
  buildRestaurantRequest,
  emptyRestaurantForm,
} from "@/features/owner/registration-rules";
import {
  buildProfilePatch,
  profileFormFromRestaurant,
} from "@/features/owner/profile-rules";
import { ownerRestaurantSample } from "./fixtures/owner-restaurant";

vi.mock("@/shared/locations/province-service", () => ({
  loadProvinceCatalog: vi.fn(),
}));
vi.mock("@/shared/locations/ward-service", () => ({
  loadDistrictCatalog: vi.fn(),
  loadWardCatalog: vi.fn(),
}));

const provinces = [{ code: 1, name: "Thành phố Hà Nội" }];
const districts = [
  { code: 2, name: "Quận Hoàn Kiếm" },
  { code: 1, name: "Quận Ba Đình" },
];
const wards = [{ code: 37, name: "Phường Hàng Bạc" }];
const pin: MapLocation = {
  name: "Vị trí đã chọn",
  latitude: 21.028501,
  longitude: 105.854201,
};
const feature = (featureType: string, name: string, context: object = {}) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [105.8543, 21.0286] },
  properties: { feature_type: featureType, name, context },
});
const address = feature("address", "12 Hàng Bạc", {
  address: {
    name: "12 Hàng Bạc",
    address_number: "12",
    street_name: "Hàng Bạc",
  },
  region: { name: "Hà Nội" },
  place: { name: "Quận Hoàn Kiếm" },
  locality: { name: "Hàng Bạc" },
  country: { country_code: "VN" },
});
const payload = { features: [feature("region", "Hà Nội"), address] };

beforeEach(() => {
  vi.mocked(loadProvinceCatalog).mockReset().mockResolvedValue(provinces);
  vi.mocked(loadDistrictCatalog).mockReset().mockResolvedValue(districts);
  vi.mocked(loadWardCatalog).mockReset().mockResolvedValue(wards);
});
afterEach(() => vi.unstubAllGlobals());

describe("Owner map address prefilling (offline fixtures only)", () => {
  it("prefers the street/house number, keeps exact user coordinates and parses V6 context", () => {
    expect(readMapAddress(payload, pin)).toMatchObject({
      ...pin,
      address: "12 Hàng Bạc",
      addressContext: {
        region: "Hà Nội",
        place: "Quận Hoàn Kiếm",
        locality: "Hàng Bạc",
        countryCode: "vn",
      },
    });
    expect(
      readMapAddress({ features: [feature("region", "Hà Nội")] }, pin)?.address,
    ).toBeUndefined();
    expect(readMapAddress({ features: [] }, pin)).toBeNull();
    expect(() => readMapAddress({}, pin)).toThrow();
    expect(
      readMapAddress(
        {
          features: [
            feature("address", "Foreign", { country: { country_code: "us" } }),
          ],
        },
        pin,
      ),
    ).toBeNull();
  });
  it("matches V1 province, district and ward names without promoting a district to a ward", () => {
    const point = readMapAddress(payload, pin)!;
    expect(matchMapProvince(point, provinces)).toEqual(provinces[0]);
    expect(matchMapDistrict(point, districts)).toEqual(districts[0]);
    expect(
      matchMapDistrict(
        { ...pin, fullAddress: "12 Hàng Bạc, Hoàn Kiếm, Hà Nội" },
        districts,
      ),
    ).toBeUndefined();
    expect(
      matchMapDistrict(
        { ...pin, fullAddress: "1 Điện Biên Phủ, Quận Ba Đình, Hà Nội" },
        districts,
      ),
    ).toEqual(districts[1]);
    expect(matchMapWard(point, wards)).toEqual(wards[0]);
    expect(
      matchMapWard(
        { ...pin, addressContext: { locality: "Quận Hoàn Kiếm" } },
        wards,
      ),
    ).toBeUndefined();
    expect(
      matchMapProvince(
        { ...pin, addressContext: { region: "Tỉnh không còn trong danh mục" } },
        provinces,
      ),
    ).toBeUndefined();
    expect(
      matchMapWard({ ...pin, addressContext: { locality: "Hoa Binh" } }, [
        { code: 2, name: "Phường Hòa Bình" },
        { code: 3, name: "Xã Hòa Bình" },
      ]),
    ).toBeUndefined();
    expect(
      matchMapWard({ ...pin, addressContext: { locality: "Xa Hoa Binh" } }, [
        { code: 2, name: "Phường Hòa Bình" },
        { code: 3, name: "Xã Hòa Bình" },
      ])?.code,
    ).toBe(3);
  });
  it("replaces the old address after saving a new pin, preserves unrelated fields and sends only owner DTO keys", () => {
    const values = {
      ...emptyRestaurantForm,
      name: "Quán của tôi",
      phone: "0901234567",
      addressLine: "Địa chỉ cũ",
      provinceName: "Thành phố Đà Nẵng",
      ward: "Phường cũ",
    };
    const selected = {
      ...pin,
      address: "12 Hàng Bạc",
      addressDetails: {
        provinceName: provinces[0].name,
        district: districts[0].name,
        ward: wards[0].name,
      },
    };
    const next = fillRestaurantFromPlace(values, selected);
    expect(next).toMatchObject({
      name: values.name,
      phone: values.phone,
      addressLine: selected.address,
      ...selected.addressDetails,
    });
    const request = buildRestaurantRequest(next, selected);
    expect(request).toMatchObject({
      addressLine: selected.address,
      ...selected.addressDetails,
      latitude: pin.latitude,
      longitude: pin.longitude,
    });
    expect(request).not.toHaveProperty("addressDetails");
    expect(request).not.toHaveProperty("addressContext");
    const profile = fillRestaurantFromPlace(
      profileFormFromRestaurant(ownerRestaurantSample),
      selected,
    );
    expect(buildProfilePatch(profile, selected, ownerRestaurantSample)).toEqual(
      {
        addressLine: selected.address,
        ...selected.addressDetails,
        latitude: pin.latitude,
        longitude: pin.longitude,
      },
    );
    expect(fillRestaurantFromPlace(values, pin)).toEqual(values);
  });
  it("looks up only on explicit save, requests a storable Vietnamese address and resolves ward under its province", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal("fetch", fetcher);
    const point = await resolveRestaurantAddress(
      pin,
      "pk.offline-fixture",
      new AbortController().signal,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.pathname).toBe("/search/geocode/v6/reverse");
    expect(url.searchParams.get("latitude")).toBe(String(pin.latitude));
    expect(url.searchParams.get("longitude")).toBe(String(pin.longitude));
    expect(url.searchParams.get("permanent")).toBe("true");
    expect(url.searchParams.get("language")).toBe("vi");
    expect(point.addressDetails).toEqual({
      provinceName: provinces[0].name,
      district: districts[0].name,
      ward: wards[0].name,
    });
    // Districts of the province, then wards of the district (V1 codes).
    expect(loadDistrictCatalog).toHaveBeenCalledWith(1);
    expect(loadWardCatalog).toHaveBeenCalledWith(2);
    await resolveRestaurantAddress(
      point,
      "pk.offline-fixture",
      new AbortController().signal,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("keeps coordinates and explains missing provider/catalog data; missing wards never retain an old ward", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal("fetch", fetcher);
    vi.mocked(loadWardCatalog).mockRejectedValue(new Error("offline"));
    const partial = await resolveRestaurantAddress(
      pin,
      "pk.offline-fixture",
      new AbortController().signal,
    );
    expect(partial.address).toBe("12 Hàng Bạc");
    expect(partial.addressDetails).toEqual({
      provinceName: provinces[0].name,
      district: districts[0].name,
      ward: "",
    });
    expect(partial.addressNotice).toBeTruthy();
    fetcher.mockRejectedValue(new Error("offline"));
    const failed = await resolveRestaurantAddress(
      pin,
      "pk.offline-fixture",
      new AbortController().signal,
    );
    expect(failed).toMatchObject(pin);
    expect(failed.addressNotice).toContain("Chưa tự lấy được địa chỉ");
  });
  it("never calls Mapbox without a token and ignores a result after the owner closes or changes selection", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await resolveRestaurantAddress(
      pin,
      undefined,
      new AbortController().signal,
    );
    expect(fetcher).not.toHaveBeenCalled();
    let finish!: (response: Response) => void;
    fetcher.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const controller = new AbortController();
    const pending = resolveRestaurantAddress(
      pin,
      "pk.offline-fixture",
      controller.signal,
    );
    controller.abort();
    finish(Response.json(payload));
    await expect(pending).rejects.toThrow();
    expect(loadProvinceCatalog).not.toHaveBeenCalled();
  });
});
