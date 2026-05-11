import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "@/lib/safe-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchMyListings, type ListingItem } from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";

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

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function MyListingsDraftScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("Drafts");
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyListings();
      setListings((res.listings || []).filter((l) => l.status === "draft"));
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
    if (tab === "Expired") router.replace("/my-listings-expired");
  };

  const handleBottomTabPress = useTabNavigation();

  return (
    <View className="flex-1 bg-[#F4FBF6]">
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
          <View className="mb-8 flex-row gap-1 rounded-xl bg-[#EFF5F0] p-1">
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
              <MaterialIcons name="edit-note" size={56} color="#CBD5E1" />
              <Text className="mt-3 text-[16px] font-semibold text-[#6C7A74]">No drafts</Text>
              <Text className="mt-1 text-[13px] text-[#94A3B8]">Saved drafts will appear here</Text>
              <Pressable onPress={() => router.push("/sell-entry")} className="mt-4 rounded-lg bg-[#27BB97] px-6 py-2.5">
                <Text className="text-[14px] font-semibold text-white">Create Listing</Text>
              </Pressable>
            </View>
          )}

          {/* Listings */}
          <View className="gap-6">
            {listings.map((listing) => (
              <Pressable
                key={listing._id}
                onPress={() => router.push(`/edit-listing?id=${listing._id}` as any)}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
              >
                {/* Image / Placeholder */}
                <View className="relative h-40 w-full">
                  {listing.images?.[0] ? (
                    <Image source={listing.images[0]} contentFit="cover" className="h-full w-full" style={{ opacity: 0.7 }} />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-[#EFF5F0]">
                      <MaterialIcons name="image" size={48} color="#BBCAC3" />
                      <Text className="mt-1 text-[12px] text-[#BBCAC3]">No photo yet</Text>
                    </View>
                  )}
                  <View className="absolute left-2 top-2 rounded bg-[#F59E0B] px-2 py-1">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-white">Draft</Text>
                  </View>
                </View>
                {/* Content */}
                <View className="p-4">
                  <View className="flex-row items-start justify-between">
                    <Text className="flex-1 pr-4 text-[18px] font-semibold text-[#161D1A]" numberOfLines={1}>
                      {listing.title || "Untitled Draft"}
                    </Text>
                    <Text className="text-[16px] font-bold text-[#6C7A74]">
                      {listing.price ? `₹${Number(listing.price).toLocaleString("en-IN")}` : "—"}
                    </Text>
                  </View>
                  <Text className="mt-1 text-[12px] text-[#6C7A74]">
                    {(listing as any)._source ?? listing.category ?? "Uncategorized"} • Edited {timeAgo(listing.updatedAt ?? listing.createdAt)}
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
      <View className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-100 bg-white" style={{ paddingTop: 12, paddingBottom: bottomNavPadding, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 8 }}>
        <View className="flex-row items-end justify-around px-2">
          {bottomTabs.map((tab) => {
            if (tab.highlight) {
              return (
                <Pressable key={tab.id} onPress={() => handleBottomTabPress(tab.id)} className="items-center justify-center" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <View className="-mt-7 rounded-full border-4 border-[#F4FBF6] bg-[#27BB97] p-2.5" style={{ shadowColor: "#27BB97", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}>
                    <MaterialIcons name={tab.icon} size={24} color="#FFFFFF" />
                  </View>
                  <Text className="mt-1 text-[11px] font-medium tracking-wide text-slate-400">{tab.label}</Text>
                </Pressable>
              );
            }
            return (
              <Pressable key={tab.id} onPress={() => handleBottomTabPress(tab.id)} className="items-center py-1" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <MaterialIcons name={tab.icon} size={24} color="#94A3B8" />
                <Text className="text-[11px] font-medium tracking-wide text-[#94A3B8]">{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
