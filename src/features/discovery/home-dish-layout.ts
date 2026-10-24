import type { HomeDish } from "./home-content";

export interface DishPhoto {
  dish: HomeDish;
  angle: number;
  layer: number;
  size: number;
}

function shuffledCopy<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

/** Called on the server after the route's session read; serialized once for hydration. */
export function createDishPhotos(
  dishes: readonly HomeDish[],
  random: () => number = Math.random,
): DishPhoto[] {
  const shuffled = shuffledCopy(dishes, random);
  // Spread sizes across the range, then shuffle independently of depth and dish.
  // This guarantees a visibly varied composition even if random draws are similar.
  const sizes = shuffledCopy(
    dishes.map((_, index) =>
      dishes.length === 1 ? 1 : 0.78 + (index / (dishes.length - 1)) * 0.3,
    ),
    random,
  );
  // Alternating depth keeps exposed edges on both sides of the composition.
  const depths = [2, 4, 1, 3, 6, 8, 5, 7];
  return shuffled.map((dish, index) => ({
    dish,
    angle: Math.round((random() * 16 - 8) * 10) / 10,
    layer: shuffled.length === 1 ? 8 : depths[index % depths.length],
    size:
      shuffled.length === 1
        ? 1
        : Math.round(
            Math.min(
              1.08,
              Math.max(0.78, sizes[index] + (random() - 0.5) * 0.02),
            ) * 1000,
          ) / 1000,
  }));
}
