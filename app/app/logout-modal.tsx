import { Stack } from "@/lib/safe-router";

import { LogoutModalScreen } from "../features/profile/screens/logout-modal-screen";

export default function LogoutModalRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: "transparentModal", animation: "fade" }} />
      <LogoutModalScreen />
    </>
  );
}
