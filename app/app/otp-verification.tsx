import { Stack } from "@/lib/safe-router";

import { OtpVerificationScreen } from "@/features/auth/screens/otp-verification-screen";

export default function OtpVerificationRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <OtpVerificationScreen />
    </>
  );
}
