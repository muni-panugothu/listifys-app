import { usePathname, useRouter } from "@/lib/safe-router";
import { useCallback } from "react";

const TAB_ROUTES: Record<string, string> = {
  home: "/home-feed-root",
  sell: "/sell-entry",
  search: "/search-home",
  messages: "/messages-inbox",
  profile: "/dashboard-home",
};

/**
 * Shared bottom-tab navigation handler.
 * Uses `router.replace` to avoid stacking duplicate screens
 * and guards against navigating to the current route.
 */
export function useTabNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  const handleTabPress = useCallback(
    (tabId: string) => {
      const target = TAB_ROUTES[tabId];
      if (!target) return;

      // Already on this screen — do nothing
      if (pathname === target) return;

      router.replace(target as any);
    },
    [router, pathname],
  );

  return handleTabPress;
}
