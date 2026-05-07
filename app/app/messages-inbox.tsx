import { Stack } from "expo-router";

import { MessagesInboxScreen } from "../features/messaging/screens/messages-inbox-screen";

export default function MessagesInboxRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MessagesInboxScreen />
    </>
  );
}
