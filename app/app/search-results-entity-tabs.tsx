import { Stack } from "@/lib/safe-router";

import { SearchResultsEntityTabsScreen } from "@/features/search/screens/search-results-entity-tabs-screen";

export default function SearchResultsEntityTabsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SearchResultsEntityTabsScreen />
    </>
  );
}
