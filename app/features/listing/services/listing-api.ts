/**
 * Listing API service — handles all listing CRUD and image upload calls.
 * Re-uses the auth-aware requestJson() from auth-api.ts.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import {
  AUTH_API_BASE_URL,
  getAccessToken,
  refreshAccessToken,
  requestJson,
  resolveAbsoluteMediaUrl,
} from "@/features/auth/services/auth-api";
import type { CategorySlug } from "@/constants/categories";
import { cacheKeys, invalidateCache, withCache } from "@/lib/cache";
import { getListingSellerId } from "@/lib/is-own-listing";

import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";

type ExpoDeviceModule = {
  brand?: string | null;
  modelName?: string | null;
  osName?: string | null;
  osVersion?: string | null;
};

const deviceModule = requireOptionalNativeModule<ExpoDeviceModule>("ExpoDevice");

function buildUserAgent(): string {
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const brand = deviceModule?.brand ?? "Unknown";
  const modelName = deviceModule?.modelName ?? "Unknown";
  const osName = deviceModule?.osName ?? Platform.OS;
  const osVersion = deviceModule?.osVersion ?? Platform.Version?.toString() ?? "";
  return `Listify/${appVersion} (${brand} ${modelName}; ${osName} ${osVersion})`;
}

const APP_USER_AGENT = buildUserAgent();

// ── Generic authenticated JSON request (delegates to auth-api) ─────────────────

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return requestJson<T>(path, init);
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type ListingItem = {
  _id: string;
  title: string;
  slug?: string;
  description?: string;
  price?: number;
  currency?: string;
  category: string;
  subcategory?: string;
  condition?: string;
  location?: string;
  images: string[];
  sellerName?: string;
  seller?: {
    _id: string;
    name?: string;
    profileImage?: string;
    createdAt?: string;
  };
  views?: number;
  phone?: string;
  status?: string;
  savedBy?: string[];
  createdAt?: string;
  brand?: string;
  model?: string;
  warranty?: string;
  ram?: string;
  storage?: string;
  color?: string;
  year?: number;
  mileage?: string;
  fuelType?: string;
  transmission?: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: string;
  propertyType?: string;
  furnished?: string;
  [key: string]: unknown;
  coordinates?: {
    type: string;
    coordinates: [number, number];
  };
};

export type FeedCategoryData = {
  listings: ListingItem[];
  count: number;
  hasMore: boolean;
};

export type FeedResponse = {
  success: boolean;
  total: number;
  categories: Record<string, FeedCategoryData>;
  pagination?: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
};

export type CachedHomeFeed = {
  savedAt: number;
  data: FeedResponse;
};

export type ListingsResponse = {
  success: boolean;
  listings: ListingItem[];
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalListings: number;
  };
};

export type SingleListingResponse = {
  success: boolean;
  listing: ListingItem;
};

export type CreateListingResponse = {
  success: boolean;
  message: string;
  listing: ListingItem;
};

export type ImageUploadResponse = {
  success: boolean;
  images: string[];
  message?: string;
};

// ── Normalise image URLs in listings ───────────────────────────────────────────

function normaliseListingImages(listing: ListingItem): ListingItem {
  return {
    ...listing,
    images: (listing.images || []).map(
      (url) => resolveAbsoluteMediaUrl(url) ?? url,
    ),
    seller: listing.seller
      ? {
          ...listing.seller,
          profileImage: resolveAbsoluteMediaUrl(listing.seller.profileImage) ?? undefined,
        }
      : listing.seller,
  };
}

function normaliseFeedResponse(data: FeedResponse): FeedResponse {
  return {
    ...data,
    categories: Object.fromEntries(
      Object.entries(data.categories ?? {}).map(([category, categoryData]) => [
        category,
        {
          ...categoryData,
          listings: (categoryData.listings ?? []).map(normaliseListingImages),
        },
      ]),
    ),
  };
}

const HOME_FEED_CACHE_KEY = "@listify/home_feed_cache";

// ── Feed API (aggregated home feed) ────────────────────────────────────────────

export async function fetchHomeFeed(params?: {
  limit?: number;
  page?: number;
  search?: string;
  location?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  countryCode?: string;
}): Promise<FeedResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.page) query.set("page", String(params.page));
  if (params?.search) query.set("search", params.search);
  if (params?.location) query.set("location", params.location);
  if (params?.lat != null) query.set("lat", String(params.lat));
  if (params?.lng != null) query.set("lng", String(params.lng));
  if (params?.radius != null) query.set("radius", String(params.radius));
  if (params?.countryCode) query.set("countryCode", params.countryCode);

  const qs = query.toString();
  const feedCacheKey = [
    cacheKeys.feed(params?.page),
    `limit:${params?.limit ?? "default"}`,
    `search:${encodeURIComponent(params?.search ?? "")}`,
    `lat:${params?.lat ?? ""}`,
    `lng:${params?.lng ?? ""}`,
    `loc:${encodeURIComponent(params?.location ?? "")}`,
  ].join(":");

  return withCache(
    feedCacheKey,
    async () => {
      const data = normaliseFeedResponse(
        await apiRequest<FeedResponse>(`/api/feed${qs ? `?${qs}` : ""}`),
      );

      if ((!params?.page || params.page === 1) && !params?.search) {
        try {
          await AsyncStorage.setItem(
            HOME_FEED_CACHE_KEY,
            JSON.stringify({
              savedAt: Date.now(),
              data,
            } satisfies CachedHomeFeed),
          );
        } catch {
          // silently fail cache writes
        }
      }

      return data;
    },
    60_000,
  );
}

export async function getCachedHomeFeed(): Promise<CachedHomeFeed | null> {
  try {
    const raw = await AsyncStorage.getItem(HOME_FEED_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedHomeFeed> | null;
    if (!parsed || typeof parsed.savedAt !== "number" || !parsed.data) {
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      data: normaliseFeedResponse(parsed.data),
    };
  } catch {
    return null;
  }
}

// ── Nearby Listings ────────────────────────────────────────────────────────────

export type NearbyListingsResponse = {
  success: boolean;
  listings: (ListingItem & { distance: number | null; _entity: string; _detailPath: string })[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
  location: { lat: number; lng: number; radius: number };
  source?: string;
};

export async function fetchNearbyListings(params: {
  lat: number;
  lng: number;
  radius?: number;
  search?: string;
  category?: string;
  sort?: string;
  page?: number;
  limit?: number;
  countryCode?: string | null;
}): Promise<NearbyListingsResponse> {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    radius: String(params.radius ?? 50),
  });
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  if (params.sort) query.set("sort", params.sort);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.countryCode) query.set("countryCode", params.countryCode);

  const data = await apiRequest<NearbyListingsResponse>(`/api/nearby?${query.toString()}`);
  const listings = (data.listings ?? []).map((item) => normaliseListingImages(item as ListingItem) as typeof item);
  return { ...data, listings };
}

// ── Category Listings ──────────────────────────────────────────────────────────

export async function fetchCategoryListings(
  categorySlug: CategorySlug,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    subcategory?: string;
    condition?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    location?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    countryCode?: string | null;
  },
): Promise<ListingsResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
  if (params?.subcategory) query.set("category", params.subcategory);
  if (params?.condition) query.set("condition", params.condition);
  if (params?.minPrice) query.set("minPrice", String(params.minPrice));
  if (params?.maxPrice) query.set("maxPrice", String(params.maxPrice));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.location) query.set("location", params.location);
  if (params?.lat != null) query.set("lat", String(params.lat));
  if (params?.lng != null) query.set("lng", String(params.lng));
  if (params?.radius != null) query.set("radius", String(params.radius));
  if (params?.countryCode) query.set("countryCode", params.countryCode);

  const qs = query.toString();

  const cacheKey = [
    "list",
    categorySlug,
    params?.page ?? 1,
    `limit:${params?.limit ?? ""}`,
    params?.subcategory ?? "",
    params?.search ?? "",
    params?.condition ?? "",
    `min:${params?.minPrice ?? ""}`,
    `max:${params?.maxPrice ?? ""}`,
    params?.sort ?? "",
    `loc:${encodeURIComponent(params?.location ?? "")}`,
    `lat:${params?.lat ?? ""}`,
    `lng:${params?.lng ?? ""}`,
    `radius:${params?.radius ?? ""}`,
    `cc:${params?.countryCode ?? ""}`,
  ].join(":");

  return withCache(
    cacheKey,
    async () => {
      const data = await apiRequest<ListingsResponse>(
        `/api/${categorySlug}${qs ? `?${qs}` : ""}`,
      );
      data.listings = (data.listings || []).map(normaliseListingImages);
      return data;
    },
    60_000,
  );
}

// ── Single Listing Detail ──────────────────────────────────────────────────────

export async function fetchListingById(
  categorySlug: CategorySlug,
  id: string,
): Promise<SingleListingResponse> {
  return withCache(
    cacheKeys.listingDetail(categorySlug, id),
    async () => {
      const data = await apiRequest<SingleListingResponse>(
        `/api/${categorySlug}/${id}`,
      );
      if (data.listing) {
        data.listing = normaliseListingImages(data.listing);
      }
      return data;
    },
    120_000, // 2 minutes TTL
  );
}

// ── Create Listing ─────────────────────────────────────────────────────────────

export async function createListing(
  categorySlug: CategorySlug,
  body: Record<string, unknown>,
): Promise<CreateListingResponse> {
  const result = await apiRequest<CreateListingResponse>(`/api/${categorySlug}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  // Invalidate feed and category caches
  invalidateCache("feed:");
  invalidateCache(`list:${categorySlug}`);
  invalidateCache("my-listings");
  return result;
}

// ── Update Listing ─────────────────────────────────────────────────────────────

export async function updateListing(
  categorySlug: CategorySlug,
  id: string,
  body: Record<string, unknown>,
): Promise<CreateListingResponse> {
  const result = await apiRequest<CreateListingResponse>(`/api/${categorySlug}/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  invalidateCache(cacheKeys.listingDetail(categorySlug, id));
  invalidateCache(`list:${categorySlug}`);
  invalidateCache("feed:");
  invalidateCache("my-listings");
  return result;
}

// ── Delete Listing ─────────────────────────────────────────────────────────────

export async function deleteListing(
  categorySlug: CategorySlug,
  id: string,
): Promise<{ success: boolean; message: string }> {
  const result = await apiRequest<{ success: boolean; message: string }>(`/api/${categorySlug}/${id}`, { method: "DELETE" });
  invalidateCache(cacheKeys.listingDetail(categorySlug, id));
  invalidateCache(`list:${categorySlug}`);
  invalidateCache("feed:");
  invalidateCache("my-listings");
  return result;
}

// ── Toggle Save (bookmark) ─────────────────────────────────────────────────────

export async function toggleSaveListing(
  categorySlug: CategorySlug,
  id: string,
): Promise<{ success: boolean; saved: boolean }> {
  return apiRequest(`/api/${categorySlug}/${id}/toggle-save`, {
    method: "POST",
  });
}

// ── Image Moderation ──────────────────────────────────────────────────────────

export type ModerationResult = {
  filename: string;
  decision: "allow" | "review" | "block";
  block: boolean;
  category: string;
  confidence: number;
  requiresHumanReview: boolean;
  categories: Record<string, string>;
  error?: string;
};

export type ModerationResponse = {
  success: boolean;
  overallDecision: "allow" | "review" | "block";
  overallCategory: string;
  requiresHumanReview: boolean;
  results: ModerationResult[];
};

export async function checkImageModeration(
  imageUris: string[],
): Promise<ModerationResponse> {
  const formData = new FormData();
  for (const uri of imageUris) {
    const filename = uri.split("/").pop() || `image_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1] : "jpg";
    const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;

    formData.append("images", {
      uri: Platform.OS === "android" ? uri : uri.replace("file://", ""),
      name: filename,
      type: mimeType,
    } as unknown as Blob);
  }

  const token = getAccessToken();
  const response = await fetch(`${AUTH_API_BASE_URL}/api/moderation/check-images`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "User-Agent": APP_USER_AGENT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryToken = getAccessToken();
      const retryResponse = await fetch(`${AUTH_API_BASE_URL}/api/moderation/check-images`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "User-Agent": APP_USER_AGENT,
          ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {}),
        },
        body: formData,
      });
      const data = await retryResponse.json();
      return data as ModerationResponse;
    }
  }

  const data = await response.json().catch(() => ({ success: false, overallDecision: "allow", results: [] }));
  return data as ModerationResponse;
}

// ── Upload Images to S3 ───────────────────────────────────────────────────────

export async function uploadListingImages(
  categorySlug: CategorySlug,
  imageUris: string[],
): Promise<ImageUploadResponse> {
  const buildFormData = () => {
    const formData = new FormData();
    for (const uri of imageUris) {
      const filename = uri.split("/").pop() || `image_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1] : "jpg";
      const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;

      formData.append("images", {
        uri: Platform.OS === "android" ? uri : uri.replace("file://", ""),
        name: filename,
        type: mimeType,
      } as unknown as Blob);
    }
    return formData;
  };

  const url = `${AUTH_API_BASE_URL}/api/${categorySlug}/upload-images`;

  const doUpload = async () => {
    const token = getAccessToken();
    return fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": APP_USER_AGENT,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: buildFormData(),
    });
  };

  let response = await doUpload();

  // Auto-refresh on 401 and retry once (mirrors requestJson behaviour)
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doUpload();
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Image upload failed");
  }

  // Server returns "imageUrls"; normalise to "images" for our type
  const rawUrls: string[] = data.images ?? data.imageUrls ?? [];
  const images = rawUrls.map(
    (url: string) => resolveAbsoluteMediaUrl(url) ?? url,
  );

  return { ...data, images } as ImageUploadResponse;
}

// ── My Listings (all categories unified) ───────────────────────────────────────

export async function fetchMyListings(): Promise<ListingsResponse> {
  const data = await apiRequest<ListingsResponse>("/api/feed/my-listings");
  data.listings = (data.listings || []).map(normaliseListingImages);
  return data;
}

// ── Saved Listings (all categories unified) ────────────────────────────────────

export async function fetchSavedListings(): Promise<ListingsResponse> {
  const data = await apiRequest<ListingsResponse>("/api/feed/saved");
  data.listings = (data.listings || []).map(normaliseListingImages);
  return data;
}

// ── Recently Viewed (local AsyncStorage) ───────────────────────────────────────

const RECENTLY_VIEWED_KEY = "@listify/recently_viewed";
const MAX_RECENTLY_VIEWED = 20;

export type RecentlyViewedItem = {
  _id: string;
  title: string;
  price?: number;
  images: string[];
  category: string;
  createdAt?: string;
  sellerId?: string;
  viewedAt: number;
  /** The user's location label at the moment the item was viewed. */
  viewedLocation?: string;
  /** ISO 3166-1 alpha-2 country code at the time of viewing (e.g. "US", "IN"). */
  isoCountryCode?: string;
};

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export async function addToRecentlyViewed(
  item: ListingItem,
  locationLabel?: string,
  isoCountryCode?: string | null,
): Promise<void> {
  // ── 1. AsyncStorage (works for guests + offline) ────────────────────────
  try {
    const raw = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    const existing: RecentlyViewedItem[] = raw ? JSON.parse(raw) : [];
    // Remove duplicate and items older than 2 days
    const now = Date.now();
    const filtered = existing.filter((i) => i._id !== item._id && now - i.viewedAt < TWO_DAYS_MS);
    filtered.unshift({
      _id: item._id,
      title: item.title,
      price: item.price,
      images: item.images,
      category: item.category,
      createdAt: item.createdAt,
      sellerId: getListingSellerId(item) ?? undefined,
      viewedAt: Date.now(),
      viewedLocation: locationLabel || undefined,
      isoCountryCode: isoCountryCode ?? undefined,
    });
    await AsyncStorage.setItem(
      RECENTLY_VIEWED_KEY,
      JSON.stringify(filtered.slice(0, MAX_RECENTLY_VIEWED)),
    );
  } catch {
    // silently fail
  }

  // ── 2. Server-side Redis (authenticated users — 2-day TTL) ─────────────
  // Fire-and-forget; never blocks the detail screen from loading.
  const token = getAccessToken();
  if (token) {
    const postView = async () => {
      try {
        await fetch(`${AUTH_API_BASE_URL}/api/search/view`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            _id: item._id,
            _entity: item.category,
            title: item.title,
            price: item.price,
            currency: (item as { currency?: string }).currency,
            image: item.images?.[0] ?? null,
            countryCode: isoCountryCode ?? undefined,
          }),
        });
      } catch {
        // Non-critical — ignore silently
      }
    };
    postView();
  }
}

