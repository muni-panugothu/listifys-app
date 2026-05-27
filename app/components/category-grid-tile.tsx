import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";

import {
  CATEGORY_TILE_VISUALS,
  type CategoryTileIcon,
} from "@/constants/category-tile-styles";
import type { CategorySlug } from "@/constants/categories";

type CategoryGridTileProps = {
  slug: CategorySlug;
  label: string;
  icon: CategoryTileIcon;
  size: number;
  onPress: () => void;
};

export function CategoryGridTile({
  slug,
  label,
  icon,
  size,
  onPress,
}: CategoryGridTileProps) {
  const visual = CATEGORY_TILE_VISUALS[slug] ?? CATEGORY_TILE_VISUALS.others;
  const iconSize = Math.round(size * 0.36);

  return (
    <Pressable
      onPress={onPress}
      className="items-center"
      style={({ pressed }) => ({ width: size, opacity: pressed ? 0.9 : 1 })}
    >
      <View
        className="overflow-hidden rounded-2xl"
        style={{
          width: size,
          height: size,
          shadowColor: visual.iconColor,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.14,
          shadowRadius: 10,
          elevation: 4,
        }}
      >
        <LinearGradient
          colors={visual.gradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -size * 0.12,
              right: -size * 0.1,
              width: size * 0.55,
              height: size * 0.55,
              borderRadius: size * 0.28,
              backgroundColor: "rgba(255,255,255,0.5)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: size * 0.08,
              left: size * 0.06,
              width: size * 0.38,
              height: size * 0.38,
              borderRadius: size * 0.19,
              backgroundColor: visual.accentOrb,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: size * 0.2,
              width: size * 0.5,
              height: size * 0.08,
              borderRadius: size * 0.04,
              backgroundColor: "rgba(0,0,0,0.07)",
            }}
          />
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: iconSize + 28,
              height: iconSize + 28,
              borderRadius: (iconSize + 28) / 2,
              backgroundColor: "rgba(255,255,255,0.72)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.9)",
              shadowColor: visual.iconColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <MaterialIcons name={icon} size={iconSize} color={visual.iconColor} />
          </View>
        </LinearGradient>
      </View>
      <Text
        className="mt-2 text-center text-[13px] font-medium text-[#3D3D3D]"
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
