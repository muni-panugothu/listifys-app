/**
 * Convert between expo-router Hrefs and listifyapp:// deep links.
 * Used as a fallback when Notifee press events do not fire on Android.
 */
import * as Linking from 'expo-linking';

import type { Href } from '@/lib/safe-router';

export function hrefToDeepLink(href: Href): string {
  if (typeof href === 'string') {
    const withoutLeading = href.replace(/^\//, '');
    const [path, queryString] = withoutLeading.split('?');
    if (queryString) {
      const queryParams: Record<string, string> = {};
      new URLSearchParams(queryString).forEach((value, key) => {
        queryParams[key] = value;
      });
      return Linking.createURL(path, { queryParams });
    }
    return Linking.createURL(path);
  }

  const pathname = String(href.pathname).replace(/^\//, '');
  const params = ((href as { params?: Record<string, string> }).params ?? {}) as Record<
    string,
    string
  >;
  return Linking.createURL(pathname, { queryParams: params });
}

export function deepLinkToHref(url: string): Href | null {
  try {
    const parsed = Linking.parse(url);
    const rawPath = parsed.path?.trim() ?? '';
    if (!rawPath) return null;

    const pathname = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const queryParams = parsed.queryParams ?? {};
    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(queryParams)) {
      if (value == null) continue;
      params[key] = Array.isArray(value) ? String(value[0]) : String(value);
    }

    if (Object.keys(params).length === 0) {
      return pathname as Href;
    }

    return { pathname: pathname as never, params } as Href;
  } catch {
    return null;
  }
}
