"use client";

import {
  useCallback,
  useEffect,
  useSyncExternalStore,
  type ComponentProps,
} from "react";
import { Combobox } from "@/components/ui/primitives";
import { Button } from "@/shared/ui";
import {
  getProvinceCatalog,
  initialProvinceCatalog,
  loadProvinceCatalog,
  subscribeProvinceCatalog,
} from "@/shared/locations/province-service";
import {
  getDistrictCatalog,
  getWardCatalog,
  initialWardCatalog,
  loadDistrictCatalog,
  loadWardCatalog,
  subscribeDistrictCatalog,
  subscribeWardCatalog,
} from "@/shared/locations/ward-service";
import { districtNameKey, provinceNameKey } from "@/shared/locations/provinces";

type AreaFieldProps = Omit<ComponentProps<typeof Combobox>, "options">;

/** The V1 code of the typed province, once the catalog has it. */
function useProvinceCode(provinceName: string) {
  const provinces = useSyncExternalStore(
    subscribeProvinceCatalog,
    getProvinceCatalog,
    () => initialProvinceCatalog,
  );
  useEffect(() => {
    void loadProvinceCatalog().catch(() => {});
  }, []);
  return provinces.items.find(
    (province) =>
      provinceNameKey(province.name) === provinceNameKey(provinceName),
  )?.code;
}

/** The districts of the typed province (loaded on demand). */
function useDistricts(provinceCode: number | undefined) {
  const state = useSyncExternalStore(
    useCallback(
      (listener: () => void) =>
        subscribeDistrictCatalog(provinceCode, listener),
      [provinceCode],
    ),
    useCallback(() => getDistrictCatalog(provinceCode), [provinceCode]),
    () => initialWardCatalog,
  );
  useEffect(() => {
    if (provinceCode !== undefined)
      void loadDistrictCatalog(provinceCode).catch(() => {});
  }, [provinceCode]);
  return state;
}

/** Names stay editable; suggestions always belong to the current province. */
export function DistrictField({
  provinceName,
  ...props
}: AreaFieldProps & { provinceName: string }) {
  const code = useProvinceCode(provinceName);
  const { items, status } = useDistricts(code);
  const helper =
    code === undefined
      ? "Chọn tỉnh/thành để xem gợi ý quận/huyện. Bạn vẫn có thể nhập tên đầy đủ."
      : status === "loading"
        ? "Đang tải danh sách quận/huyện…"
        : status === "error"
          ? "Chưa tải được gợi ý quận/huyện. Bạn có thể nhập tên đầy đủ."
          : "Nhập hoặc chọn quận/huyện thuộc tỉnh/thành đã chọn.";
  return (
    <div className="province-field">
      <Combobox
        autoComplete="address-level2"
        placeholder="Nhập hoặc chọn quận / huyện"
        {...props}
        options={items.map((item) => item.name)}
        helper={helper}
      />
      {code !== undefined && status === "error" && (
        <Button
          variant="tertiary"
          onClick={() => void loadDistrictCatalog(code).catch(() => {})}
        >
          Tải lại danh sách quận/huyện
        </Button>
      )}
    </div>
  );
}

/** Names stay editable; suggestions always belong to the current district. */
export function WardField({
  provinceName,
  districtName,
  ...props
}: AreaFieldProps & { provinceName: string; districtName: string }) {
  const provinceCode = useProvinceCode(provinceName);
  const districts = useDistricts(provinceCode);
  const code = districts.items.find(
    (district) =>
      districtNameKey(district.name) === districtNameKey(districtName),
  )?.code;
  const { items, status } = useSyncExternalStore(
    useCallback(
      (listener: () => void) => subscribeWardCatalog(code, listener),
      [code],
    ),
    useCallback(() => getWardCatalog(code), [code]),
    () => initialWardCatalog,
  );
  useEffect(() => {
    if (code !== undefined) void loadWardCatalog(code).catch(() => {});
  }, [code]);
  const helper =
    code === undefined
      ? "Chọn quận/huyện để xem gợi ý phường/xã. Bạn vẫn có thể nhập tên đầy đủ."
      : status === "loading"
        ? "Đang tải danh sách phường/xã…"
        : status === "error"
          ? "Chưa tải được gợi ý phường/xã. Bạn có thể nhập tên đầy đủ."
          : "Nhập hoặc chọn phường/xã thuộc quận/huyện đã chọn.";
  return (
    <div className="province-field">
      <Combobox
        autoComplete="address-level3"
        placeholder="Nhập hoặc chọn phường / xã"
        {...props}
        options={items.map((item) => item.name)}
        helper={helper}
      />
      {code !== undefined && status === "error" && (
        <Button
          variant="tertiary"
          onClick={() => void loadWardCatalog(code).catch(() => {})}
        >
          Tải lại danh sách phường/xã
        </Button>
      )}
    </div>
  );
}
