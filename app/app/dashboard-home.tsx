import { Stack } from "@/lib/safe-router";

import { DashboardHomeScreen } from "../features/profile/screens/dashboard-home-screen";

export default function DashboardHomeRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DashboardHomeScreen />
    </>
  );
}
