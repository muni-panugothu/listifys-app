import { Stack } from "@/lib/safe-router";

import { JobDetailScreen } from "@/features/search/screens/job-detail-screen";

export default function JobDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <JobDetailScreen />
    </>
  );
}
