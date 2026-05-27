import { Stack } from "@/lib/safe-router";

import { ForgotPasswordScreen } from "@/features/auth/screens/forgot-password-screen";

export default function ForgotPasswordRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ForgotPasswordScreen />
    </>
  );
}
