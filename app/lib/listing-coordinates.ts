export type LatLng = {
  lat: number;
  lng: number;
};

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(c * 6371 * 10) / 10;
}

export function parseListingCoordinates(
  listing?: { coordinates?: unknown } | null,
): LatLng | null {
  const raw = listing?.coordinates;
  if (!raw || typeof raw !== "object") return null;

  const geo = raw as { coordinates?: unknown; lat?: number; lng?: number };

  if (typeof geo.lat === "number" && typeof geo.lng === "number") {
    return { lat: geo.lat, lng: geo.lng };
  }

  if (Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
    const a = Number(geo.coordinates[0]);
    const b = Number(geo.coordinates[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

    // GeoJSON: [longitude, latitude]
    if (Math.abs(a) <= 90 && Math.abs(b) > 90) {
      return { lat: a, lng: b };
    }
    return { lat: b, lng: a };
  }

  return null;
}

export function buildOpenStreetMapPreviewUrl(lat: number, lng: number) {
  const googleKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY?.trim();
  if (googleKey) {
    return (
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${lat},${lng}&zoom=15&size=600x300&scale=2` +
      `&markers=color:red%7C${lat},${lng}&key=${googleKey}`
    );
  }
  // Fallback — OSM static map (less reliable, no key required)
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=600x300&markers=${lat},${lng},lightblue1`;
}

export function buildGoogleMapsUrl(
  coords: LatLng | null,
  locationLabel?: string | null,
) {
  if (coords) {
    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  }
  if (locationLabel?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationLabel.trim())}`;
  }
  return null;
}
