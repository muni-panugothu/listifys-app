import { Stack } from "@/lib/safe-router";

import { SellEntryScreen } from "@/features/search/screens/sell-entry-screen";

export default function SellEntryRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SellEntryScreen />
    </>
  );
}
