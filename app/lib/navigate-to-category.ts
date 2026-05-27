import type { CategorySlug } from "@/constants/categories";
import type { Href } from "@/lib/safe-router";

/** Every category uses the unified browse UI with its own subcategory chips. */
export function getCategoryHref(catId: CategorySlug): Href {
  return `/category-listing-template?category=${catId}` as Href;
}
