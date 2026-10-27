import type { RoleCode } from "@/features/auth/types";
import { exploreRoutes } from "@/features/explore/explore-routes";
import { ownerRoutes } from "@/features/owner/routes";
import { roadmapRoutes } from "@/features/roadmaps/routes";
import type { SiteNavItem } from "./site-nav";

export interface SiteNavigation {
  label: string;
  items: readonly SiteNavItem[];
}

/** Public discovery, open to guests and to every signed-in role. */
export const discoveryNav: readonly SiteNavItem[] = [
  { href: exploreRoutes.dishes, label: "Món ăn", match: "prefix" },
  { href: exploreRoutes.restaurants, label: "Quán ăn", match: "prefix" },
  { href: "/guides", label: "Cẩm nang", match: "prefix" },
];

/** Primary navigation of the header; the owner workspace has its own and no discovery. */
export function navigationFor(
  role: RoleCode | null,
): SiteNavigation | undefined {
  if (role === "RESTAURANT_OWNER")
    return {
      label: "Điều hướng nhà hàng",
      items: [
        { href: ownerRoutes.overview, label: "Tổng quan", match: "exact" },
        { href: ownerRoutes.profile, label: "Nhà hàng", match: "prefix" },
        { href: ownerRoutes.verification, label: "Xác minh", match: "prefix" },
        { href: ownerRoutes.menu, label: "Thực đơn", match: "prefix" },
      ],
    };
  if (role === "TRAVELER")
    return {
      label: "Điều hướng chính",
      items: [
        ...discoveryNav,
        { href: roadmapRoutes.list, label: "Lộ trình của tôi", match: "exact" },
        { href: roadmapRoutes.plan, label: "Lập lộ trình", match: "exact" },
      ],
    };
  if (role === null) return { label: "Điều hướng chính", items: discoveryNav };
  return undefined;
}
