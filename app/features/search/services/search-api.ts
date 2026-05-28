/**
 * Search API service — handles search, autocomplete suggestions,
 * trending searches, and recent-search persistence.
 *
 * Connects to:
 *   GET /api/search?q=...&entity=...&minPrice=...&maxPrice=...&sort=...
 *   GET /api/search/suggest?q=...&entity=...
 *   GET /api/search/trending
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";

import {
  AUTH_API_BASE_URL,
  getAccessToken,
  refreshAccessToken,
  resolveAbsoluteMediaUrl,
} from "@/features/auth/services/auth-api";

type ExpoDeviceModule = {
  brand?: string | null;
  modelName?: string | null;
  osName?: string | null;
  osVersion?: string | null;
};

const deviceModule = requireOptionalNativeModule<ExpoDeviceModule>("ExpoDevice");

// ── User Agent ──────────────────────────────────────────────────────────────────

function buildUserAgent(): string {
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const brand = deviceModule?.brand ?? "Unknown";
  const modelName = deviceModule?.modelName ?? "Unknown";
  const osName = deviceModule?.osName ?? Platform.OS;
  const osVersion = deviceModule?.osVersion ?? Platform.Version?.toString() ?? "";
  return `Listify/${appVersion} (${brand} ${modelName}; ${osName} ${osVersion})`;
}

const APP_USER_AGENT = buildUserAgent();
const RECENT_SEARCHES_KEY = "@listify/recent_searches";
const MAX_RECENT_SEARCHES = 20;

// ── Types ───────────────────────────────────────────────────────────────────────

export type SearchSuggestion = {
  _id: string;
  title: string;
  price?: number;
  currency?: string;
  location?: string;
  thumbnail?: string | null;
  brand?: string;
  model?: string;
  subcategory?: string;
  slug?: string;
  _entity: string;
};

export type SearchResultItem = {
  _id: string;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  subcategory?: string;
  condition?: string;
  location?: string;
  images: string[];
  brand?: string;
  model?: string;
  sellerName?: string;
  seller?: { _id: string; name?: string; profileImage?: string };
  views?: number;
  status?: string;
  _entity: string;
  _score?: number;
  _highlights?: Record<string, string[]>;
  distance?: number | null;
  createdAt?: string;
};

export type SearchPagination = {
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export type SearchResponse = {
  success: boolean;
  query: string;
  entity: string;
  detectedEntity?: string;
  results: SearchResultItem[];
  total: number;
  pagination: SearchPagination;
  source: "elasticsearch" | "cache" | "mongodb";
};

export type SuggestResponse = {
  success: boolean;
  suggestions: SearchSuggestion[];
  source: "elasticsearch" | "mongodb";
};

export type EntityCount = {
  entity: string;
  label: string;
  count: number;
};

// ── Search params ───────────────────────────────────────────────────────────────

export type SearchParams = {
  q: string;
  entity?: string;
  category?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  brand?: string;
  sort?: "relevance" | "price_asc" | "price_desc" | "nearest" | "oldest" | "views";
  page?: number;
  limit?: number;
  countryCode?: string | null;
};

// ── API helpers ─────────────────────────────────────────────────────────────────

async function searchFetch<T>(path: string): Promise<T> {
  const url = `${AUTH_API_BASE_URL}${path}`;

  const doFetch = async () => {
    const token = getAccessToken();
    return fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": APP_USER_AGENT,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  let res = await doFetch();

  // Auto-refresh on 401 and retry once
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch();
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Search request failed (${res.status})`);
  }
  return data as T;
}

async function searchPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${AUTH_API_BASE_URL}${path}`;

  const doFetch = async () => {
    const token = getAccessToken();
    return fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": APP_USER_AGENT,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  };

  let res = await doFetch();

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch();
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Search POST request failed (${res.status})`);
  }
  return data as T;
}

function normaliseImages(item: SearchResultItem): SearchResultItem {
  return {
    ...item,
    images: (item.images || []).map(
      (url) => resolveAbsoluteMediaUrl(url) ?? url,
    ),
    seller: item.seller
      ? {
          ...item.seller,
          profileImage:
            resolveAbsoluteMediaUrl(item.seller.profileImage) ?? undefined,
        }
      : item.seller,
  };
}

// ── Full Search ─────────────────────────────────────────────────────────────────

export async function searchListings(
  params: SearchParams,
): Promise<SearchResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.entity && params.entity !== "all") qs.set("entity", params.entity);
  if (params.category) qs.set("category", params.category);
  if (params.condition) qs.set("condition", params.condition);
  if (params.minPrice != null) qs.set("minPrice", String(params.minPrice));
  if (params.maxPrice != null) qs.set("maxPrice", String(params.maxPrice));
  if (params.location) qs.set("location", params.location);
  if (params.lat != null) qs.set("lat", String(params.lat));
  if (params.lng != null) qs.set("lng", String(params.lng));
  if (params.radius != null) qs.set("radius", String(params.radius));
  if (params.brand) qs.set("brand", params.brand);
  if (params.sort) qs.set("sort", params.sort);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.countryCode) qs.set("countryCode", params.countryCode);

  const res = await searchFetch<SearchResponse>(
    `/api/search?${qs.toString()}`,
  );

  return {
    ...res,
    results: (res.results || []).map(normaliseImages),
  };
}

// ── Autocomplete Suggestions ────────────────────────────────────────────────────

export async function fetchSuggestions(
  q: string,
  entity = "all",
  limit = 8,
): Promise<SearchSuggestion[]> {
  if (!q || q.trim().length < 2) return [];

  const qs = new URLSearchParams({ q, entity, limit: String(limit) });
  const res = await searchFetch<SuggestResponse>(
    `/api/search/suggest?${qs.toString()}`,
  );

  return (res.suggestions || []).map((s) => ({
    ...s,
    thumbnail: s.thumbnail ? (resolveAbsoluteMediaUrl(s.thumbnail) ?? s.thumbnail) : null,
  }));
}

// ── Fetch results per entity for tab counts ─────────────────────────────────────

const ENTITY_LABELS: Record<string, string> = {
  electronics: "Electronics",
  vehicles: "Vehicles",
  mobiles: "Mobiles",
  furniture: "Furniture",
  fashion: "Fashion",
  services: "Services",
  properties: "Properties",
  jobs: "Jobs",
  events: "Events",
  forsale: "For Sale",
  sports: "Sports",
  collectibles: "Collectibles",
  pets: "Pets",
  books: "Books",
  beauty: "Beauty",
  toys: "Toys",
  takecare: "Care",
  others: "Others",
};

export async function fetchEntityCounts(
  q: string,
): Promise<EntityCount[]> {
  // Fetch "all" to get total, then individual entities for counts
  // The backend returns total count in pagination, so a single "all" query gives us total
  const res = await searchListings({ q, entity: "all", limit: 0 });
  const total = res.pagination?.total ?? res.results?.length ?? 0;

  // For entity-specific counts, we'd need per-entity queries.
  // Return "All" with total count; individual counts will be fetched as user taps tabs.
  const counts: EntityCount[] = [
    { entity: "all", label: "All", count: total },
  ];

  return counts;
}

// ── Recent Searches (AsyncStorage) ──────────────────────────────────────────────

export async function getRecentSearches(): Promise<string[]> {
  try {
    const json = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    if (!json) return [];
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

export async function addRecentSearch(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return await getRecentSearches();

  try {
    const existing = await getRecentSearches();
    // Remove duplicate, add to front, trim to max
    const updated = [
      trimmed,
      ...existing.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, MAX_RECENT_SEARCHES);

    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [trimmed];
  }
}

export async function removeRecentSearch(query: string): Promise<string[]> {
  try {
    const existing = await getRecentSearches();
    const updated = existing.filter(
      (s) => s.toLowerCase() !== query.toLowerCase(),
    );
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export async function clearRecentSearches(): Promise<void> {
  await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
}

// ── AI Parsed chips (from server response) ──────────────────────────────────────

export type ParsedMeta = {
  cleanQuery: string;
  chips: Array<{ type: "price" | "condition" | "brand" | "location"; label: string; key: string }>;
};

// ── Trending ────────────────────────────────────────────────────────────────────

export type TrendingResponse = {
  trending: string[];
  categories: Array<{ entity: string; label: string; count: number }>;
};

export async function fetchTrending(city?: string): Promise<TrendingResponse> {
  const qs = city ? `?city=${encodeURIComponent(city)}` : "";
  try {
    const res = await searchFetch<{ success: boolean } & TrendingResponse>(
      `/api/search/trending${qs}`,
    );
    return { trending: res.trending ?? [], categories: res.categories ?? [] };
  } catch {
    return { trending: [], categories: [] };
  }
}

// ── Recommendations ─────────────────────────────────────────────────────────────

export type RecentlyViewedItem = {
  _id: string;
  _entity: string;
  title: string;
  price?: number;
  currency?: string;
  image?: string | null;
  viewedAt: string;
};

export type RecommendationsResponse = {
  recentlyViewed: RecentlyViewedItem[];
  mightLike: SearchResultItem[];
};

export async function fetchRecommendations(countryCode?: string | null): Promise<RecommendationsResponse> {
  try {
    const qs = countryCode ? `?countryCode=${encodeURIComponent(countryCode)}` : "";
    const res = await searchFetch<{ success: boolean } & RecommendationsResponse>(
      `/api/search/recommendations${qs}`,
    );
    return {
      recentlyViewed: res.recentlyViewed ?? [],
      mightLike: (res.mightLike ?? []).map(normaliseImages),
    };
  } catch {
    return { recentlyViewed: [], mightLike: [] };
  }
}

/**
 * Record a listing view on the server (Upstash Redis, 2-day TTL).
 * Fire-and-forget — errors are silently swallowed so they never interrupt the UX.
 */
export async function recordView(item: {
  _id: string;
  _entity: string;
  title?: string;
  price?: number | null;
  currency?: string;
  image?: string | null;
}): Promise<void> {
  try {
    await searchPost("/api/search/view", {
      _id: item._id,
      _entity: item._entity,
      title: item.title,
      price: item.price,
      currency: item.currency,
      image: item.image ?? null,
    });
  } catch {
    // Non-critical — silently ignore (user still sees listing)
  }
}

// ── Similar Items ───────────────────────────────────────────────────────────────

export async function fetchSimilarItems(
  entity: string,
  id: string,
  limit = 10,
): Promise<SearchResultItem[]> {
  try {
    const res = await searchFetch<{ success: boolean; results: SearchResultItem[] }>(
      `/api/search/similar/${entity}/${id}?limit=${limit}`,
    );
    return (res.results ?? []).map(normaliseImages);
  } catch {
    return [];
  }
}
