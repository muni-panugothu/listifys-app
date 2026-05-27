/**
 * QueryChips
 *
 * Displays AI-extracted search parameters as dismissible chips below the
 * search bar. Examples:
 *   "Under ₹20K"  "Used"  "Samsung"  "Near me"  "Hyderabad"
 *
 * Each chip has an × button that clears that specific filter.
 */

import { MaterialIcons } from "@expo/vector-icons";
import { memo, useCallback } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ListifyFonts } from "@/constants/typography";

export type ParsedChip = {
  type: "price" | "condition" | "brand" | "location";
  label: string;
  key: string;
};

type Props = {
  chips: ParsedChip[];
  onRemove: (chip: ParsedChip) => void;
};

const CHIP_COLORS: Record<ParsedChip["type"], { bg: string; text: string; icon: string }> = {
  price:     { bg: "#EEF4FF", text: "#3F5EF0", icon: "#3F5EF0" },
  condition: { bg: "#F0FEF4", text: "#16A34A", icon: "#16A34A" },
  brand:     { bg: "#FFF7ED", text: "#C2410C", icon: "#C2410C" },
  location:  { bg: "#FDF4FF", text: "#9333EA", icon: "#9333EA" },
};

const CHIP_ICONS: Record<ParsedChip["type"], React.ComponentProps<typeof MaterialIcons>["name"]> = {
  price:     "attach-money",
  condition: "check-circle-outline",
  brand:     "label-outline",
  location:  "place",
};

function QueryChip({ chip, onRemove }: { chip: ParsedChip; onRemove: (c: ParsedChip) => void }) {
  const colors = CHIP_COLORS[chip.type];
  const icon   = CHIP_ICONS[chip.type];

  const handleRemove = useCallback(() => onRemove(chip), [chip, onRemove]);

  return (
    <View
      className="flex-row items-center rounded-full px-3 py-1.5 mr-2"
      style={{ backgroundColor: colors.bg }}
    >
      <MaterialIcons name={icon} size={13} color={colors.icon} style={{ marginRight: 4 }} />
      <Text
        style={{
          fontFamily: ListifyFonts.medium,
          fontSize: 12,
          color: colors.text,
          marginRight: 4,
        }}
        numberOfLines={1}
      >
        {chip.label}
      </Text>
      <Pressable onPress={handleRemove} hitSlop={8}>
        <MaterialIcons name="close" size={13} color={colors.icon} />
      </Pressable>
    </View>
  );
}

export const QueryChips = memo(function QueryChips({ chips, onRemove }: Props) {
  if (!chips || chips.length === 0) return null;

  return (
    <View className="w-full">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6 }}
        keyboardShouldPersistTaps="handled"
      >
        {chips.map((chip) => (
          <QueryChip key={chip.key + chip.label} chip={chip} onRemove={onRemove} />
        ))}
      </ScrollView>
    </View>
  );
});
