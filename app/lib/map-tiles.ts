/**
 * Production map tile URL builders using Google Maps Static API.
 *
 * Requires EXPO_PUBLIC_GOOGLE_MAPS_KEY in .env
 * Free tier: $200/month credit (~28,500 static map loads/month)
 *
 * Enable these APIs in Google Cloud Console:
 * - Maps Static API
 * - Geocoding API (if needed later)
 * - Maps SDK for Android (if interactive maps needed)
 */

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

/**
 * Build a static map image URL from Google Maps.
 * Returns null if no API key is configured (graceful degradation).
 */
export function buildStaticMapUrl(
  lat: number,
  lng: number,
  options?: {
    width?: number;
    height?: number;
    zoom?: number;
    markerColor?: string;
    scale?: 1 | 2;
  },
): string | null {
  if (!GOOGLE_MAPS_KEY) return null;

  const {
    width = 800,
    height = 360,
    zoom = 15,
    markerColor = "red",
    scale = 2,
  } = options ?? {};

  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: String(scale),
    maptype: "roadmap",
    markers: `color:${markerColor}|${lat},${lng}`,
    key: GOOGLE_MAPS_KEY,
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Build map preview URL with fallback chain:
 * 1. Google Maps Static API (production — needs key)
 * 2. Geoapify free tier (fallback if Google key missing)
 *
 * The `attempt` param cycles through fallback providers on failure.
 */
export function buildMapPreviewUrl(
  lat: number,
  lng: number,
  attempt = 0,
): string | null {
  const googleUrl = buildStaticMapUrl(lat, lng);

  if (googleUrl && attempt === 0) {
    return googleUrl;
  }

  // Fallback: Geoapify (if user has a key, or demo for dev only)
  const geoapifyKey = process.env.EXPO_PUBLIC_GEOAPIFY_KEY;
  if (geoapifyKey && attempt <= 1) {
    return `https://maps.geoapify.com/v1/staticmap?style=osm-bright-smooth&width=800&height=360&center=lonlat:${lng},${lat}&zoom=15&marker=lonlat:${lng},${lat};color:%23ff0000;size:medium&apiKey=${geoapifyKey}`;
  }

  // If Google key available but first attempt failed, retry Google with different zoom
  if (googleUrl && attempt >= 1) {
    return buildStaticMapUrl(lat, lng, { zoom: 14 });
  }

  // No valid provider configured
  return null;
}

/**
 * Check if map tiles are configured for production use.
 */
export function isMapConfigured(): boolean {
  return !!GOOGLE_MAPS_KEY || !!process.env.EXPO_PUBLIC_GEOAPIFY_KEY;
}
