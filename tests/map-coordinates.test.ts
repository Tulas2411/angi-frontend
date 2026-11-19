import { describe, expect, it } from "vitest";
import { coordinatesLabel, parseCoordinates } from "@/shared/maps/coordinates";

/** What the map search box accepts as a position instead of a place to look up. */
describe("coordinates pasted into the map search", () => {
  const hoaLac = { latitude: 21.027651, longitude: 105.533428 };
  const near = (value: { latitude: number; longitude: number } | null) => {
    expect(value).not.toBeNull();
    expect(value!.latitude).toBeCloseTo(hoaLac.latitude, 4);
    expect(value!.longitude).toBeCloseTo(hoaLac.longitude, 4);
  };

  it("reads decimal degrees with a comma, a space or a semicolon", () => {
    expect(parseCoordinates("21.027651, 105.533428")).toEqual(hoaLac);
    expect(parseCoordinates(" 21.027651 105.533428 ")).toEqual(hoaLac);
    expect(parseCoordinates("21.027651;105.533428")).toEqual(hoaLac);
    expect(parseCoordinates("-33.8688, 151.2093")).toEqual({
      latitude: -33.8688,
      longitude: 151.2093,
    });
  });

  it("reads Google Maps degrees-minutes-seconds and decimal minutes", () => {
    near(parseCoordinates(`21°01'39.5"N 105°32'00.3"E`));
    near(parseCoordinates(`21° 01′ 39.5″ N, 105° 32′ 00.3″ E`));
    near(parseCoordinates(`21°01.659'N 105°32.006'E`));
  });

  it("uses the hemisphere letters for the sign and the order", () => {
    expect(parseCoordinates("33.8688 S, 151.2093 E")).toEqual({
      latitude: -33.8688,
      longitude: 151.2093,
    });
    near(parseCoordinates("E 105.533428, N 21.027651"));
    expect(parseCoordinates("40.7128N 74.0060W")).toEqual({
      latitude: 40.7128,
      longitude: -74.006,
    });
  });

  it("leaves addresses, place names and out-of-range pairs to the text search", () => {
    expect(parseCoordinates("Phố Lê Lai, Hoàn Kiếm")).toBeNull();
    expect(parseCoordinates("12 Lê Lợi")).toBeNull();
    expect(parseCoordinates("21 105")).toBeNull();
    expect(parseCoordinates("91.0, 105.5")).toBeNull();
    expect(parseCoordinates("21.0, 181.5")).toBeNull();
    expect(parseCoordinates(`21°61'00"N 105°32'00"E`)).toBeNull();
    expect(parseCoordinates("")).toBeNull();
  });

  it("names a picked pair by its coordinates", () => {
    expect(coordinatesLabel(hoaLac)).toBe("21.027651, 105.533428");
  });
});
