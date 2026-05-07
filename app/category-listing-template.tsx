import { Stack } from "expo-router";

import { CategoryListingTemplateScreen } from "@/features/category/screens/category-listing-template-screen";

export default function CategoryListingTemplateRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CategoryListingTemplateScreen />
    </>
  );
}
