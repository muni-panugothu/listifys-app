import { Stack } from "@/lib/safe-router";

import { MobileAuthScreen } from "@/features/auth/screens/mobile-auth-screen";

export default function MobileAuthRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MobileAuthScreen />
    </>
  );
}
