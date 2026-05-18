import { MaterialIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ListifyFonts, ListifyTypography } from "@/constants/typography";
import { Image } from "@/lib/nativewind-interop";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ListingItemsGridCardProps = {
  title: string;
  subtitle?: string;
  price?: number | null;
  image?: string;
  width: number;
  isSaved?: boolean;
  onPress: () => void;
  onToggleSave?: () => void;
};

export function ListingItemsGridCard({
  title,
  subtitle,
  price,
  image,
  width,
  isSaved = false,
  onPress,
  onToggleSave,
}: ListingItemsGridCardProps) {
  const imageSize = width;
  const savedProgress = useSharedValue(isSaved ? 1 : 0);

  useEffect(() => {
    savedProgress.value = withSpring(isSaved ? 1 : 0, {
      damping: 14,
      stiffness: 220,
    });
  }, [isSaved, savedProgress]);

  const buttonBgStyle = useAnimatedStyle(() => ({
    backgroundColor: savedProgress.value > 0.5 ? "#27BB97" : "#2D2D2D",
    transform: [
      {
        scale: interpolate(savedProgress.value, [0, 0.5, 1], [1, 1.12, 1]),
      },
    ],
  }));

  const plusIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(savedProgress.value, [0, 0.4], [1, 0]),
    transform: [
      { scale: interpolate(savedProgress.value, [0, 1], [1, 0.4]) },
      { rotate: `${interpolate(savedProgress.value, [0, 1], [0, -90])}deg` },
    ],
  }));

  const checkIconStyle = useAnimatedStyle(() => ({
    opacity: savedProgress.value,
    transform: [
      { scale: interpolate(savedProgress.value, [0, 1], [0.3, 1]) },
    ],
  }));

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-[24px] bg-white px-3.5 pb-4"
      style={{
        width,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <View className="items-center justify-center" style={{ height: imageSize }}>
        {image ? (
          <Image
            source={image}
            contentFit="cover"
            transition={200}
            style={{
              width: imageSize,
              height: imageSize,
              alignSelf: "center",
            }}
          />
        ) : (
          <View
            className="items-center justify-center rounded-2xl bg-[#F3F4F6]"
            style={{ width: imageSize, height: imageSize }}
          >
            <MaterialIcons name="image" size={36} color="#D1D5DB" />
          </View>
        )}
      </View>

      <Text
        className="mt-3 text-[15px]"
        style={{ fontFamily: ListifyFonts.medium, color: "#1A1A1A" }}
        numberOfLines={2}
      >
        {title}
      </Text>

      {subtitle ? (
        <Text
          className="mt-0.5 text-[12px]"
          style={ListifyTypography.label}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}

      <View className="mt-3 flex-row items-end justify-between">
        <Text
          className="text-[17px]"
          style={{ fontFamily: ListifyFonts.bold, color: "#1A1A1A" }}
        >
          {price != null
            ? `₹${Number(price).toLocaleString("en-IN")}`
            : "On request"}
        </Text>

        <AnimatedPressable
          onPress={(e) => {
            e.stopPropagation();
            onToggleSave?.();
          }}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={buttonBgStyle}
        >
          <Animated.View
            style={[{ position: "absolute" }, plusIconStyle]}
            pointerEvents="none"
          >
            <MaterialIcons name="add" size={20} color="#FFFFFF" />
          </Animated.View>
          <Animated.View
            style={[{ position: "absolute" }, checkIconStyle]}
            pointerEvents="none"
          >
            <MaterialIcons name="check" size={20} color="#FFFFFF" />
          </Animated.View>
        </AnimatedPressable>
      </View>
    </Pressable>
  );
}
