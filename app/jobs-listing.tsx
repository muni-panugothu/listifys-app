import { Stack } from "expo-router";

import { JobsListingScreen } from "@/features/search/screens/jobs-listing-screen";

export default function JobsListingRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <JobsListingScreen />
    </>
  );
}
