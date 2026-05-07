import { Stack } from "expo-router";

import { MyListingsActiveScreen } from "@/features/listing/screens/my-listings-active-screen";

export default function MyListingsActiveRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MyListingsActiveScreen />
    </>
  );
}
