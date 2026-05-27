import { Stack } from "@/lib/safe-router";

import { NearbyMapViewBottomSheetScreen } from "@/features/search/screens/nearby-map-view-bottom-sheet-screen";

export default function NearbyMapViewBottomSheetRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NearbyMapViewBottomSheetScreen />
    </>
  );
}
