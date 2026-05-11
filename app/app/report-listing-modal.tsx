import { Stack } from "@/lib/safe-router";

import { ReportListingModalScreen } from "@/features/listing/screens/report-listing-modal-screen";

export default function ReportListingModalRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: "transparentModal", animation: "slide_from_bottom" }} />
      <ReportListingModalScreen />
    </>
  );
}
