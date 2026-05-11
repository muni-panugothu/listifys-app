import { Stack } from "@/lib/safe-router";

import { ProfileDetailsEditScreen } from "../features/profile/screens/profile-details-edit-screen";

export default function ProfileDetailsEditRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileDetailsEditScreen />
    </>
  );
}
