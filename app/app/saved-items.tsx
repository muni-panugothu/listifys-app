import { Stack } from "@/lib/safe-router";

import { SavedItemsScreen } from "@/features/search/screens/saved-items-screen";

export default function SavedItemsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SavedItemsScreen />
    </>
  );
}
