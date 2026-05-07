import { Stack } from "expo-router";

import { EventsListingScreen } from "@/features/search/screens/events-listing-screen";

export default function EventsListingRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <EventsListingScreen />
    </>
  );
}
