/**
 * Map preview for the post-ad location section.
 *
 * UX flow:
 * 1. Renders a shimmer skeleton immediately (no CLS)
 * 2. When lat/lng are available, loads a static map tile image
 * 3. Fades in the tile image with an Animated opacity transition
 * 4. Shows a retry button if tile fails to load (with fallback provider)
 * 5. Falls back to a text placeholder if no coordinates
 */
import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { ListifyFonts } from "@/constants/typography";
import { Image } from "@/lib/nativewind-interop";

type MapPreviewProps = {
  lat: number | null | undefined;
  lng: number | null | undefined;
  locationLabel?: string;
  height?: number;
};

/**
 * Multiple static map providers for reliability.
 * Primary: Google Maps Static API (production-grade, CDN-backed)
 * Fallback: Geoapify (if Google key unavailable)
 */
import { buildMapPreviewUrl } from "@/lib/map-tiles";

function buildMapTileUrl(lat: number, lng: number, attempt: number): string | null {
  return buildMapPreviewUrl(lat, lng, attempt);
}

function ShimmerSkeleton({ height }: { height: number }) {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View
      style={{ height, borderRadius: 16, overflow: "hidden" }}
      className="bg-[#E8EDF0]"
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: pulseAnim,
          backgroundColor: "#D4DCE1",
          borderRadius: 16,
        }}
      />
      <View className="absolute inset-0 items-center justify-center">
        <MaterialIcons name="map" size={32} color="#B0BEC5" />
        <Text
          className="mt-1 text-[11px] text-[#90A4AE]"
          style={{ fontFamily: ListifyFonts.regular }}
        >
          Loading map...
        </Text>
      </View>
    </View>
  );
}

export function PostLocationMapPreview({
  lat,
  lng,
  locationLabel,
  height = 144,
}: MapPreviewProps) {
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const tileUrl = hasCoords ? buildMapTileUrl(lat, lng, attempt) : null;

  useEffect(() => {
    if (hasCoords) {
      setLoadState("loading");
      fadeAnim.setValue(0);
    } else {
      setLoadState("idle");
    }
  }, [hasCoords, lat, lng, fadeAnim]);

  // Reset on new attempt (retry)
  useEffect(() => {
    if (attempt > 0 && hasCoords) {
      setLoadState("loading");
      fadeAnim.setValue(0);
    }
  }, [attempt, hasCoords, fadeAnim]);

  const handleLoad = useCallback(() => {
    setLoadState("loaded");
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleError = useCallback(() => {
    // Auto-retry with next provider (up to 3 attempts)
    if (attempt < 2) {
      setAttempt((prev) => prev + 1);
    } else {
      setLoadState("error");
    }
  }, [attempt]);

  const handleRetry = useCallback(() => {
    setAttempt(0);
    setLoadState("loading");
    fadeAnim.setValue(0);
  }, [fadeAnim]);

  // No coordinates — text fallback
  if (!hasCoords) {
    return (
      <View
        style={{ height, borderRadius: 16 }}
        className="items-center justify-center bg-[#F3F4F6]"
      >
        <MaterialIcons name="map" size={36} color="#9CA3AF" />
        <Text
          className="mt-2 px-4 text-center text-[12px] text-[#6B7280]"
          style={{ fontFamily: ListifyFonts.regular }}
          numberOfLines={2}
        >
          {locationLabel || "Enter location above"}
        </Text>
      </View>
    );
  }

  // No map provider configured — show coordinates with pin
  if (!tileUrl) {
    return (
      <View
        style={{ height, borderRadius: 16 }}
        className="items-center justify-center bg-[#F0FDF4]"
      >
        <MaterialIcons name="place" size={32} color="#16A34A" />
        <Text
          className="mt-1 text-[12px] text-[#374151]"
          style={{ fontFamily: ListifyFonts.medium }}
        >
          {locationLabel || `${lat!.toFixed(4)}, ${lng!.toFixed(4)}`}
        </Text>
        <Text
          className="mt-0.5 text-[10px] text-[#9CA3AF]"
          style={{ fontFamily: ListifyFonts.regular }}
        >
          Map preview requires API key
        </Text>
      </View>
    );
  }

  // Error state with retry
  if (loadState === "error") {
    return (
      <View
        style={{ height, borderRadius: 16 }}
        className="items-center justify-center bg-[#FEF2F2]"
      >
        <MaterialIcons name="error-outline" size={28} color="#EF4444" />
        <Text
          className="mt-1 text-[12px] text-[#6B7280]"
          style={{ fontFamily: ListifyFonts.regular }}
        >
          Map failed to load
        </Text>
        <Pressable
          onPress={handleRetry}
          className="mt-2 rounded-full bg-[#1A1A1A] px-4 py-1.5"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Text
            className="text-[11px] text-white"
            style={{ fontFamily: ListifyFonts.semiBold }}
          >
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ height, borderRadius: 16, overflow: "hidden" }}>
      {/* Skeleton underneath until image loads */}
      {loadState === "loading" && <ShimmerSkeleton height={height} />}

      {/* Actual map tile — fades in on load */}
      {tileUrl && (
        <Animated.View
          style={{
            position: loadState === "loading" ? "absolute" : "relative",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: fadeAnim,
            borderRadius: 16,
            overflow: "hidden",
            height,
          }}
        >
          <Image
            source={tileUrl}
            contentFit="cover"
            onLoad={handleLoad}
            onError={handleError}
            transition={0}
            className="h-full w-full"
          />
          {/* Pin overlay */}
          <View className="absolute inset-0 items-center justify-center">
            <View className="mb-4 rounded-full bg-white/80 p-1.5 shadow">
              <MaterialIcons name="location-on" size={20} color="#EF4444" />
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
