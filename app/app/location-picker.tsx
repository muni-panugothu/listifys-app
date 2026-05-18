import { Stack } from "@/lib/safe-router";

import { LocationPickerScreen } from "@/features/location/screens/location-picker-screen";

export default function LocationPickerRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LocationPickerScreen />
    </>
  );
}
