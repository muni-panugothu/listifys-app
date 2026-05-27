/**
 * LocationSuggestionItem
 *
 * Renders a single row in the location autocomplete list.
 * Supports two modes:
 *   "prediction" — a Google Places result with highlight support
 *   "recent"     — a locally stored past selection (shown with clock icon)
 */
import { MaterialIcons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { HighlightedText } from "@/components/highlighted-text";
import { ListifyFonts } from "@/constants/typography";
import type { MatchedSubstring, PlacePrediction, RecentLocation } from "@/lib/google-places.service";

const BRAND = "#27BB97";

// ── Prediction item ────────────────────────────────────────────────────────────

type PredictionItemProps = {
  prediction: PlacePrediction;
  onPress: (prediction: PlacePrediction) => void;
  isLast: boolean;
};

export const PlacePredictionItem = memo(function PlacePredictionItem({
  prediction,
  onPress,
  isLast,
}: PredictionItemProps) {
  const { main_text, secondary_text, main_text_matched_substrings } =
    prediction.structured_formatting;

  return (
    <Pressable
      onPress={() => onPress(prediction)}
      android_ripple={{ color: "#E6FBF4", borderless: false }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 13,
        backgroundColor: pressed ? "#F0FDF9" : "#FFFFFF",
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#F3F4F6",
      })}
    >
      <IconCircle icon="location-on" color={BRAND} bg="#ECFDF5" />

      <View style={{ flex: 1, gap: 3 }}>
        <HighlightedText
          text={main_text}
          matchedSubstrings={main_text_matched_substrings as MatchedSubstring[]}
          style={{ fontSize: 14.5, lineHeight: 20 }}
          numberOfLines={1}
        />
        {secondary_text ? (
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              color: "#6B7280",
              fontFamily: ListifyFonts.regular,
              lineHeight: 17,
            }}
          >
            {secondary_text}
          </Text>
        ) : null}
      </View>

      <MaterialIcons
        name="north-west"
        size={15}
        color="#C4C9D4"
        style={{ marginLeft: 10, flexShrink: 0 }}
      />
    </Pressable>
  );
});

// ── Recent item ────────────────────────────────────────────────────────────────

type RecentItemProps = {
  item: RecentLocation;
  onPress: (item: RecentLocation) => void;
  isLast: boolean;
};

export const RecentLocationItem = memo(function RecentLocationItem({
  item,
  onPress,
  isLast,
}: RecentItemProps) {
  return (
    <Pressable
      onPress={() => onPress(item)}
      android_ripple={{ color: "#F3F4F6", borderless: false }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 13,
        backgroundColor: pressed ? "#F9FAFB" : "#FFFFFF",
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#F3F4F6",
      })}
    >
      <IconCircle icon="history" color="#6B7280" bg="#F3F4F6" />

      <View style={{ flex: 1, gap: 3 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 14.5,
            fontFamily: ListifyFonts.medium,
            color: "#111827",
            lineHeight: 20,
          }}
        >
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              color: "#6B7280",
              fontFamily: ListifyFonts.regular,
              lineHeight: 17,
            }}
          >
            {item.subtitle}
          </Text>
        ) : null}
      </View>

      <MaterialIcons
        name="north-west"
        size={15}
        color="#C4C9D4"
        style={{ marginLeft: 10, flexShrink: 0 }}
      />
    </Pressable>
  );
});

// ── Shared icon circle ─────────────────────────────────────────────────────────

function IconCircle({
  icon,
  color,
  bg,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  color: string;
  bg: string;
}) {
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 13,
        flexShrink: 0,
      }}
    >
      <MaterialIcons name={icon} size={19} color={color} />
    </View>
  );
}
