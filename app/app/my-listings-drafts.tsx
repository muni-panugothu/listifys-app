import { Stack } from "@/lib/safe-router";

import { MyListingsDraftScreen } from "@/features/listing/screens/my-listings-draft-screen";

export default function MyListingsDraftsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MyListingsDraftScreen />
    </>
  );
}
