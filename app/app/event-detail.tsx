import { Stack } from "expo-router";

import { EventDetailScreen } from "@/features/search/screens/event-detail-screen";

export default function EventDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <EventDetailScreen />
    </>
  );
}
