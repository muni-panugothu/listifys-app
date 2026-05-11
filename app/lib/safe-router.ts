import { useCallback, useMemo } from "react";
import { type Href, usePathname, useRouter as useExpoRouter } from "expo-router";

export * from "expo-router";

const NAV_GUARD_MS = 700;
let lastNavigation = { key: "", at: 0 };

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
      const key = `push:${hrefToKey(href)}`;
      if (shouldBlockNavigation(key)) return;
      router.push(href);
    },
    [router],
  );

  const replace = useCallback(
    (href: Href) => {
      const key = `replace:${hrefToKey(href)}`;
      if (shouldBlockNavigation(key)) return;
      router.replace(href);
    },
    [router],
  );

  const back = useCallback(() => {
    const key = `back:${pathname}`;
    if (shouldBlockNavigation(key)) return;
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
