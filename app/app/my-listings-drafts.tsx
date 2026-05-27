import { Stack } from "@/lib/safe-router";

import { MyListingsScreen } from "@/features/listing/screens/my-listings-screen";

export default function MyListingsDraftsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MyListingsScreen initialTab="Drafts" />
    </>
  );
}
