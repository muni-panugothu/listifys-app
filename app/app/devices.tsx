import { Stack } from "@/lib/safe-router";

import { DevicesScreen } from "../features/profile/screens/devices-screen";

export default function DevicesRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DevicesScreen />
    </>
  );
}
