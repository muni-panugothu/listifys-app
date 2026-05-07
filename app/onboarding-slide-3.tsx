import { Stack } from "expo-router";

import { OnboardingSlideThreeScreen } from "@/features/onboarding/screens/onboarding-slide-three-screen";

export default function OnboardingSlideThreeRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingSlideThreeScreen />
    </>
  );
}
