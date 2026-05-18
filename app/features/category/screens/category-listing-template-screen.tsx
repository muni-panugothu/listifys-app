import { useLocalSearchParams } from "@/lib/safe-router";

import { CategoryBrowseScreen } from "@/features/category/screens/category-browse-screen";
import type { CategorySlug } from "@/constants/categories";

export function CategoryListingTemplateScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const categorySlug = (params.category ?? "electronics") as CategorySlug;

  return <CategoryBrowseScreen categorySlug={categorySlug} />;
}
