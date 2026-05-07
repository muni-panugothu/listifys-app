import { Stack } from "expo-router";

import { ChatConversationScreen } from "../features/messaging/screens/chat-conversation-screen";

export default function ChatConversationRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ChatConversationScreen />
    </>
  );
}
