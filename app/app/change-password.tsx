import { Stack } from "expo-router";
import { ChangePasswordScreen } from "../features/profile/screens/change-password-screen";

export default function ChangePasswordRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ChangePasswordScreen />
    </>
  );
}
