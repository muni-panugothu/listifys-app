import { Stack } from "expo-router";

import { ResetOtpVerificationScreen } from "@/features/auth/screens/reset-otp-verification-screen";

export default function ResetOtpVerificationRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ResetOtpVerificationScreen />
    </>
  );
}
