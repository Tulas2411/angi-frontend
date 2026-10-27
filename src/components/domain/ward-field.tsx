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
  getWardCatalog,
  initialWardCatalog,
  loadWardCatalog,
  subscribeWardCatalog,
} from "@/shared/locations/ward-service";
import { provinceNameKey } from "@/shared/locations/provinces";

type WardFieldProps = Omit<ComponentProps<typeof Combobox>, "options"> & {
  provinceName: string;
};

/** Names stay editable; suggestions always belong to the current V2 province. */
export function WardField({ provinceName, ...props }: WardFieldProps) {
  const provinces = useSyncExternalStore(
    subscribeProvinceCatalog,
    getProvinceCatalog,
    () => initialProvinceCatalog,
  );
  const code = provinces.items.find(
    (province) =>
      provinceNameKey(province.name) === provinceNameKey(provinceName),
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
    void loadProvinceCatalog().catch(() => {});
  }, []);
  useEffect(() => {
    if (code !== undefined) void loadWardCatalog(code).catch(() => {});
  }, [code]);
  const helper =
    code === undefined
      ? "Chọn tỉnh/thành để xem gợi ý phường/xã. Bạn vẫn có thể nhập tên đầy đủ."
      : status === "loading"
        ? "Đang tải danh sách phường/xã…"
        : status === "error"
          ? "Chưa tải được gợi ý phường/xã. Bạn có thể nhập tên đầy đủ."
          : "Nhập hoặc chọn phường/xã trực thuộc tỉnh/thành đã chọn.";
  return (
    <div className="province-field">
      <Combobox
        autoComplete="address-level2"
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