export async function getRecentlyViewed(isoCountryCode?: string | null): Promise<RecentlyViewedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const items: RecentlyViewedItem[] = JSON.parse(raw);
    const now = Date.now();
    // Filter out expired items, then filter strictly by country when set.
    // When the user has a country selected, only show items from that same country
    // (items with no isoCountryCode, i.e. recorded before this feature, are also
    // excluded so cross-country pollution does not surface).
    return items.filter((i) => {
      if (now - i.viewedAt >= TWO_DAYS_MS) return false;
      if (isoCountryCode && i.isoCountryCode !== isoCountryCode) return false;
      return true;
    });
  } catch {
    return [];
  }
}

/**
 * Splits recently-viewed items into two buckets:
 * - `nearYou`: items viewed while the user was in the same city as `currentLocationLabel`
 * - `others`: everything else, sorted by most recently viewed
 *
 * Matching is done on the first comma-segment (city) of both labels, case-insensitive.
 * If `currentLocationLabel` is empty/falsy all items fall into `others`.
 */
export function partitionRecentlyViewedByLocation(
  items: RecentlyViewedItem[],
  currentLocationLabel: string | null | undefined,
): { nearYou: RecentlyViewedItem[]; others: RecentlyViewedItem[] } {
  const normalise = (label: string) =>
    label.split(",")[0].trim().toLowerCase();

  const currentCity = currentLocationLabel ? normalise(currentLocationLabel) : null;

  const nearYou: RecentlyViewedItem[] = [];
  const others: RecentlyViewedItem[] = [];

  for (const item of items) {
    if (currentCity && item.viewedLocation) {
      const viewedCity = normalise(item.viewedLocation);
      if (viewedCity === currentCity || item.viewedLocation.toLowerCase().includes(currentCity)) {
        nearYou.push(item);
        continue;
      }
    }
    others.push(item);
  }

  return { nearYou, others };
}
