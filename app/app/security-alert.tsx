import { Stack } from "@/lib/safe-router";

import { SecurityAlertScreen } from "../features/profile/screens/security-alert-screen";

export default function SecurityAlertRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SecurityAlertScreen />
    </>
  );
}
