import { Stack } from "expo-router";

import { FollowersFollowingScreen } from "../features/profile/screens/followers-following-screen";

export default function FollowersFollowingRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FollowersFollowingScreen />
    </>
  );
}
