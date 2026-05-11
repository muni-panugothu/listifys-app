import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AUTH_API_BASE_URL } from "@/features/auth/services/auth-api";
import {
  addToRecentlyViewed,
  fetchListingById,
  toggleSaveListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useAppSelector } from "@/store/hooks";

export function EventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; category?: string }>();
  const user = useAppSelector((s) => s.auth.user);

  const [listing, setListing] = useState<ListingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const categorySlug = (params.category ?? "events") as string;
  const listingId = params.id;

  const loadListing = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    try {
      const res = await fetchListingById(categorySlug, listingId);
      if (res.listing) {
        setListing(res.listing);
        addToRecentlyViewed(res.listing).catch(() => {});
        if (user?.id && res.listing.savedBy?.includes(user.id)) {
          setIsSaved(true);
        }
      }
    } catch {
      // keep null
    } finally {
      setLoading(false);
    }
  }, [categorySlug, listingId, user?.id]);

  useEffect(() => {
    loadListing();
  }, [loadListing]);

  const { refreshing, onRefresh } = usePullToRefresh(loadListing);

  const handleToggleSave = useCallback(async () => {
    if (!listingId) return;
    try {
      const res = await toggleSaveListing(categorySlug, listingId);
      setIsSaved(res.saved);
    } catch {}
  }, [categorySlug, listingId]);

  const title = listing?.title ?? "";
  const description = listing?.description ?? "";
  const locationText = listing?.location ?? "";
  const price = listing?.price
    ? `${listing.currency ?? "\u20B9"}${Number(listing.price).toLocaleString("en-IN")}`
    : "Free";
  const images = listing?.images?.length ? listing.images : [];
  const subcategory = listing?.subcategory ?? "";
  const eventDate = (listing as any)?.eventDate ?? "";
  const eventTime = (listing as any)?.eventTime ?? "";
  const organizer = (listing as any)?.organizer ?? listing?.sellerName ?? "";
  const venue = (listing as any)?.venue ?? "";
  const ticketsAvailable = (listing as any)?.ticketsAvailable ?? 0;
  const ageRestriction = (listing as any)?.ageRestriction ?? "";
  const dressCode = (listing as any)?.dressCode ?? "";
  const features: string[] = (listing as any)?.features ?? [];

  const sellerName = listing?.seller?.name ?? listing?.sellerName ?? "Organizer";
  const sellerProfileImage = listing?.seller?.profileImage
    ? listing.seller.profileImage.startsWith("http")
      ? listing.seller.profileImage
      : `${AUTH_API_BASE_URL}${listing.seller.profileImage}`
    : null;
  const sellerId = listing?.seller?._id;

  const topBarHeight = insets.top + 64;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F4FBF6]">
        <ActivityIndicator size="large" color="#27BB97" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F4FBF6]">
        <MaterialIcons name="error-outline" size={48} color="#CBD5E1" />
        <Text className="mt-2 text-[14px] text-[#6C7A74]">Event not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-[14px] font-semibold text-[#27BB97]">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* TOP BAR */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{
          paddingTop: insets.top,
          height: topBarHeight,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <Pressable className="h-10 w-10 items-center justify-center" onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <MaterialIcons name="arrow-back" size={24} color="#27BB97" />
        </Pressable>
        <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">Listify</Text>
        <View className="flex-row items-center gap-4">
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="share" size={22} color="#64748B" />
          </Pressable>
          <Pressable onPress={handleToggleSave} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name={isSaved ? "favorite" : "favorite-border"} size={22} color={isSaved ? "#EF4444" : "#64748B"} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#27BB97"]} tintColor="#27BB97" progressViewOffset={topBarHeight} />}
        contentContainerStyle={{ paddingTop: topBarHeight, paddingBottom: 96 + Math.max(insets.bottom, 16) }}
      >
        {/* Event Poster */}
        {images.length > 0 ? (
          <View className="relative w-full" style={{ aspectRatio: 4 / 5 }}>
            <Image source={images[0]} contentFit="cover" transition={200} className="h-full w-full" />
            {subcategory ? (
              <View className="absolute bottom-4 left-4 rounded-full bg-[#27BB97] px-3 py-1">
                <Text className="text-[12px] font-medium uppercase tracking-wide text-white">{subcategory}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="w-full items-center justify-center bg-[#E3EAE5]" style={{ aspectRatio: 4 / 5 }}>
            <MaterialIcons name="event" size={48} color="#CBD5E1" />
          </View>
        )}

        <View className="mt-6 gap-6 px-4">
          {/* Title & Date */}
          <View className="gap-1">
            <Text className="text-[24px] font-bold leading-8 tracking-tight text-[#161D1A]">{title}</Text>
            {(eventDate || eventTime) ? (
              <View className="flex-row items-center gap-2">
                <MaterialIcons name="calendar-today" size={20} color="#6c7a74" />
                <Text className="text-[14px] leading-5 text-[#6c7a74]">
                  {[eventDate, eventTime].filter(Boolean).join(" \u2022 ")}
                </Text>
              </View>
            ) : null}
          </View>

          {/* About */}
          {description ? (
            <View className="gap-2">
              <Text className="text-[20px] font-semibold leading-7 text-[#161D1A]">About Event</Text>
              <Text className="text-[14px] leading-6 text-[#3c4a44]">{description}</Text>
            </View>
          ) : null}

          {/* Event Details */}
          <View className="gap-2">
            <Text className="text-[18px] font-semibold text-[#161D1A]">Event Details</Text>
            {venue ? (
              <View className="flex-row justify-between py-1">
                <Text className="text-[13px] text-[#6C7A74]">Venue</Text>
                <Text className="flex-1 text-right text-[13px] font-medium text-[#161D1A]">{venue}</Text>
              </View>
            ) : null}
            {locationText ? (
              <View className="flex-row justify-between py-1">
                <Text className="text-[13px] text-[#6C7A74]">Location</Text>
                <Text className="flex-1 text-right text-[13px] font-medium text-[#161D1A]">{locationText}</Text>
              </View>
            ) : null}
            {ticketsAvailable > 0 ? (
              <View className="flex-row justify-between py-1">
                <Text className="text-[13px] text-[#6C7A74]">Tickets Available</Text>
                <Text className="text-[13px] font-medium text-[#161D1A]">{ticketsAvailable}</Text>
              </View>
            ) : null}
            {ageRestriction ? (
              <View className="flex-row justify-between py-1">
                <Text className="text-[13px] text-[#6C7A74]">Age Restriction</Text>
                <Text className="text-[13px] font-medium text-[#161D1A]">{ageRestriction}</Text>
              </View>
            ) : null}
            {dressCode ? (
              <View className="flex-row justify-between py-1">
                <Text className="text-[13px] text-[#6C7A74]">Dress Code</Text>
                <Text className="text-[13px] font-medium text-[#161D1A]">{dressCode}</Text>
              </View>
            ) : null}
          </View>

          {/* Features / Highlights */}
          {features.length > 0 ? (
            <View className="gap-3">
              <Text className="text-[18px] font-semibold text-[#161D1A]">Highlights</Text>
              <View className="gap-2">
                {features.map((f, i) => (
                  <View key={i} className="flex-row gap-3">
                    <MaterialIcons name="star" size={18} color="#CBA100" style={{ marginTop: 2 }} />
                    <Text className="flex-1 text-[14px] leading-5 text-[#3c4a44]">{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Organizer */}
          <Pressable
            onPress={() => { if (sellerId) router.push(`/seller-public-profile?userId=${sellerId}` as Href); }}
            className="flex-row items-center justify-between rounded-xl border border-[#bbcac3]/20 bg-[#e9efeb] p-4"
          >
            <View className="flex-row items-center gap-3">
              {sellerProfileImage ? (
                <View className="h-12 w-12 overflow-hidden rounded-full border-2 border-white">
                  <Image source={sellerProfileImage} contentFit="cover" transition={200} className="h-full w-full" />
                </View>
              ) : (
                <View className="h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-[#d1ded5]">
                  <MaterialIcons name="person" size={24} color="#6C7A74" />
                </View>
              )}
              <View>
                <Text className="text-[18px] font-semibold leading-6 text-[#161D1A]">{organizer || sellerName}</Text>
                <Text className="text-[12px] font-medium tracking-wide text-[#6c7a74]">Organizer</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#6C7A74" />
          </Pressable>
        </View>
      </ScrollView>

      {/* Footer */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 flex-row items-center justify-between border-t border-slate-100 bg-white/95 px-4"
        style={{
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 12),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View>
          <Text className="text-[12px] font-medium tracking-wide text-[#6c7a74]">Price per ticket</Text>
          <Text className="text-[20px] font-bold leading-6 text-[#161D1A]">{price}</Text>
        </View>

        <Pressable
          onPress={() => {
            if (sellerId) {
              router.push(
                `/chat-conversation?recipientId=${sellerId}&listingId=${listing._id}&listingType=${categorySlug}&listingTitle=${encodeURIComponent(title)}&listingPrice=${listing.price ?? ""}&listingImage=${encodeURIComponent(listing.images?.[0] ?? "")}&currency=${encodeURIComponent(listing.currency ?? "₹")}` as Href,
              );
            }
          }}
          className="overflow-hidden rounded-lg"
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }], shadowColor: "#27BB97", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 })}
        >
          <LinearGradient
            colors={["#27BB97", "#1E9E7E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24 }}
          >
            <Text className="text-[16px] font-semibold text-white">Book Tickets</Text>
            <MaterialIcons name="confirmation-number" size={20} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
