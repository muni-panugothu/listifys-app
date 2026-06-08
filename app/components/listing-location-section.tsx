import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";

import { ListifyFonts } from "@/constants/typography";
import type { ListingItem } from "@/features/listing/services/listing-api";
import { geocodeSearchQuery } from "@/lib/location-service";
import {
  buildGoogleMapsUrl,
  parseListingCoordinates,
  type LatLng,
} from "@/lib/listing-coordinates";
import { buildMapPreviewUrl } from "@/lib/map-tiles";
import {
  getListingDistanceLabel,
  shouldShowListingDistance,
} from "@/lib/listing-distance";
import { Image } from "@/lib/nativewind-interop";
import { useAppSelector } from "@/store/hooks";
import {
  selectCanShowDistanceOnCards,
  selectIsoCountryCode,
  selectLocationCoords,
} from "@/store/slices/location-slice";

type ListingLocationSectionProps = {
  listing: ListingItem;
  category?: string;
};

export function ListingLocationSection({
  listing,
  category,
}: ListingLocationSectionProps) {
  const userCoords = useAppSelector(selectLocationCoords);
  const isoCountryCode = useAppSelector(selectIsoCountryCode);
  const canShowDistance = useAppSelector(selectCanShowDistanceOnCards);
  const categorySlug = category ?? listing.category;
  const showDistance =
    canShowDistance && shouldShowListingDistance(categorySlug);

  const [resolvedCoords, setResolvedCoords] = useState<LatLng | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [mapError, setMapError] = useState(false);

  const listingCoords = useMemo(
    () => parseListingCoordinates(listing),
    [listing],
  );

  const mapCoords = listingCoords ?? resolvedCoords;

  // Reset map error when coordinates change
  useEffect(() => { setMapError(false); }, [listingCoords, resolvedCoords]);

  useEffect(() => {
    if (listingCoords || !listing.location?.trim()) {
      setResolvedCoords(null);
      return;
    }

    let cancelled = false;
    setGeocoding(true);

    void geocodeSearchQuery(listing.location)
      .then((result) => {
        if (!cancelled) {
          setResolvedCoords({ lat: result.lat, lng: result.lng });
        }
      })
      .catch(() => {
        if (!cancelled) setResolvedCoords(null);
      })
      .finally(() => {
        if (!cancelled) setGeocoding(false);
      });

    return () => {
      cancelled = true;
    };
  }, [listing.location, listingCoords]);

  const distanceLabel = showDistance
    ? getListingDistanceLabel(
        {
          _id: listing._id,
          category: categorySlug,
          distance: listing.distance as number | undefined,
          coordinates: listing.coordinates,
          countryCode: listing.countryCode,
          currency: listing.currency,
        },
        userCoords.lat != null && userCoords.lng != null
          ? { lat: userCoords.lat, lng: userCoords.lng }
          : null,
        isoCountryCode,
      )
    : undefined;

  const locationText = listing.location?.trim();
  const googleMapsUrl = buildGoogleMapsUrl(mapCoords, locationText);

  if (!showDistance && !locationText && !mapCoords && !geocoding) {
    return null;
  }

  const openGoogleMaps = () => {
    if (!googleMapsUrl) return;
    void Linking.openURL(googleMapsUrl);
  };

  return (
    <View className="mt-5 px-4">
      <Text
        className="mb-3 text-[16px] text-[#1A1A1A]"
        style={{ fontFamily: ListifyFonts.bold }}
      >
        Location
      </Text>

      {(distanceLabel || locationText) ? (
        <View className="mb-3 gap-y-1.5">
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            {distanceLabel ? (
              <View className="flex-row items-center gap-1 rounded-full bg-[rgba(39,187,151,0.12)] px-3 py-1.5">
                <MaterialIcons name="near-me" size={16} color="#27BB97" />
                <Text
                  className="text-[14px] text-[#27BB97]"
                  style={{ fontFamily: ListifyFonts.semiBold }}
                >
                  {distanceLabel} away
                </Text>
              </View>
            ) : null}
            {locationText ? (
              <View className="flex-row items-center gap-1 flex-1 min-w-0">
                <MaterialIcons name="location-on" size={16} color="#6B7280" />
                <Text
                  className="flex-1 text-[14px] text-[#6B7280]"
                  style={{ fontFamily: ListifyFonts.regular }}
                  numberOfLines={2}
                >
                  {locationText}
                </Text>
              </View>
            ) : null}
          </View>
          {distanceLabel ? (
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="info-outline" size={11} color="#9CA3AF" />
              <Text
                className="text-[11px] text-[#9CA3AF]"
                style={{ fontFamily: ListifyFonts.regular }}
              >
                {"Straight-line distance \u00b7 may differ from road distance"}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={openGoogleMaps}
        disabled={!googleMapsUrl}
        className="overflow-hidden rounded-2xl bg-white"
        style={({ pressed }) => ({
          opacity: pressed ? 0.92 : 1,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 3,
        })}
      >
        <View className="relative h-44 w-full items-center justify-center bg-[#EEF2F6]">
          {geocoding ? (
            <ActivityIndicator size="large" color="#27BB97" />
          ) : mapCoords && !mapError ? (
            <Image
              source={buildMapPreviewUrl(mapCoords.lat, mapCoords.lng) ?? ""}
              contentFit="cover"
              onLoad={() => setMapError(false)}
              onError={() => setMapError(true)}
              className="h-full w-full"
            />
          ) : (
            <View className="items-center px-6">
              <MaterialIcons name="map" size={40} color="#9CA3AF" />
              <Text
                className="mt-2 text-center text-[13px] text-[#6B7280]"
                style={{ fontFamily: ListifyFonts.regular }}
              >
                {locationText ?? "Map unavailable"}
              </Text>
            </View>
          )}

          {googleMapsUrl ? (
            <View
              className="absolute bottom-3 right-3 flex-row items-center gap-1.5 rounded-full px-3 py-2"
              style={{ backgroundColor: "rgba(255,255,255,0.95)" }}
            >
              <MaterialIcons name="map" size={16} color="#4285F4" />
              <Text
                className="text-[12px] text-[#1A1A1A]"
                style={{ fontFamily: ListifyFonts.semiBold }}
              >
                Open in Google Maps
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}
