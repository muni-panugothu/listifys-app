import { Stack } from "@/lib/safe-router";

import { NotificationsCenterScreen } from "../features/profile/screens/notifications-center-screen";

export default function NotificationsCenterRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NotificationsCenterScreen />
    </>
  );
}
