import { Stack } from "expo-router";

import { HomeFeedRootScreen } from "@/features/home/screens/home-feed-root-screen";

export default function HomeFeedRootRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeFeedRootScreen />
    </>
  );
}
