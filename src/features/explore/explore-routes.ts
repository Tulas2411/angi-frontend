/** Public discovery routes (backed by the real DISH and REST operations). */
export const exploreRoutes = {
  dishes: "/dishes",
  restaurants: "/restaurants",
} as const;

export const dishHref = (dishId: number) => `${exploreRoutes.dishes}/${dishId}`;
export const restaurantHref = (restaurantId: number) =>
  `${exploreRoutes.restaurants}/${restaurantId}`;

/** The restaurant's "Đánh giá" tab, scrolled to one review when `reviewId` is given. */
export const restaurantReviewsHref = (
  restaurantId: number,
  reviewId?: number | null,
) =>
  `${restaurantHref(restaurantId)}?tab=reviews${reviewId ? `&review=${reviewId}` : ""}`;
