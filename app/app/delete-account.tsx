import { Stack } from "@/lib/safe-router";

import { DeleteAccountScreen } from "@/features/profile/screens/delete-account-screen";

export default function DeleteAccountRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DeleteAccountScreen />
    </>
  );
}
