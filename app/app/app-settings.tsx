import { Stack } from "@/lib/safe-router";

import { SettingsScreen } from "../features/profile/screens/settings-screen";

export default function AppSettingsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsScreen />
    </>
  );
}
