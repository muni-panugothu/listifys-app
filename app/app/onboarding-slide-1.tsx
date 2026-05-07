import { OnboardingSlideOneScreen } from "@/features/onboarding/screens/onboarding-slide-one-screen";
import { Stack } from "expo-router";

export default function OnboardingSlideOneRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingSlideOneScreen />
    </>
  );
}
