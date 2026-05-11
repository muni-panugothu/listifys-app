import { Stack } from "@/lib/safe-router";

import { ServicesCategoryHubScreen } from "@/features/search/screens/services-category-hub-screen";

export default function ServicesCategoryHubRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ServicesCategoryHubScreen />
    </>
  );
}
