import { Stack } from "@/lib/safe-router";

import { PropertiesListingScreen } from "@/features/search/screens/properties-listing-screen";

export default function PropertiesListingRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PropertiesListingScreen />
    </>
  );
}
