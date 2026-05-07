import { Stack } from "expo-router";

import { NewPasswordScreen } from "@/features/auth/screens/new-password-screen";

export default function NewPasswordRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NewPasswordScreen />
    </>
  );
}
