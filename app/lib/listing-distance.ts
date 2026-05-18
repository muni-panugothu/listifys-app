import { haversineDistanceKm, parseListingCoordinates, type LatLng } from "@/lib/listing-coordinates";

/** Categories where distance from buyer is not shown (e.g. remote jobs). */
const NO_DISTANCE_CATEGORIES = new Set(["jobs"]);

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
) {
  const km = resolveListingDistanceKm(item, userLocation);
  if (km == null) return undefined;
  return formatDistanceKm(km) ?? undefined;
}
