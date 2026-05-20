import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

export const LOCATION_STORAGE_KEY = "@listify/app_location";

export type StoredAppLocation = {
  label: string;
  lat: number;
  lng: number;
  source: "gps" | "manual";
  updatedAt: number;
  /** ISO 3166-1 alpha-2 country code, e.g. "IN", "US", "GB". */
  isoCountryCode?: string | null;
};

function normalizePart(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function isSamePlace(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function isDuplicatePart(candidate: string, existing: string[]) {
  const lower = candidate.toLowerCase();
  return existing.some(
    (part) =>
      part.toLowerCase() === lower ||
      part.toLowerCase().includes(lower) ||
      lower.includes(part.toLowerCase()),
  );
}

/** Plot / door / street numbers — not suitable for "Kukatpally, Hyderabad" style labels. */
function looksLikeStreetAddress(value: string) {
  const v = value.trim();
  if (!v) return true;

  if (/^[\d\s\-/.,#]+$/.test(v)) return true;
  if (/^\d+[\-/]/.test(v)) return true;
  if (/^\d+\s+/.test(v)) return true;

  const digits = (v.match(/\d/g) ?? []).length;
  const letters = (v.match(/[a-zA-Z]/g) ?? []).length;
  if (digits >= 2 && digits >= letters) return true;

  if (
    /\b(plot|h\.?\s*no|house|flat|door|lane|road|rd|st|street|avenue|ave)\b/i.test(v) &&
    digits >= 1
  ) {
    return true;
  }

  return false;
}

function isValidLocalityName(value: string) {
  if (!value || looksLikeStreetAddress(value)) return false;
  if (value.length < 2 || value.length > 40) return false;
  return /[a-zA-Z]{2,}/.test(value);
}

/** Merge fields from multiple reverse-geocode hits (Android often splits locality across rows). */
function mergeGeocodeResults(
  results: Location.LocationGeocodedAddress[],
): Location.LocationGeocodedAddress {
  const merged: Location.LocationGeocodedAddress = {
    city: null,
    district: null,
    street: null,
    streetNumber: null,
    region: null,
    subregion: null,
    country: null,
    postalCode: null,
    name: null,
    isoCountryCode: null,
    timezone: null,
    formattedAddress: null,
  };

  for (const row of results) {
    for (const key of Object.keys(merged) as (keyof Location.LocationGeocodedAddress)[]) {
      const value = row[key];
      if (typeof value !== "string" || !value.trim()) continue;

      const trimmed = value.trim();
      if (key === "name" && looksLikeStreetAddress(trimmed)) continue;
      if (key === "street") continue;

      if (!merged[key]) {
        merged[key] = trimmed;
      }
    }
  }

  if (merged.name && looksLikeStreetAddress(merged.name)) {
    merged.name = null;
    for (const row of results) {
      const candidate = row.name?.trim();
      if (candidate && isValidLocalityName(candidate)) {
        merged.name = candidate;
        break;
      }
    }
  }

  return merged;
}

/**
 * Prefer neighbourhood / locality + city, e.g. "Kukatpally, Hyderabad".
 */
export function formatGeocodeAddress(place: Location.LocationGeocodedAddress) {
  const city = normalizePart(place.city);
  const region = normalizePart(place.region);
  const country = normalizePart(place.country);

  // subregion / district = locality in India; never use street or plot numbers in `name`.
  const areaCandidates = [
    normalizePart(place.subregion),
    normalizePart(place.district),
    normalizePart(place.name),
  ]
    .filter(isValidLocalityName)
    .filter((part, index, arr) => arr.indexOf(part) === index);

  let locality: string | undefined;

  for (const candidate of areaCandidates) {
    if (isSamePlace(candidate, city) || isSamePlace(candidate, region)) {
      continue;
    }
    if (country && isSamePlace(candidate, country)) {
      continue;
    }
    if (city && candidate.toLowerCase().endsWith(city.toLowerCase())) {
      const trimmed = candidate
        .slice(0, candidate.length - city.length)
        .replace(/,\s*$/, "")
        .trim();
      if (isValidLocalityName(trimmed) && !isSamePlace(trimmed, city)) {
        locality = trimmed;
        break;
      }
    }
    if (!isDuplicatePart(candidate, [city, region].filter(Boolean))) {
      locality = candidate;
      break;
    }
  }

  if (locality && city && !isSamePlace(locality, city)) {
    return `${locality}, ${city}`;
  }

  if (city) {
    return city;
  }

  if (locality) {
    return locality;
  }

  if (region && country && !isSamePlace(region, country)) {
    return `${region}, ${country}`;
  }

  return region || country || "Current location";
}

export async function loadStoredLocation(): Promise<StoredAppLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAppLocation;
    if (
      typeof parsed.label !== "string" ||
      typeof parsed.lat !== "number" ||
      typeof parsed.lng !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveStoredLocation(location: StoredAppLocation) {
  await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
}

export async function requestLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

export async function getCurrentCoordinates() {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error("Turn on location services to use this feature.");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

export async function reverseGeocodeDetails(
  lat: number,
  lng: number,
): Promise<{ label: string; isoCountryCode: string | null }> {
  const results = await Location.reverseGeocodeAsync({
    latitude: lat,
    longitude: lng,
  });

  if (!results.length) {
    return { label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, isoCountryCode: null };
  }

  const merged = mergeGeocodeResults(results);
  const label = formatGeocodeAddress(merged);
  const isoCountryCode = merged.isoCountryCode?.trim().toUpperCase() ?? null;
  return { label, isoCountryCode };
}

export async function reverseGeocodeLabel(lat: number, lng: number) {
  const { label } = await reverseGeocodeDetails(lat, lng);
  return label;
}

export async function geocodeSearchQuery(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    throw new Error("Enter at least 2 characters.");
  }

  const results = await Location.geocodeAsync(trimmed);
  if (!results[0]) {
    throw new Error("No location found. Try a different search.");
  }

  const { latitude: lat, longitude: lng } = results[0];
  const { label, isoCountryCode } = await reverseGeocodeDetails(lat, lng).catch(
    () => ({ label: trimmed, isoCountryCode: null as string | null }),
  );

  return { lat, lng, label, isoCountryCode };
}

export async function detectDeviceLocation() {
  const granted = await requestLocationPermission();
  if (!granted) {
    throw new Error("Location permission is required to show listings near you.");
  }

  const { lat, lng } = await getCurrentCoordinates();
  const { label, isoCountryCode } = await reverseGeocodeDetails(lat, lng);

  const stored: StoredAppLocation = {
    label,
    lat,
    lng,
    isoCountryCode,
    source: "gps",
    updatedAt: Date.now(),
  };

  await saveStoredLocation(stored);
  return stored;
}

/** Re-format a stored label after app update (optional migration helper). */
export async function refreshLabelFromCoords(lat: number, lng: number) {
  return reverseGeocodeLabel(lat, lng);
}

/**
 * Returns up to `maxResults` distinct geocoded suggestions for `query`.
 * Used by LocationAutocompleteInput.
 */
export async function geocodeQuerySuggestions(
  query: string,
  maxResults = 5,
): Promise<Array<{ label: string; lat: number; lng: number; isoCountryCode: string | null }>> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const results = await Location.geocodeAsync(trimmed);
  const sliced = results.slice(0, maxResults);

  const details = await Promise.all(
    sliced.map(async ({ latitude: lat, longitude: lng }) => {
      const { label, isoCountryCode } = await reverseGeocodeDetails(lat, lng).catch(() => ({
        label: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
        isoCountryCode: null as string | null,
      }));
      return { label, lat, lng, isoCountryCode };
    }),
  );

  // Deduplicate by label
  const seen = new Set<string>();
  return details.filter((s) => {
    const key = s.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
