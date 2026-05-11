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

// ── Feed API (aggregated home feed) ────────────────────────────────────────────

export async function fetchHomeFeed(params?: {
  limit?: number;
  page?: number;
  search?: string;
}): Promise<FeedResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.page) query.set("page", String(params.page));
  if (params?.search) query.set("search", params.search);

  const qs = query.toString();

  return withCache(
    cacheKeys.feed(params?.page),
    async () => {
      const data = await apiRequest<FeedResponse>(`/api/feed${qs ? `?${qs}` : ""}`);
      // Normalise all images in each category
      if (data.categories) {
        for (const category of Object.keys(data.categories)) {
          const cat = data.categories[category];
          if (cat?.listings) {
            cat.listings = cat.listings.map(normaliseListingImages);
          }
        }
      }
      return data;
    },
    60_000, // 1 minute TTL
  );
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

  const qs = query.toString();

  return withCache(
    cacheKeys.categoryList(categorySlug, params?.page),
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
  viewedAt: number;
};

export async function addToRecentlyViewed(item: ListingItem): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    const existing: RecentlyViewedItem[] = raw ? JSON.parse(raw) : [];
    // Remove duplicate if present
    const filtered = existing.filter((i) => i._id !== item._id);
    filtered.unshift({
      _id: item._id,
      title: item.title,
      price: item.price,
      images: item.images,
      category: item.category,
      viewedAt: Date.now(),
    });
    // Cap at max
    await AsyncStorage.setItem(
      RECENTLY_VIEWED_KEY,
      JSON.stringify(filtered.slice(0, MAX_RECENTLY_VIEWED)),
    );
  } catch {
    // silently fail
  }
}

export async function getRecentlyViewed(): Promise<RecentlyViewedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
