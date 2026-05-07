import { Stack } from "expo-router";

import { PropertyDetailScreen } from "@/features/search/screens/property-detail-screen";

export default function PropertyDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PropertyDetailScreen />
    </>
  );
}
