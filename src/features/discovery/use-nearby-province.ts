"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchMapProvince } from "@/features/owner/restaurant-address-rules";
import { loadProvinceCatalog } from "@/shared/locations/province-service";
import type { Province } from "@/shared/locations/provinces";
import { reverseMapAddress } from "@/shared/maps/mapbox";

export type NearbyProvinceState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "resolving" }
  | { status: "found"; province: Province }
  | { status: "error"; message: string };

const unresolved =
  "Chưa xác định được tỉnh / thành từ vị trí của bạn. Bạn có thể thử lại hoặc chọn tỉnh / thành ở trang Món ăn.";

/**
 * The province the visitor is in: one browser geolocation read plus one Mapbox reverse lookup per
 * explicit request, matched against the live V2 province catalog. Coordinates are never stored.
 */
export function useNearbyProvince() {
  const [state, setState] = useState<NearbyProvinceState>({ status: "idle" });
  const revision = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      revision.current += 1;
      controller.current?.abort();
    },
    [],
  );
  const locate = useCallback(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    const current = ++revision.current;
    controller.current?.abort();
    controller.current = null;
    if (!navigator.geolocation) {
      setState({
        status: "error",
        message:
          "Trình duyệt của bạn không hỗ trợ lấy vị trí. Hãy chọn tỉnh / thành ở trang Món ăn.",
      });
      return;
    }
    if (!token?.startsWith("pk.")) {
      setState({ status: "error", message: unresolved });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (current !== revision.current) return;
        setState({ status: "resolving" });
        const abort = new AbortController();
        controller.current = abort;
        const point = {
          name: "Vị trí hiện tại",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        try {
          const [address, provinces] = await Promise.all([
            reverseMapAddress(
              point,
              token,
              AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]),
            ),
            loadProvinceCatalog(),
          ]);
          if (current !== revision.current) return;
          const province = address && matchMapProvince(address, provinces);
          setState(
            province
              ? { status: "found", province }
              : {
                  status: "error",
                  message:
                    "Vị trí của bạn chưa khớp với tỉnh / thành nào của Việt Nam. Bạn có thể chọn tỉnh / thành ở trang Món ăn.",
                },
          );
        } catch {
          if (current === revision.current)
            setState({ status: "error", message: unresolved });
        } finally {
          if (controller.current === abort) controller.current = null;
        }
      },
      (error) => {
        if (current !== revision.current) return;
        setState({
          status: "error",
          message:
            error.code === error.PERMISSION_DENIED
              ? "Bạn chưa cho phép ANGI xem vị trí. Hãy bật quyền vị trí cho trang này trong trình duyệt rồi thử lại."
              : "Không lấy được vị trí hiện tại. Hãy kiểm tra định vị của thiết bị rồi thử lại.",
        });
      },
      { timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);
  return { state, locate };
}
