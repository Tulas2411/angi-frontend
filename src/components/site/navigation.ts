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

/**
 * Header of the homepage and every Traveler page, in the order the owner chose. Guests see the
 * same items; the Traveler-only targets send them to sign in.
 */
export const travelerNav: readonly SiteNavItem[] = [
  {
    href: roadmapRoutes.start,
    label: "Lộ trình",
    match: "prefix",
    matchHref: roadmapRoutes.list,
  },
  { href: "/roll", label: "Hôm nay ăn gì?", match: "exact" },
  ...discoveryNav,
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
  if (role === "TRAVELER" || role === null)
    return { label: "Điều hướng chính", items: travelerNav };
  return undefined;
}
