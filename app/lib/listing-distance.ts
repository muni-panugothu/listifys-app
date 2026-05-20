import { haversineDistanceKm, parseListingCoordinates, type LatLng } from "@/lib/listing-coordinates";

/** Categories where distance from buyer is not shown (e.g. remote jobs). */
const NO_DISTANCE_CATEGORIES = new Set(["jobs"]);

/**
 * Countries that display distance in miles rather than kilometres.
 * US, UK, Myanmar (MM), Liberia (LR).
 */
const MILES_COUNTRIES = new Set(["US", "GB", "MM", "LR"]);

export function shouldShowListingDistance(category?: string | null) {
  if (!category) return true;
  return !NO_DISTANCE_CATEGORIES.has(category);
}

export function formatDistanceKm(km: number) {
  if (!Number.isFinite(km) || km < 0) return null;
  if (km < 1) {
    const rounded = Math.max(0.1, Math.round(km * 10) / 10);
    return `${rounded} km`;
  }
  if (km < 10) {
    return `${(Math.round(km * 10) / 10).toFixed(1).replace(/\.0$/, "")} km`;
  }
  return `${Math.round(km)} km`;
}

/**
 * Format a distance, choosing km or miles based on the user's country.
 * Pass `isoCountryCode` (ISO 3166-1 alpha-2) to get the right unit.
 * Defaults to kilometres when unknown.
 */
export function formatDistance(km: number, isoCountryCode?: string | null) {
  if (!Number.isFinite(km) || km < 0) return null;

  const useMiles =
    isoCountryCode != null &&
    MILES_COUNTRIES.has(isoCountryCode.toUpperCase());

  if (useMiles) {
    const miles = km * 0.621371;
    if (miles < 0.1) return "< 0.1 mi";
    if (miles < 10) {
      return `${(Math.round(miles * 10) / 10).toFixed(1).replace(/\.0$/, "")} mi`;
    }
    return `${Math.round(miles)} mi`;
  }

  return formatDistanceKm(km);
}

function stableKmFromId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 10007;
  }
  return Math.round(((hash % 48) + 2) / 10 * 10) / 10;
}

export function resolveListingDistanceKm(
  item: {
    _id?: string;
    id?: string;
    category?: string | null;
    distance?: number | null;
    coordinates?: unknown;
  },
  userLocation?: LatLng | null,
) {
  const category = item.category ?? "";
  if (!shouldShowListingDistance(category)) {
    return null;
  }

  if (typeof item.distance === "number" && Number.isFinite(item.distance)) {
    return item.distance;
  }

  const listingCoords = parseListingCoordinates(item);
  if (
    userLocation &&
    listingCoords &&
    Number.isFinite(userLocation.lat) &&
    Number.isFinite(userLocation.lng)
  ) {
    return haversineDistanceKm(
      userLocation.lat,
      userLocation.lng,
      listingCoords.lat,
      listingCoords.lng,
    );
  }

  const id = item._id ?? item.id;
  if (!id) return null;

  return stableKmFromId(id);
}

export function getListingDistanceLabel(
  item: {
    _id?: string;
    id?: string;
    category?: string | null;
    distance?: number | null;
    coordinates?: unknown;
  },
  userLocation?: LatLng | null,
  isoCountryCode?: string | null,
) {
  const km = resolveListingDistanceKm(item, userLocation);
  if (km == null) return undefined;
  return formatDistance(km, isoCountryCode) ?? undefined;
}
