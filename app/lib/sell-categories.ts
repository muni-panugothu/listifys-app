import { CATEGORIES, type CategoryConfig } from "@/constants/categories";

/** All sell categories with "Others" always last. */
export const SELL_CATEGORIES_ORDERED: CategoryConfig[] = [
  ...CATEGORIES.filter((c) => c.slug !== "others"),
  ...CATEGORIES.filter((c) => c.slug === "others"),
];
