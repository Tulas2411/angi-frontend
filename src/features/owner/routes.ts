/** Routes of the Restaurant Owner workspace. */
export const ownerRoutes = {
  overview: "/restaurant",
  register: "/restaurant/register",
  profile: "/restaurant/profile",
  verification: "/restaurant/verification",
  menu: "/restaurant/menu",
  reviews: "/restaurant/reviews",
} as const;

export type OwnerProfileTab = "information" | "photos" | "hours" | "status";

export const ownerProfileHref = (tab: OwnerProfileTab = "information") =>
  tab === "information"
    ? ownerRoutes.profile
    : `${ownerRoutes.profile}?tab=${tab}`;
export const ownerVerificationHref = (tab?: "status") =>
  tab ? `${ownerRoutes.verification}?tab=${tab}` : ownerRoutes.verification;
