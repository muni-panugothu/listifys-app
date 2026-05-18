import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { ListifyTypography } from "@/constants/typography";
import { Image } from "@/lib/nativewind-interop";

type TrendingListingCardProps = {
  id: string;
  title: string;
  price?: number | null;
  image: string;
  cardWidth: number;
  isSaved: boolean;
  isOffline?: boolean;
  onPress: () => void;
  onToggleSave: () => void;
};

export function TrendingListingCard({
  title,
  price,
  image,
  cardWidth,
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
        style={ListifyTypography.sectionTitle}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text className="mt-0.5 text-[16px]" style={ListifyTypography.accent}>
        {price != null ? `₹${Number(price).toLocaleString("en-IN")}` : "Price on request"}
      </Text>
    </Pressable>
  );
}
