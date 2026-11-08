"use client";

import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ComponentProps,
} from "react";
import { Combobox } from "@/components/ui/primitives";
import { Button } from "@/shared/ui";
import {
  loadProvinceCatalog,
  getProvinceCatalog,
  initialProvinceCatalog,
  subscribeProvinceCatalog,
} from "@/shared/locations/province-service";

type ProvinceFieldProps = Omit<ComponentProps<typeof Combobox>, "options"> & {
  showCatalogStatus?: boolean;
};

/**
 * Address forms and location search share the same live province catalog. `strict` (the trip's
 * destination) only takes a province picked from the list; filters and address forms keep free
 * typing.
 */
export function ProvinceField({
  helper,
  showCatalogStatus = true,
  ...props
}: ProvinceFieldProps) {
  const guide =
    helper ??
    (props.strict
      ? "Gõ để tìm rồi chọn tỉnh / thành phố trong danh sách."
      : "Nhập tên đầy đủ hoặc chọn tỉnh/thành từ gợi ý.");
  const { items, status } = useSyncExternalStore(
    subscribeProvinceCatalog,
    getProvinceCatalog,
    () => initialProvinceCatalog,
  );
  const options = useMemo(() => items.map((item) => item.name), [items]);
  useEffect(() => {
    void loadProvinceCatalog().catch(() => {});
  }, []);
  const feedback =
    status === "loading"
      ? "Đang tải danh sách tỉnh/thành…"
      : status === "error"
        ? "Chưa tải được gợi ý tỉnh/thành. Bạn có thể nhập tên đầy đủ."
        : guide;
  return (
    <div className="province-field">
      <Combobox
        autoComplete="address-level1"
        placeholder={
          props.strict
            ? "Gõ để tìm tỉnh / thành phố"
            : "Nhập hoặc chọn tỉnh / thành phố"
        }
        {...props}
        options={options}
        helper={showCatalogStatus ? feedback : undefined}
      />
      {showCatalogStatus && status === "error" && (
        <Button
          variant="tertiary"
          onClick={() => {
            void loadProvinceCatalog().catch(() => {});
          }}
        >
          Tải lại danh sách tỉnh/thành
        </Button>
      )}
    </div>
  );
}
