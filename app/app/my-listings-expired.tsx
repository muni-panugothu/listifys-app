import { Stack } from "@/lib/safe-router";

import { MyListingsExpiredScreen } from "@/features/listing/screens/my-listings-expired-screen";

export default function MyListingsExpiredRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MyListingsExpiredScreen />
    </>
  );
}
