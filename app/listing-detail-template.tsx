import { Stack } from "expo-router";

import { ListingDetailTemplateScreen } from "@/features/listing/screens/listing-detail-template-screen";

export default function ListingDetailTemplateRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ListingDetailTemplateScreen />
    </>
  );
}
