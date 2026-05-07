import { Stack } from "expo-router";

import { SecurityScreen } from "../features/profile/screens/security-screen";

export default function SecurityRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SecurityScreen />
    </>
  );
}
