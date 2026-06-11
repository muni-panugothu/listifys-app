import { MaterialIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ListifyFonts } from "@/constants/typography";
import { formatPrice as libFormatPrice } from "@/lib/currency";
import { Image } from "@/lib/nativewind-interop";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ServiceGridCardProps = {
  title: string;
  subcategory?: string;
  price?: number | null;
  priceType?: string;
  currency?: string | null;
  isoCountryCode?: string | null;
  image?: string;
  rating?: number | null;
  reviewCount?: number | null;
  width: number;
  distanceLabel?: string;
  isSaved?: boolean;
  onPress: () => void;
  onToggleSave?: () => void;
};

const UNIT_MAP: Record<string, string> = {
  fixed: "",
  Fixed: "",
  "Fixed Quote": "",
  hourly: "/hr",
  Hourly: "/hr",
  "Per Hour": "/hr",
  daily: "/day",
  Daily: "/day",
  "Per Day": "/day",
  weekly: "/wk",
  monthly: "/mo",
  Monthly: "/mo",
  "Per Month": "/mo",
  "Per Visit": "/visit",
  project: "/project",
  "Per Project": "/project",
  Negotiable: "",
};

export function ServiceGridCard({
  title,
  subcategory,
  price,
  priceType,
  currency,
  isoCountryCode,
  image,
  rating,
  reviewCount,
  width,
  distanceLabel,
  isSaved = false,
  onPress,
  onToggleSave,
}: ServiceGridCardProps) {
  const IMAGE_HEIGHT = Math.round(width * 1.25); // 4:5 aspect ratio
  const savedProgress = useSharedValue(isSaved ? 1 : 0);

  useEffect(() => {
    savedProgress.value = withSpring(isSaved ? 1 : 0, { damping: 14, stiffness: 220 });
  }, [isSaved, savedProgress]);

  const plusIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(savedProgress.value, [0, 0.4], [1, 0]),
    transform: [
      { scale: interpolate(savedProgress.value, [0, 1], [1, 0.4]) },
      { rotate: `${interpolate(savedProgress.value, [0, 1], [0, -90])}deg` },
    ],
  }));

  const checkIconStyle = useAnimatedStyle(() => ({
    opacity: savedProgress.value,
    transform: [{ scale: interpolate(savedProgress.value, [0, 1], [0.3, 1]) }],
  }));

  const priceBase = price != null ? libFormatPrice(price, currency, isoCountryCode) : null;
  const priceUnit = priceType ? (UNIT_MAP[priceType] ?? "") : "";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(226, 232, 240, 0.8)",
        opacity: pressed ? 0.96 : 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      {/* ── Image ── */}
      <View style={{ height: IMAGE_HEIGHT, width, overflow: "hidden" }}>
        {image ? (
          <Image
            source={image}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={image}
            transition={120}
            style={{ width, height: IMAGE_HEIGHT }}
          />
        ) : (
          <View
            style={{
              width,
              height: IMAGE_HEIGHT,
              backgroundColor: "#F0FBFF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcons name="home-repair-service" size={44} color="#B8E8F4" />
          </View>
        )}

        {/* Glass save button – top right */}
        {onToggleSave && (
          <AnimatedPressable
            onPress={(e) => {
              e.stopPropagation();
              onToggleSave();
            }}
            hitSlop={8}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "rgba(255, 255, 255, 0.85)",
              borderWidth: 1,
              borderColor: "rgba(243, 244, 246, 1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View style={[{ position: "absolute" }, plusIconStyle]} pointerEvents="none">
              <MaterialIcons name="add" size={17} color="#374151" />
            </Animated.View>
            <Animated.View style={[{ position: "absolute" }, checkIconStyle]} pointerEvents="none">
              <MaterialIcons name="check" size={17} color="#27BB97" />
            </Animated.View>
          </AnimatedPressable>
        )}

        {/* Star rating badge – bottom left */}
        {rating != null && (
          <View
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              backgroundColor: "rgba(255, 255, 255, 0.85)",
              borderWidth: 1,
              borderColor: "rgba(243, 244, 246, 1)",
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}
          >
            <MaterialIcons name="star" size={12} color="#F59E0B" />
            <Text
              style={{
                fontFamily: ListifyFonts.bold,
                fontSize: 12,
                color: "#111827",
                ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
              }}
            >
              {typeof rating === "number" ? rating.toFixed(1) : rating}
            </Text>
          </View>
        )}
      </View>

      {/* ── Info section ── */}
      <View style={{ padding: 11, gap: 4 }}>
        {/* Subcategory – green uppercase */}
        {subcategory ? (
          <Text
            style={{
              fontFamily: ListifyFonts.semiBold,
              fontSize: 10,
              color: "#27BB97",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
            }}
            numberOfLines={1}
          >
            {subcategory}
          </Text>
        ) : null}

        {/* Title */}
        <Text
          style={{
            fontFamily: ListifyFonts.semiBold,
            fontSize: 15,
            color: "#161D1A",
            lineHeight: 21,
            ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
          }}
          numberOfLines={1}
        >
          {title}
        </Text>

        {/* Reviews count */}
        {reviewCount != null && reviewCount > 0 ? (
          <Text
            style={{
              fontFamily: ListifyFonts.regular,
              fontSize: 11,
              color: "#94A3B8",
              ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
            }}
          >
            {reviewCount.toLocaleString()} Reviews
          </Text>
        ) : null}

        {/* Price row */}
        {priceBase != null ? (
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2, marginTop: 2 }}>
            <Text
              style={{
                fontFamily: ListifyFonts.bold,
                fontSize: 16,
                color: "#161D1A",
                ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
              }}
            >
              {priceBase}
            </Text>
            {priceUnit ? (
              <Text
                style={{
                  fontFamily: ListifyFonts.regular,
                  fontSize: 10,
                  color: "#94A3B8",
                  ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
                }}
              >
                {priceUnit}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text
            style={{
              fontFamily: ListifyFonts.medium,
              fontSize: 13,
              color: "#94A3B8",
              ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
            }}
          >
            On request
          </Text>
        )}
        {distanceLabel ? (
          <Text
            style={{
              marginTop: 4,
              fontFamily: ListifyFonts.medium,
              fontSize: 12,
              color: "#6B7280",
              ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
            }}
            numberOfLines={1}
          >
            {distanceLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
