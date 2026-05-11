import { Stack } from "@/lib/safe-router";

import { CreateOfferModalScreen } from "@/features/listing/screens/create-offer-modal-screen";

export default function CreateOfferModalRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: "transparentModal", animation: "slide_from_bottom" }} />
      <CreateOfferModalScreen />
    </>
  );
}
