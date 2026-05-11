import { Stack } from "@/lib/safe-router";

import { PostAdStep3MediaScreen } from "@/features/sell/screens/post-ad-step3-media-screen";

export default function PostAdStep3MediaRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PostAdStep3MediaScreen />
    </>
  );
}
