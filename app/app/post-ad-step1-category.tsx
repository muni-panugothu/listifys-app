import { Stack } from "expo-router";

import { PostAdStep1CategoryScreen } from "@/features/sell/screens/post-ad-step1-category-screen";

export default function PostAdStep1CategoryRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PostAdStep1CategoryScreen />
    </>
  );
}
