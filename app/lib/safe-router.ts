import { useCallback, useMemo } from "react";
import { type Href, usePathname, useRouter as useExpoRouter } from "expo-router";

export * from "expo-router";

const NAV_GUARD_MS = 700;
let lastNavigation = { key: "", at: 0 };
type RouteTransitionAction = "push" | "replace" | "back";
type RouteTransitionListener = (payload: {
  action: RouteTransitionAction;
  nextPath: string | null;
}) => void;

const routeTransitionListeners = new Set<RouteTransitionListener>();

function stableParamsString(params: Record<string, unknown>) {
  const keys = Object.keys(params).sort();
  return keys
    .map((k) => `${k}=${JSON.stringify(params[k])}`)
    .join("&");
}

function hrefToKey(href: Href) {
  if (typeof href === "string") return href;

  const pathname = String((href as { pathname?: unknown }).pathname ?? "");
  const params = ((href as { params?: unknown }).params ?? {}) as Record<string, unknown>;
  const hasParams = params && Object.keys(params).length > 0;
  return hasParams ? `${pathname}?${stableParamsString(params)}` : pathname;
}

function hrefToPath(href: Href): string | null {
  if (typeof href === "string") {
    const path = href.split("?")[0]?.split("#")[0] ?? "";
    return path || null;
  }

  const pathname = (href as { pathname?: unknown }).pathname;
  return typeof pathname === "string" ? pathname : null;
}

function isValidHref(href: unknown): href is Href {
  if (typeof href === "string") {
    return href.trim().length > 0;
  }

  if (!href || typeof href !== "object") {
    return false;
  }

  const pathname = (href as { pathname?: unknown }).pathname;
  return typeof pathname === "string" && pathname.trim().length > 0;
}

function notifyRouteTransition(action: RouteTransitionAction, nextPath: string | null) {
  for (const listener of routeTransitionListeners) {
    listener({ action, nextPath });
  }
}

export function subscribeRouteTransitions(listener: RouteTransitionListener) {
  routeTransitionListeners.add(listener);
  return () => {
    routeTransitionListeners.delete(listener);
  };
}

function shouldBlockNavigation(nextKey: string) {
  const now = Date.now();
  if (nextKey && nextKey === lastNavigation.key && now - lastNavigation.at < NAV_GUARD_MS) {
    return true;
  }

  lastNavigation = { key: nextKey, at: now };
  return false;
}

/**
 * Drop-in replacement for expo-router useRouter with double-tap navigation guard.
 * Prevents opening the same route multiple times on rapid taps.
 */
export function useRouter() {
  const router = useExpoRouter();
  const pathname = usePathname();

  const push = useCallback(
    (href: Href) => {
      if (!isValidHref(href)) {
        // Guard against malformed navigation payloads from dynamic route builders.
        // This avoids Expo Router crashes like "path.split is not a function".
        // eslint-disable-next-line no-console
        console.warn("[safe-router] Ignored invalid push href", href);
        return;
      }
      const key = `push:${hrefToKey(href)}`;
      if (shouldBlockNavigation(key)) return;
      notifyRouteTransition("push", hrefToPath(href));
      router.push(href);
    },
    [router],
  );

  const replace = useCallback(
    (href: Href) => {
      if (!isValidHref(href)) {
        // eslint-disable-next-line no-console
        console.warn("[safe-router] Ignored invalid replace href", href);
        return;
      }
      const key = `replace:${hrefToKey(href)}`;
      if (shouldBlockNavigation(key)) return;
      notifyRouteTransition("replace", hrefToPath(href));
      router.replace(href);
    },
    [router],
  );

  const back = useCallback(() => {
    const key = `back:${pathname}`;
    if (shouldBlockNavigation(key)) return;
    notifyRouteTransition("back", null);
    router.back();
  }, [router, pathname]);

  return useMemo(
    () => ({
      ...router,
      push,
      replace,
      back,
    }),
    [router, push, replace, back],
  );
}
