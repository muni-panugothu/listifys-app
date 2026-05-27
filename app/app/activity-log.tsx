import { Stack } from "@/lib/safe-router";

import { ActivityLogScreen } from "../features/profile/screens/activity-log-screen";

export default function ActivityLogRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityLogScreen />
    </>
  );
}
