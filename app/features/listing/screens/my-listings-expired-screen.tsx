import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "@/lib/safe-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchMyListings, type ListingItem } from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { FloatingBottomNav } from "@/components/floating-bottom-nav";

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

const tabs = ["Active", "Expired", "Drafts"];

export function MyListingsExpiredScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("Expired");
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyListings();
      setListings((res.listings || []).filter((l) => l.status === "expired" || l.status === "sold"));
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadListings(); }, [loadListings]));

  const { refreshing, onRefresh } = usePullToRefresh(loadListings);

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    if (tab === "Active") router.replace("/my-listings-active");
    if (tab === "Drafts") router.replace("/my-listings-drafts");
  };

  const handleBottomTabPress = useTabNavigation();

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
          <Text className="text-[20px] font-bold tracking-tight text-[#161D1A]">My Listings</Text>
        </View>
        <Pressable onPress={() => router.push("/notifications-center")} className="rounded-full p-2">
          <MaterialIcons name="notifications-none" size={24} color="#64748B" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#27BB97"]} tintColor="#27BB97" />}
        contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 84 + bottomNavPadding }}
      >
        <View className="px-4">
          {/* Tab Bar */}
          <View className="mb-8 flex-row gap-1 rounded-xl bg-[#F3F4F6] p-1">
            {tabs.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => handleTabPress(tab)}
                  className="flex-1 items-center rounded-lg py-2.5"
                  style={{
                    backgroundColor: isActive ? "#FFFFFF" : "transparent",
                    shadowColor: isActive ? "#000" : "transparent",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isActive ? 0.05 : 0,
                    shadowRadius: 2,
                    elevation: isActive ? 2 : 0,
                  }}
                >
                  <Text className="text-[12px] font-medium" style={{ color: isActive ? "#27BB97" : "#3C4A44" }}>{tab}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Loading */}
          {loading && listings.length === 0 && (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color="#27BB97" />
            </View>
          )}

          {/* Empty */}
          {!loading && listings.length === 0 && (
            <View className="items-center py-16">
              <MaterialIcons name="history" size={56} color="#CBD5E1" />
              <Text className="mt-3 text-[16px] font-semibold text-[#6C7A74]">No expired listings</Text>
              <Text className="mt-1 text-[13px] text-[#94A3B8]">Expired or sold listings will appear here</Text>
            </View>
          )}

          {/* Listings */}
          <View className="gap-6">
            {listings.map((listing) => (
              <Pressable
                key={listing._id}
                onPress={() => {
                  const cat = (listing as any)._source ?? listing.category;
                  const specialRoutes: Record<string, string> = { events: "/event-detail", properties: "/property-detail", jobs: "/job-detail", services: "/service-detail" };
                  const route = specialRoutes[cat] ? `${specialRoutes[cat]}?id=${listing._id}&category=${cat}` : `/listing-detail-template?category=${cat}&id=${listing._id}`;
                  router.push(route as any);
                }}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
              >
                {/* Image with dimmed overlay */}
                <View className="relative h-40 w-full">
                  {listing.images?.[0] ? (
                    <Image source={listing.images[0]} contentFit="cover" className="h-full w-full" style={{ opacity: 0.5 }} />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-slate-100" style={{ opacity: 0.5 }}>
                      <MaterialIcons name="image" size={40} color="#CBD5E1" />
                    </View>
                  )}
                  <View className="absolute inset-0 bg-slate-900/20" />
                  <View className="absolute left-2 top-2 rounded bg-[#EF4444] px-2 py-1">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-white">Expired</Text>
                  </View>
                </View>
                {/* Content */}
                <View className="p-4">
                  <View className="flex-row items-start justify-between">
                    <Text className="flex-1 pr-4 text-[18px] font-semibold text-[#161D1A]" numberOfLines={1}>{listing.title}</Text>
                    <Text className="text-[16px] font-bold text-[#94A3B8]">
                      {listing.price ? `₹${Number(listing.price).toLocaleString("en-IN")}` : "N/A"}
                    </Text>
                  </View>
                  <Text className="mt-1 text-[12px] font-medium text-[#EF4444]">
                    Expired {timeAgo(typeof listing.updatedAt === "string" ? listing.updatedAt : typeof listing.createdAt === "string" ? listing.createdAt : undefined)}
                  </Text>
                  <Text className="text-[12px] text-[#6C7A74]">
                    {(listing as any)._source ?? listing.category}
                  </Text>
                  {/* Stats */}
                  <View className="mt-3 flex-row gap-4">
                    <View className="flex-row items-center gap-1.5">
                      <MaterialIcons name="visibility" size={18} color="#64748B" />
                      <Text className="text-[13px] font-medium text-[#64748B]">{listing.views ?? 0} Views</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <MaterialIcons name="favorite" size={18} color="#64748B" />
                      <Text className="text-[13px] font-medium text-[#64748B]">{listing.savedBy?.length ?? 0} Saves</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <FloatingBottomNav activeTabId="profile" onTabPress={handleBottomTabPress} />
    </View>
  );
}
