/**
 * Google Places Service
 *
 * Wraps the Google Places Autocomplete + Place Details REST APIs.
 * Requires EXPO_PUBLIC_GOOGLE_MAPS_KEY with "Places API" enabled
 * in Google Cloud Console.
 *
 * Endpoints used:
 *   POST https://places.googleapis.com/v1/places:autocomplete  (Places API New)
 *   GET  https://maps.googleapis.com/maps/api/place/autocomplete/json  (legacy)
 *   GET  https://maps.googleapis.com/maps/api/place/details/json
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const AUTOCOMPLETE_URL =
  "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

const RECENT_KEY = "@listify/recent_locations_v2";
const MAX_RECENT = 6;

// ── Types ──────────────────────────────────────────────────────────────────────

export type MatchedSubstring = {
  offset: number;
  length: number;
};

export type PlaceTerm = {
  offset: number;
  value: string;
};

export type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
    main_text_matched_substrings: MatchedSubstring[];
  };
  types: string[];
  terms: PlaceTerm[];
};

export type PlaceAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type PlaceDetails = {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  address_components?: PlaceAddressComponent[];
};

export type RecentLocation = {
  place_id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  savedAt: number;
  isoCountryCode?: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Extract ISO 3166-1 alpha-2 country code from Place Details address components. */
export function extractIsoCountryCode(details: PlaceDetails): string | null {
  const comp = details.address_components?.find((c) =>
    c.types.includes("country"),
  );
  return comp?.short_name?.toUpperCase() ?? null;
}

/** Generate a cryptographically simple session token (no uuid dependency). */
export function generateSessionToken(): string {
  const arr = new Uint32Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 4; i++) arr[i] = Math.floor(Math.random() * 0xffffffff);
  }
  return Array.from(arr, (n) => n.toString(16).padStart(8, "0")).join("-");
}

// ── Autocomplete ───────────────────────────────────────────────────────────────

/**
 * Fetch place predictions from Google Places Autocomplete API.
 *
 * @param input        - User's typed query
 * @param sessionToken - Billing session token (reuse across calls in same session)
 * @param signal       - AbortSignal to cancel in-flight request
 * @param userLat      - Optional user latitude (biases results)
 * @param userLng      - Optional user longitude (biases results)
 */
export async function fetchAutocompletePredictions(
  input: string,
  sessionToken: string,
  signal?: AbortSignal,
  userLat?: number | null,
  userLng?: number | null,
): Promise<PlacePrediction[]> {
  if (!API_KEY) return [];
  if (input.trim().length < 2) return [];

  const params = new URLSearchParams({
    input: input.trim(),
    key: API_KEY,
    sessiontoken: sessionToken,
    language: "en",
  });

  // Location bias — nudges results toward user's area without restricting worldwide search
  if (userLat != null && userLng != null) {
    params.set("location", `${userLat},${userLng}`);
    params.set("radius", "50000"); // 50 km soft bias
  }

  const res = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Autocomplete HTTP ${res.status}`);

  const json = (await res.json()) as {
    status: string;
    predictions?: PlacePrediction[];
    error_message?: string;
  };

  if (json.status === "ZERO_RESULTS") return [];
  if (json.status !== "OK") {
    throw new Error(json.error_message ?? `Places API status: ${json.status}`);
  }

  return json.predictions ?? [];
}

// ── Place Details ──────────────────────────────────────────────────────────────

/**
 * Fetch exact coordinates + full address for a given place_id.
 * Must use the SAME sessionToken as the autocomplete calls to stay
 * within the same billing session.
 */
export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetails> {
  if (!API_KEY) throw new Error("Google Maps API key is not configured.");

  const params = new URLSearchParams({
    place_id: placeId,
    fields: "geometry,formatted_address,name,address_components",
    key: API_KEY,
    sessiontoken: sessionToken,
    language: "en",
  });

  const res = await fetch(`${DETAILS_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Place Details HTTP ${res.status}`);

  const json = (await res.json()) as {
    status: string;
    result?: PlaceDetails;
    error_message?: string;
  };

  if (json.status !== "OK") {
    throw new Error(json.error_message ?? `Place Details status: ${json.status}`);
  }
  if (!json.result) throw new Error("Place Details: no result returned.");

  return json.result;
}

// ── Recent Locations ───────────────────────────────────────────────────────────

export async function loadRecentLocations(): Promise<RecentLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentLocation[];
  } catch {
    return [];
  }
}

export async function saveRecentLocation(loc: RecentLocation): Promise<void> {
  try {
    const existing = await loadRecentLocations();
    const deduped = existing.filter((r) => r.place_id !== loc.place_id);
    const updated = [loc, ...deduped].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // fail silently — recent search is non-critical
  }
}

export async function clearRecentLocations(): Promise<void> {
  await AsyncStorage.removeItem(RECENT_KEY);
}
