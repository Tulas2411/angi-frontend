import { clsx, type ClassValue } from "clsx";

/** shadcn's class joiner. ANGI styles come from its own CSS classes, so no Tailwind merge is needed. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
