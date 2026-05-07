import { Stack } from "expo-router";

import { ListingDraftSavedScreen } from "@/features/listing/screens/listing-draft-saved-screen";

export default function ListingDraftSavedRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ListingDraftSavedScreen />
    </>
  );
}
