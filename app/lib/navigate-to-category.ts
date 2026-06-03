import type { CategorySlug } from "@/constants/categories";
import type { Href } from "@/lib/safe-router";

/** Every category uses the unified browse UI with its own subcategory chips.
 * Exception: 'services' routes to the dedicated Services hub screen. */
export function getCategoryHref(catId: CategorySlug): Href {
  if (catId === "services") {
    return "/services-category-hub" as Href;
  }
  return `/category-listing-template?category=${catId}` as Href;
}
