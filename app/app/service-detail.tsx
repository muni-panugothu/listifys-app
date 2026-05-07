import { Stack } from "expo-router";

import { ServiceDetailScreen } from "@/features/search/screens/service-detail-screen";

export default function ServiceDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ServiceDetailScreen />
    </>
  );
}
