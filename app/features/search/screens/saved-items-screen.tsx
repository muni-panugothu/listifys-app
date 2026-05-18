import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useFocusEffect, useRouter } from "@/lib/safe-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchSavedListings,
  toggleSaveListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { FloatingBottomNav } from "@/components/floating-bottom-nav";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2;

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function SavedItemsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const [items, setItems] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const handleBottomTabPress = useTabNavigation();

  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSavedListings();
      setItems(res.listings || []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadSaved(); }, [loadSaved]));

  const { refreshing, onRefresh } = usePullToRefresh(loadSaved);

  const handleUnsave = useCallback(async (item: ListingItem) => {
    try {
      const category = (item as any)._source ?? item.category ?? "electronics";
      await toggleSaveListing(category, item._id);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
    } catch { /* silently fail */ }
  }, []);

  return (
    <View className="flex-1 bg-[#F6F7F8]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
      >
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} className="rounded-full p-1">
            <MaterialIcons name="arrow-back" size={24} color="#161D1A" />
          </Pressable>
          <Text className="text-[20px] font-bold tracking-tight text-[#161D1A]">Saved Items</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#27BB97"]} tintColor="#27BB97" />}
        contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 84 + bottomNavPadding }}
      >
        <View className="px-4">
          {/* Count */}
          <Text className="mb-6 text-[14px] text-[#6C7A74]">
            <Text className="font-bold text-[#27BB97]">{items.length}</Text> saved items
          </Text>

          {/* Loading */}
          {loading && items.length === 0 && (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color="#27BB97" />
            </View>
          )}

          {/* Empty */}
          {!loading && items.length === 0 && (
            <View className="items-center py-16">
              <MaterialIcons name="favorite-border" size={56} color="#CBD5E1" />
              <Text className="mt-3 text-[16px] font-semibold text-[#6C7A74]">No saved items yet</Text>
              <Text className="mt-1 text-[13px] text-[#94A3B8]">Tap the heart icon on listings to save them</Text>
            </View>
          )}

          {/* Featured item (first) */}
          {items.length > 0 && (
            <Pressable
              onPress={() => {
                const cat = (items[0] as any)._source ?? items[0].category;
                const specialRoutes: Record<string, string> = { events: "/event-detail", properties: "/property-detail", jobs: "/job-detail", services: "/service-detail" };
                const route = specialRoutes[cat] ? `${specialRoutes[cat]}?id=${items[0]._id}&category=${cat}` : `/listing-detail-template?category=${cat}&id=${items[0]._id}`;
                router.push(route as Href);
              }}
              className="mb-4 overflow-hidden rounded-xl border border-slate-100 bg-white"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
            >
              <View className="relative h-52 w-full">
                {items[0].images?.[0] ? (
                  <Image source={items[0].images[0]} contentFit="cover" className="h-full w-full" />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-slate-100">
                    <MaterialIcons name="image" size={48} color="#CBD5E1" />
                  </View>
                )}
                <Pressable onPress={() => handleUnsave(items[0])} className="absolute right-3 top-3 rounded-full bg-white/70 p-2">
                  <MaterialIcons name="favorite" size={20} color="#EF4444" />
                </Pressable>
              </View>
              <View className="p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-[16px] font-semibold text-[#161D1A]">{items[0].title}</Text>
                    {items[0].location ? (
                      <View className="mt-1 flex-row items-center gap-1">
                        <MaterialIcons name="location-on" size={14} color="#94A3B8" />
                        <Text className="text-[12px] text-[#6C7A74]">{items[0].location}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-[18px] font-bold text-[#27BB97]">
                    {items[0].price ? `₹${Number(items[0].price).toLocaleString("en-IN")}` : "N/A"}
                  </Text>
                </View>
                <Text className="mt-2 text-[11px] text-[#94A3B8]">{timeAgo(items[0].createdAt)}</Text>
              </View>
            </Pressable>
          )}

          {/* 2-Column Grid (remaining items) */}
          <View className="flex-row flex-wrap justify-between" style={{ gap: 12 }}>
            {items.slice(1).map((item) => (
              <Pressable
                key={item._id}
                onPress={() => {
                  const cat = (item as any)._source ?? item.category;
                  const specialRoutes: Record<string, string> = { events: "/event-detail", properties: "/property-detail", jobs: "/job-detail", services: "/service-detail" };
                  const route = specialRoutes[cat] ? `${specialRoutes[cat]}?id=${item._id}&category=${cat}` : `/listing-detail-template?category=${cat}&id=${item._id}`;
                  router.push(route as Href);
                }}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white"
                style={{
                  width: CARD_WIDTH,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <View className="relative" style={{ width: CARD_WIDTH, height: CARD_WIDTH }}>
                  {item.images?.[0] ? (
                    <Image source={item.images[0]} contentFit="cover" className="h-full w-full" />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-slate-100">
                      <MaterialIcons name="image" size={32} color="#CBD5E1" />
                    </View>
                  )}
                  <Pressable onPress={() => handleUnsave(item)} className="absolute right-2 top-2 rounded-full bg-white/70 p-1.5">
                    <MaterialIcons name="favorite" size={16} color="#EF4444" />
                  </Pressable>
                </View>
                <View className="p-3">
                  <Text className="text-[14px] font-bold text-[#27BB97]">
                    {item.price ? `₹${Number(item.price).toLocaleString("en-IN")}` : "N/A"}
                  </Text>
                  <Text className="mt-0.5 text-[12px] font-medium text-[#161D1A]" numberOfLines={1}>{item.title}</Text>
                  {item.location ? (
                    <View className="mt-1 flex-row items-center gap-0.5">
                      <MaterialIcons name="location-on" size={12} color="#94A3B8" />
                      <Text className="text-[11px] text-[#6C7A74]" numberOfLines={1}>{item.location}</Text>
                    </View>
                  ) : null}
                  <Text className="mt-1 text-[10px] text-[#94A3B8]">{timeAgo(item.createdAt)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <FloatingBottomNav activeTabId="home" onTabPress={handleBottomTabPress} />
    </View>
  );
}
