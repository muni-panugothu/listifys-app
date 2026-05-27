import { Stack } from "@/lib/safe-router";

import { EditListingScreen } from "@/features/listing/screens/edit-listing-screen";

export default function EditListingRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <EditListingScreen />
    </>
  );
}
