import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { ListifyFonts } from "@/constants/typography";
import type { ListingItem } from "@/features/listing/services/listing-api";
import { Image } from "@/lib/nativewind-interop";

function formatEventDate(dateStr?: string, timeStr?: string): string {
  const parts: string[] = [];
  if (dateStr) {
    try {
      const d = new Date(dateStr);
      parts.push(
        d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      );
    } catch {
      parts.push(dateStr);
    }
  }
  if (timeStr) parts.push(timeStr);
  return parts.join(" · ");
}

type EventListingCardProps = {
  event: ListingItem;
  priceLabel: string;
  isSaved: boolean;
  onPress: () => void;
  onToggleSave: () => void;
};

export function EventListingCard({
  event,
  priceLabel,
  isSaved,
  onPress,
  onToggleSave,
}: EventListingCardProps) {
  const eventDate = (event as { eventDate?: string }).eventDate ?? "";
  const eventTime = (event as { eventTime?: string }).eventTime ?? "";
  const dateLabel = formatEventDate(eventDate, eventTime);
  const featured = (event as { featured?: boolean }).featured;

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-2xl bg-white"
      style={({ pressed }) => ({
        opacity: pressed ? 0.96 : 1,
        borderWidth: 1,
        borderColor: "#F0F0F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      })}
    >
      <View className="relative h-48 w-full bg-[#F3F4F6]">
        {event.images?.[0] ? (
          <Image
            source={event.images[0]}
            contentFit="cover"
            className="h-full w-full"
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <MaterialIcons name="event" size={40} color="#D1D5DB" />
          </View>
        )}
        {featured ? (
          <View className="absolute left-3 top-3 rounded-md bg-[#27BB97] px-2 py-1">
            <Text
              className="text-[10px] text-white"
              style={{ fontFamily: ListifyFonts.bold }}
            >
              FEATURED
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={onToggleSave}
          className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-white/95"
        >
          <MaterialIcons
            name={isSaved ? "bookmark" : "bookmark-border"}
            size={20}
            color={isSaved ? "#27BB97" : "#1A1A1A"}
          />
        </Pressable>
      </View>

      <View className="p-4">
        <Text
          numberOfLines={2}
          className="text-[17px] text-[#1A1A1A]"
          style={{ fontFamily: ListifyFonts.semiBold }}
        >
          {event.title}
        </Text>
        {dateLabel ? (
          <View className="mt-2 flex-row items-center gap-1">
            <MaterialIcons name="schedule" size={15} color="#27BB97" />
            <Text
              className="text-[13px] text-[#6B7280]"
              style={{ fontFamily: ListifyFonts.regular }}
            >
              {dateLabel}
            </Text>
          </View>
        ) : null}
        {event.location ? (
          <View className="mt-1 flex-row items-center gap-1">
            <MaterialIcons name="location-on" size={15} color="#9CA3AF" />
            <Text
              numberOfLines={1}
              className="flex-1 text-[13px] text-[#9CA3AF]"
              style={{ fontFamily: ListifyFonts.regular }}
            >
              {event.location}
            </Text>
          </View>
        ) : null}
        <Text
          className="mt-3 text-[18px] text-[#27BB97]"
          style={{ fontFamily: ListifyFonts.bold }}
        >
          {priceLabel}
        </Text>
      </View>
    </Pressable>
  );
}
