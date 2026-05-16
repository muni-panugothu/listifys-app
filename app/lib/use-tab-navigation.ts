import { usePathname, useRouter } from "@/lib/safe-router";
import { useCallback, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showAuthGate, type AuthGateAction } from "@/store/slices/auth-gate-slice";

import { useAppSelector } from "@/store/hooks";

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
 * Tabs that require authentication. If the user is not logged in,
 * the optional `onAuthRequired` callback fires instead of navigating.
 */
const AUTH_REQUIRED_TABS = new Set(["sell"]);

/**
 * Shared bottom-tab navigation handler.
 * Uses `router.replace` to avoid stacking duplicate screens
 * and guards against navigating to the current route.
 *
 * @param onAuthRequired – fired when an unauthenticated user taps a protected tab (e.g. Sell)
 */
export function useTabNavigation(onAuthRequired?: () => void) {
  const router = useRouter();
  const pathname = usePathname();
<<<<<<< HEAD
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
=======
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const lastNavigationRef = useRef<{ target: string; timestamp: number } | null>(null);
>>>>>>> 6bb5ad6d92f5b6fc7fe22622c4af17bc56e61087

  const handleTabPress = useCallback(
    (tabId: string) => {
      const target = TAB_ROUTES[tabId];
      if (!target) return;

      // Guard protected tabs
      if (AUTH_REQUIRED_TABS.has(tabId) && !isAuthenticated) {
        onAuthRequired?.();
        return;
      }

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
<<<<<<< HEAD
    [router, pathname, isAuthenticated, onAuthRequired],
=======
    [dispatch, isAuthenticated, pathname, router],
>>>>>>> 6bb5ad6d92f5b6fc7fe22622c4af17bc56e61087
  );

  return handleTabPress;
}
