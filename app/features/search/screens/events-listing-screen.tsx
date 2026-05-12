import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "@/lib/safe-router";
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

import { CATEGORY_MAP } from "@/constants/categories";
import {
  fetchCategoryListings,
  toggleSaveListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { useAppSelector } from "@/store/hooks";

const CATEGORY_SLUG = "events" as const;
const eventConfig = CATEGORY_MAP[CATEGORY_SLUG];
const subcategories = ["All", ...(eventConfig?.subcategories ?? [])];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

function formatEventDate(dateStr?: string, timeStr?: string): string {
  if (!dateStr && !timeStr) return "";
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
  return parts.join(" \u2022 ");
}

function formatPrice(price?: number, currency?: string): string {
  if (!price || price === 0) return "FREE";
  const sym = currency ?? "\u20B9";
  return `${sym}${Number(price).toLocaleString("en-IN")}`;
}

export function EventsListingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((s) => s.auth.user);

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const topBarHeight = insets.top + 64;
  const handleBottomTabPress = useTabNavigation();

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCategoryListings(CATEGORY_SLUG, {
        subcategory: selectedCategory === "All" ? undefined : selectedCategory,
      });
      const items = res.listings ?? [];
      setListings(items);
      if (user?.id) {
        const saved = new Set<string>();
        for (const item of items) {
          if (item.savedBy?.includes(user.id)) saved.add(item._id);
        }
        setSavedIds(saved);
      }
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, user?.id]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const handleRefresh = useCallback(async () => {
    try {
      const res = await fetchCategoryListings(CATEGORY_SLUG, {
        subcategory: selectedCategory === "All" ? undefined : selectedCategory,
      });
      const items = res.listings ?? [];
      setListings(items);
      if (user?.id) {
        const saved = new Set<string>();
        for (const item of items) {
          if (item.savedBy?.includes(user.id)) saved.add(item._id);
        }
        setSavedIds(saved);
      }
    } catch {
      // keep existing
    }
  }, [selectedCategory, user?.id]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const handleToggleSave = useCallback(
    async (id: string) => {
      try {
        const res = await toggleSaveListing(CATEGORY_SLUG, id);
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (res.saved) next.add(id);
          else next.delete(id);
          return next;
        });
      } catch {}
    },
    [],
  );

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* ===== TOP APP BAR ===== */}
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
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={22} color="#0F172A" />
          </Pressable>
          <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
            Events
          </Text>
        </View>
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={() => router.push("/search-home")}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="search" size={24} color="#64748B" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/notifications-center")}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons
              name="notifications-none"
              size={24}
              color="#64748B"
            />
          </Pressable>
        </View>
      </View>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#27BB97"]}
            tintColor="#27BB97"
            progressViewOffset={topBarHeight}
          />
        }
        contentContainerStyle={{
          paddingTop: topBarHeight + 16,
          paddingBottom: 80 + Math.max(insets.bottom, 16),
          paddingHorizontal: 16,
        }}
      >
        {/* Page Title */}
        <Text className="mb-4 text-[24px] font-bold tracking-tight text-[#161D1A]">
          Upcoming Events
        </Text>

        {/* Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          className="mb-6"
        >
          {subcategories.map((chip) => {
            const isActive = selectedCategory === chip;
            return (
              <Pressable
                key={chip}
                onPress={() => setSelectedCategory(chip)}
                className="rounded-full px-5 py-2"
                style={
                  isActive
                    ? { backgroundColor: "#161D1A" }
                    : {
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1,
                        borderColor: "rgba(187,202,195,0.3)",
                      }
                }
              >
                <Text
                  className="text-[12px] font-medium tracking-wide"
                  style={{ color: isActive ? "#FFFFFF" : "#161D1A" }}
                >
                  {chip}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Event Cards */}
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#27BB97" />
            <Text className="mt-3 text-[14px] text-[#6C7A74]">Loading events...</Text>
          </View>
        ) : listings.length === 0 ? (
          <View className="items-center py-16">
            <MaterialIcons name="event-busy" size={56} color="#CBD5E1" />
            <Text className="mt-3 text-[16px] font-semibold text-[#161D1A]">
              No events found
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#6C7A74]">
              Be the first to post an event!
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {listings.map((event) => {
              const eventDate = (event as any).eventDate ?? "";
              const eventTime = (event as any).eventTime ?? "";
              const isSaved = savedIds.has(event._id);
              const priceLabel = formatPrice(event.price, event.currency);
              const dateLabel = formatEventDate(eventDate, eventTime);
              const featured = (event as any).featured;

              return (
                <Pressable
                  key={event._id}
                  onPress={() =>
                    router.push(
                      `/event-detail?id=${event._id}&category=events` as Href,
                    )
                  }
                  className="overflow-hidden rounded-xl border border-slate-100 bg-white"
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 3,
                    elevation: 2,
                  })}
                >
                  {/* Event Image */}
                  <View className="relative h-56 w-full">
                    {event.images?.[0] ? (
                      <Image
                        source={event.images[0]}
                        contentFit="cover"
                        transition={200}
                        className="h-full w-full"
                      />
                    ) : (
                      <View className="h-full w-full items-center justify-center bg-[#E3EAE5]">
                        <MaterialIcons name="event" size={48} color="#CBD5E1" />
                      </View>
                    )}
                    {/* Featured Badge */}
                    {featured && (
                      <View
                        className="absolute left-3 top-3 rounded-full bg-[#27BB97] px-3 py-1"
                        style={{
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.2,
                          shadowRadius: 4,
                          elevation: 4,
                        }}
                      >
                        <Text className="text-[10px] font-bold uppercase tracking-widest text-white">
                          Featured
                        </Text>
                      </View>
                    )}
                    {/* Subcategory Badge */}
                    {event.subcategory && !featured ? (
                      <View className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1">
                        <Text className="text-[10px] font-medium uppercase tracking-wide text-white">
                          {event.subcategory}
                        </Text>
                      </View>
                    ) : null}
                    {/* Favorite Button */}
                    <Pressable
                      onPress={() => handleToggleSave(event._id)}
                      className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-white/70"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <MaterialIcons
                        name={isSaved ? "favorite" : "favorite-border"}
                        size={20}
                        color={isSaved ? "#EF4444" : "#161D1A"}
                      />
                    </Pressable>
                  </View>

                  {/* Event Info */}
                  <View className="p-4">
                    {/* Date/Time */}
                    {dateLabel ? (
                      <View className="mb-1 flex-row items-center gap-1">
                        <MaterialIcons name="schedule" size={14} color="#27BB97" />
                        <Text className="text-[12px] font-medium tracking-wide text-[#27BB97]">
                          {dateLabel}
                        </Text>
                      </View>
                    ) : null}

                    {/* Title */}
                    <Text
                      numberOfLines={2}
                      className="mb-1 text-[18px] font-semibold leading-6 text-[#161D1A]"
                    >
                      {event.title}
                    </Text>

                    {/* Location */}
                    {event.location ? (
                      <View className="mb-4 flex-row items-center gap-1">
                        <MaterialIcons name="location-on" size={16} color="#6c7a74" />
                        <Text
                          numberOfLines={1}
                          className="flex-1 text-[14px] leading-5 text-[#6c7a74]"
                        >
                          {event.location}
                        </Text>
                      </View>
                    ) : null}

                    {/* Price & Action */}
                    <View className="flex-row items-end justify-between border-t border-slate-50 pt-3">
                      <View>
                        <Text className="text-[12px] font-medium tracking-wide text-[#6c7a74]">
                          Entry Price
                        </Text>
                        <Text className="text-[16px] font-bold leading-5 text-[#161D1A]">
                          {priceLabel}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          router.push(
                            `/event-detail?id=${event._id}&category=events` as Href,
                          )
                        }
                        className="rounded-lg bg-[#27BB97] px-6 py-2"
                        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                      >
                        <Text className="text-[12px] font-semibold text-white">
                          View Details
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ===== BOTTOM NAVIGATION BAR ===== */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-100 bg-white"
        style={{
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View className="flex-row items-end justify-around px-2">
          {bottomTabs.map((tab) => {
            if (tab.highlight) {
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => handleBottomTabPress(tab.id)}
                  className="items-center justify-center"
                >
                  <View
                    className="-mt-7 rounded-full border-4 border-[#F4FBF6] bg-[#27BB97] p-2.5"
                    style={{
                      shadowColor: "#27BB97",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <MaterialIcons name={tab.icon} size={24} color="#FFFFFF" />
                  </View>
                  <Text className="mt-1 text-[11px] font-medium tracking-wide text-slate-400">
                    {tab.label}
                  </Text>
                </Pressable>
              );
            }

            return (
              <Pressable
                key={tab.id}
                onPress={() => handleBottomTabPress(tab.id)}
                className="items-center justify-center py-1"
              >
                <MaterialIcons
                  name={tab.icon}
                  size={24}
                  color={tab.active ? "#27BB97" : "#94A3B8"}
                />
                <Text
                  className="text-[11px] font-medium tracking-wide"
                  style={{ color: tab.active ? "#27BB97" : "#94A3B8" }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
