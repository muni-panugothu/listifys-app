import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { CATEGORY_TILE_VISUALS } from "@/constants/category-tile-styles";
import { ListifyTypography } from "@/constants/typography";
import type { CategorySlug } from "@/constants/categories";
import type { ComponentProps } from "react";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

type HomeCategoryTileProps = {
  slug: CategorySlug;
  label: string;
  icon: IconName;
  size: number;
  onPress: () => void;
};

export function HomeCategoryTile({
  slug,
  label,
  icon,
  size,
  onPress,
}: HomeCategoryTileProps) {
  const visual = CATEGORY_TILE_VISUALS[slug] ?? CATEGORY_TILE_VISUALS.others;
  const tileHeight = size * 0.88;

  return (
    <Pressable
      onPress={onPress}
      className="items-center"
      style={({ pressed }) => ({ width: size, opacity: pressed ? 0.88 : 1 })}
    >
      <View
        className="items-center justify-center rounded-2xl bg-white"
        style={{
          width: size,
          height: tileHeight,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <MaterialIcons name={icon} size={30} color={visual.iconColor} />
      </View>
      <Text
        className="mt-2 text-center text-[11px] leading-[14px]"
        style={[ListifyTypography.caption, { width: size, minHeight: 28 }]}
        numberOfLines={2}
        adjustsFontSizeToFit={false}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type HomeCategoryMoreTileProps = {
  size: number;
  onPress: () => void;
};

export function HomeCategoryMoreTile({ size, onPress }: HomeCategoryMoreTileProps) {
  const tileHeight = size * 0.88;

  return (
    <Pressable
      onPress={onPress}
      className="items-center"
      style={({ pressed }) => ({ width: size, opacity: pressed ? 0.88 : 1 })}
    >
      <View
        className="items-center justify-center rounded-2xl"
        style={{
          width: size,
          height: tileHeight,
          backgroundColor: "#E3F5C3",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <MaterialIcons name="apps" size={30} color="#3D5A2C" />
      </View>
      <Text
        className="mt-2 text-center text-[11px] leading-[14px]"
        style={[ListifyTypography.caption, { width: size, minHeight: 28 }]}
        numberOfLines={2}
      >
        More
      </Text>
    </Pressable>
  );
}
