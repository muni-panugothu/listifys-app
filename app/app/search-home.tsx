import { Stack } from "expo-router";

import { SearchHomeScreen } from "@/features/search/screens/search-home-screen";

export default function SearchHomeRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SearchHomeScreen />
    </>
  );
}
