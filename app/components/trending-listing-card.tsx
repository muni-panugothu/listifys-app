import { MaterialIcons } from "@expo/vector-icons";
import { Platform, Pressable, Text, View } from "react-native";

import { ListingTimeBadge } from "@/components/listing-time-badge";
import { ListifyTypography } from "@/constants/typography";
import { formatPrice as libFormatPrice } from "@/lib/currency";
import { Image } from "@/lib/nativewind-interop";

type TrendingListingCardProps = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  isoCountryCode?: string | null;
  image: string;
  cardWidth: number;
  distanceLabel?: string;
  createdAt?: string | null;
  isSaved: boolean;
  isOffline?: boolean;
  onPress: () => void;
  onToggleSave: () => void;
};

function formatPrice(
  price?: number | null,
  currency?: string | null,
  isoCountryCode?: string | null,
) {
  if (price == null) return "Price on request";
  return libFormatPrice(price, currency, isoCountryCode);
}

export function TrendingListingCard({
  title,
  price,
  currency,
  isoCountryCode,
  image,
  cardWidth,
  distanceLabel,
  createdAt,
  isSaved,
  isOffline,
  onPress,
  onToggleSave,
}: TrendingListingCardProps) {
  const imageHeight = cardWidth * 1.15;

  return (
    <Pressable onPress={onPress} style={{ width: cardWidth }}>
      <View
        className="overflow-hidden rounded-[28px] bg-white"
        style={{
          height: imageHeight,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1,
          shadowRadius: 14,
          elevation: 5,
        }}
      >
        <Image source={image} contentFit="cover" transition={200} className="h-full w-full" />
        <ListingTimeBadge date={createdAt} />
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          hitSlop={10}
          disabled={isOffline}
          className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full bg-white"
          style={({ pressed }) => ({
            opacity: isOffline ? 0.45 : pressed ? 0.88 : 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 6,
            elevation: 3,
          })}
        >
          <MaterialIcons
            name={isSaved ? "favorite" : "favorite-border"}
            size={22}
            color={isSaved ? "#EF4444" : "#6B7280"}
          />
        </Pressable>
      </View>
      <Text
        className="mt-3 text-[15px]"
        style={{
          ...ListifyTypography.sectionTitle,
          ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View className="mt-1 w-full">
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className="flex-1 text-[16px]"
            style={{
              ...ListifyTypography.accent,
              lineHeight: 24,
              ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
            }}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            numberOfLines={2}
          >
            {formatPrice(price, currency, isoCountryCode)}
          </Text>
          {distanceLabel ? (
            <Text
              className="shrink-0 pt-0.5 text-[13px]"
              style={{
                ...ListifyTypography.label,
                color: "#6B7280",
                lineHeight: 18,
                ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
              }}
            >
              {distanceLabel}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
