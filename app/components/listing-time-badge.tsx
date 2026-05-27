import { Platform, Text, View, type ViewStyle } from "react-native";

import { ListifyFonts } from "@/constants/typography";
import { formatTimeAgo } from "@/lib/format-time-ago";

type ListingTimeBadgeProps = {
  date?: string | null;
  style?: ViewStyle;
};

export function ListingTimeBadge({ date, style }: ListingTimeBadgeProps) {
  const label = formatTimeAgo(date);
  if (!label) return null;

  return (
    <View
      style={[
        {
          position: "absolute",
          left: 8,
          top: 8,
          zIndex: 2,
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 3,
          elevation: 2,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: ListifyFonts.medium,
          fontSize: 11,
          color: "#1A1A1A",
          lineHeight: 14,
          ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
        }}
      >
        {label}
      </Text>
    </View>
  );
}
