import { usePathname, useRouter } from "@/lib/safe-router";
import { useCallback, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showAuthGate, type AuthGateAction } from "@/store/slices/auth-gate-slice";

const TAB_ROUTES: Record<string, string> = {
  home: "/home-feed-root",
  sell: "/sell-entry",
  search: "/search-home",
  messages: "/messages-inbox",
  profile: "/dashboard-home",
};

const AUTH_GATED_TABS: Partial<Record<string, AuthGateAction>> = {
  sell: "sell",
  messages: "message",
  profile: "profile",
};

/**
 * Shared bottom-tab navigation handler.
 * Uses `router.replace` to avoid stacking duplicate screens
 * and guards against navigating to the current route.
 */
export function useTabNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const lastNavigationRef = useRef<{ target: string; timestamp: number } | null>(null);

  const handleTabPress = useCallback(
    (tabId: string) => {
      const target = TAB_ROUTES[tabId];
      if (!target) return;

      // Already on this screen — do nothing
      if (pathname === target) return;

      // Ignore rapid repeated presses for the same target before navigation settles.
      const now = Date.now();
      const lastNavigation = lastNavigationRef.current;
      if (
        lastNavigation &&
        lastNavigation.target === target &&
        now - lastNavigation.timestamp < 800
      ) {
        return;
      }

      const authGateAction = AUTH_GATED_TABS[tabId];
      if (authGateAction && !isAuthenticated) {
        dispatch(showAuthGate({ action: authGateAction, redirectTo: target }));
        return;
      }

      lastNavigationRef.current = { target, timestamp: now };
      router.replace(target as any);
    },
    [dispatch, isAuthenticated, pathname, router],
  );

  return handleTabPress;
}
