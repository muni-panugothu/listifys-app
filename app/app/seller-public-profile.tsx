import { Stack } from "@/lib/safe-router";

import { SellerPublicProfileScreen } from "@/features/search/screens/seller-public-profile-screen";

export default function SellerPublicProfileRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SellerPublicProfileScreen />
    </>
  );
}
