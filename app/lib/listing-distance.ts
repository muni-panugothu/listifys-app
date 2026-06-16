import { haversineDistanceKm, parseListingCoordinates, type LatLng } from "@/lib/listing-coordinates";

/** Categories where distance from buyer is not shown (e.g. remote jobs). */
const NO_DISTANCE_CATEGORIES = new Set(["jobs"]);

/** India uses kilometres; all other countries use miles for distance display. */
const KM_COUNTRY = "IN";

export function shouldShowListingDistance(category?: string | null) {
  if (!category) return true;
  return !NO_DISTANCE_CATEGORIES.has(category);
}

/**
 * Distance unit based on the viewer's country (from location / locale).
 * India → km; USA and all other countries → mi.
 */
export function usesMilesForCountry(isoCountryCode?: string | null) {
  if (!isoCountryCode) return false;
  return isoCountryCode.trim().toUpperCase() !== KM_COUNTRY;
}

export function getMileageUnitForCountry(
  isoCountryCode?: string | null,
): "km" | "mi" {
  return usesMilesForCountry(isoCountryCode) ? "mi" : "km";
}

export function formatVehicleOdometer(
  value?: string | number | null,
  options?: {
    unit?: "km" | "mi" | string | null;
    isoCountryCode?: string | null;
  },
) {
  const raw = value != null ? String(value).trim() : "";
  if (!raw) return undefined;

  if (/\b(km|kilomet(er|re)s?|mi|mile?s?)\b/i.test(raw)) {
    return raw;
  }

  const unit = options?.unit === "mi" || options?.unit === "km"
    ? options.unit
    : getMileageUnitForCountry(options?.isoCountryCode);
  const numeric = Number(raw.replace(/,/g, ""));
  const formatted = Number.isFinite(numeric)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(numeric)
    : raw;

  return `${formatted} ${unit}`;
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
 * Format a distance, choosing km or miles based on the viewer's country.
 * Pass `isoCountryCode` (ISO 3166-1 alpha-2) to get the right unit.
 * Defaults to kilometres when unknown (India default).
 */
export function formatDistance(km: number, isoCountryCode?: string | null) {
  if (!Number.isFinite(km) || km < 0) return null;

  const useMiles = usesMilesForCountry(isoCountryCode);

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

/** Format a search radius label (e.g. nearby map "within 50 km"). */
export function formatRadiusLabel(radiusKm: number, isoCountryCode?: string | null) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return "";
  if (usesMilesForCountry(isoCountryCode)) {
    const miles = Math.round(radiusKm * 0.621371);
    return `${miles} mi`;
  }
  return `${radiusKm} km`;
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

  return null;
}

export function getListingDistanceLabel(
  item: {
    _id?: string;
    id?: string;
    category?: string | null;
    distance?: number | null;
    coordinates?: unknown;
    countryCode?: string | null;
    currency?: string | null;
    location?: string | null;
  },
  userLocation?: LatLng | null,
  isoCountryCode?: string | null,
) {
  const km = resolveListingDistanceKm(item, userLocation);
  if (km == null) return undefined;

  // Unit follows the viewer's country (India → km, others → mi).
  return formatDistance(km, isoCountryCode) ?? undefined;
}
