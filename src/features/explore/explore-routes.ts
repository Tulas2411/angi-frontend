/** Public discovery routes (backed by the real DISH and REST operations). */
export const exploreRoutes = {
  dishes: "/dishes",
  restaurants: "/restaurants",
} as const;

export const dishHref = (dishId: number) => `${exploreRoutes.dishes}/${dishId}`;
export const restaurantHref = (restaurantId: number) =>
  `${exploreRoutes.restaurants}/${restaurantId}`;
