import { Stack } from "expo-router";

import { OnboardingSlideTwoScreen } from "@/features/onboarding/screens/onboarding-slide-two-screen";

export default function OnboardingSlideTwoRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingSlideTwoScreen />
    </>
  );
}
