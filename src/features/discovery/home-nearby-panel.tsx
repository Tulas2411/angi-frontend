"use client";
import Link from "next/link";
import {
  dishFiltersHref,
  emptyDishFilters,
} from "@/features/explore/explore-rules";
import { exploreRoutes } from "@/features/explore/explore-routes";
import { Alert, Button } from "@/shared/ui";
import type { NearbyProvinceState } from "./use-nearby-province";

/** "Ăn quanh đây": confirms the detected province, then opens DISH-01 filtered to it. */
export function HomeNearbyPanel({
  state,
  onLocate,
}: {
  state: NearbyProvinceState;
  onLocate: () => void;
}) {
  const busy = state.status === "locating" || state.status === "resolving";
  return (
    <div className="home-nearby">
      <div className="home-nearby-status" aria-live="polite">
        {state.status === "found" ? (
          <>
            <p className="home-nearby-eyebrow">Bạn đang ở</p>
            <p className="home-nearby-place">{state.province.name}</p>
            <p>Bạn có muốn khám phá ẩm thực ở {state.province.name} không?</p>
          </>
        ) : busy ? (
          <p>
            {state.status === "locating"
              ? "Đang lấy vị trí của bạn…"
              : "Đang tìm tỉnh / thành bạn đang ở…"}
          </p>
        ) : state.status === "error" ? (
          <Alert>{state.message}</Alert>
        ) : (
          <p>Cho ANGI biết bạn đang ở đâu để gợi ý món ngon quanh bạn.</p>
        )}
      </div>
      <p className="home-quick-note">
        {state.status === "found" ? (
          <>
            Không đúng nơi bạn ở?{" "}
            <button
              type="button"
              className="home-nearby-retry"
              onClick={onLocate}
            >
              Lấy lại vị trí
            </button>{" "}
            hoặc <Link href={exploreRoutes.dishes}>chọn tỉnh / thành khác</Link>
            .
          </>
        ) : (
          "ANGI chỉ dùng vị trí để tìm tỉnh / thành bạn đang ở và không lưu lại."
        )}
      </p>
      {state.status === "found" ? (
        <Link
          href={dishFiltersHref({
            ...emptyDishFilters,
            province: state.province.name,
          })}
          className="button button-primary home-quick-submit"
        >
          Khám phá món ăn ở {state.province.name} <span aria-hidden>↗</span>
        </Link>
      ) : (
        <Button className="home-quick-submit" loading={busy} onClick={onLocate}>
          {state.status === "error" ? "Thử lại" : "Lấy vị trí của tôi"}
        </Button>
      )}
    </div>
  );
}
