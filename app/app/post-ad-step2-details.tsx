import { Stack } from "expo-router";

import { PostAdStep2DetailsScreen } from "@/features/sell/screens/post-ad-step2-details-screen";

export default function PostAdStep2DetailsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PostAdStep2DetailsScreen />
    </>
  );
}
