import { Stack } from "@/lib/safe-router";

import { SignInScreen } from "@/features/auth/screens/sign-in-screen";

export default function SignInRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SignInScreen />
    </>
  );
}
