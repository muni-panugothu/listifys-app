import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { ListingTimeBadge } from "@/components/listing-time-badge";
import { ListifyFonts } from "@/constants/typography";
import { type ListingItem } from "@/features/listing/services/listing-api";
import { Image } from "@/lib/nativewind-interop";

type MyListingManageCardProps = {
  listing: ListingItem;
  statusLabel: string;
  statusColor?: string;
  metaLine: string;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  dimmed?: boolean;
  showActions?: boolean;
};

export function MyListingManageCard({
  listing,
  statusLabel,
  statusColor = "#27BB97",
  metaLine,
  onPress,
  onEdit,
  onDelete,
  dimmed = false,
  showActions = true,
}: MyListingManageCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-4 overflow-hidden rounded-2xl bg-white"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="relative h-44 w-full">
        {listing.images?.[0] ? (
          <Image
            source={listing.images[0]}
            contentFit="cover"
            className="h-full w-full"
            style={dimmed ? { opacity: 0.55 } : undefined}
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-[#F6F7F8]">
            <MaterialIcons name="image" size={40} color="#D1D5DB" />
          </View>
        )}
        <ListingTimeBadge date={listing.createdAt} style={{ top: 12, left: 12 }} />
        <View
          className="absolute right-3 top-3 rounded-full px-2.5 py-1"
          style={{ backgroundColor: statusColor }}
        >
          <Text
            className="text-[10px] uppercase text-white"
            style={{ fontFamily: ListifyFonts.bold }}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <View className="p-4">
        <View className="flex-row items-start justify-between gap-3">
          <Text
            className="flex-1 text-[16px] text-[#1A1A1A]"
            style={{ fontFamily: ListifyFonts.semiBold }}
            numberOfLines={2}
          >
            {listing.title}
          </Text>
          <Text
            className="text-[16px] text-[#27BB97]"
            style={{ fontFamily: ListifyFonts.bold }}
          >
            {listing.price
              ? `₹${Number(listing.price).toLocaleString("en-IN")}`
              : "On request"}
          </Text>
        </View>
        <Text
          className="mt-1 text-[12px] text-[#9CA3AF]"
          style={{ fontFamily: ListifyFonts.regular }}
        >
          {metaLine}
        </Text>
        <View className="mt-3 flex-row gap-4">
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="visibility" size={16} color="#9CA3AF" />
            <Text
              className="text-[12px] text-[#6B7280]"
              style={{ fontFamily: ListifyFonts.medium }}
            >
              {listing.views ?? 0} views
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="favorite" size={16} color="#9CA3AF" />
            <Text
              className="text-[12px] text-[#6B7280]"
              style={{ fontFamily: ListifyFonts.medium }}
            >
              {listing.savedBy?.length ?? 0} saves
            </Text>
          </View>
        </View>
        {showActions ? (
        <View className="mt-4 flex-row gap-3 border-t border-[#F0F0F0] pt-3">
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onEdit();
            }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-[rgba(39,187,151,0.1)] py-2.5"
          >
            <MaterialIcons name="edit" size={18} color="#27BB97" />
            <Text
              className="text-[13px] text-[#27BB97]"
              style={{ fontFamily: ListifyFonts.semiBold }}
            >
              Edit
            </Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onDelete();
            }}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-red-50 py-2.5"
          >
            <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
            <Text
              className="text-[13px] text-red-500"
              style={{ fontFamily: ListifyFonts.semiBold }}
            >
              Delete
            </Text>
          </Pressable>
        </View>
        ) : null}
      </View>
    </Pressable>
  );
}
