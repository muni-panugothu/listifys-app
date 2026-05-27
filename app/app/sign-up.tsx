import { Stack } from "@/lib/safe-router";

import { SignUpScreen } from "@/features/auth/screens/sign-up-screen";

export default function SignUpRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SignUpScreen />
    </>
  );
}
