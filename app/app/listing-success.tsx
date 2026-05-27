import { Stack } from "@/lib/safe-router";

import { ListingSuccessScreen } from "@/features/listing/screens/listing-success-screen";

export default function ListingSuccessRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ListingSuccessScreen />
    </>
  );
}
