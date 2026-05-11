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
import * as Device from "expo-device";

import {
  AUTH_API_BASE_URL,
  getAccessToken,
  refreshAccessToken,
  resolveAbsoluteMediaUrl,
} from "@/features/auth/services/auth-api";

// ── User Agent ──────────────────────────────────────────────────────────────────

function buildUserAgent(): string {
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const brand = Device.brand ?? "Unknown";
  const modelName = Device.modelName ?? "Unknown";
  const osName = Device.osName ?? Platform.OS;
  const osVersion = Device.osVersion ?? Platform.Version?.toString() ?? "";
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
