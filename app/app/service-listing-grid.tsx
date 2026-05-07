import { Stack } from "expo-router";

import { ServiceListingGridScreen } from "@/features/search/screens/service-listing-grid-screen";

export default function ServiceListingGridRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ServiceListingGridScreen />
    </>
  );
}
