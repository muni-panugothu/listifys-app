import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

type ExpiredListing = {
  id: string;
  title: string;
  price: string;
  category: string;
  expiredAgo: string;
  views: number;
  likes: number;
  image: string;
};

const expiredListings: ExpiredListing[] = [
  {
    id: "1",
    title: "Vintage Record Player",
    price: "₹6,500",
    category: "Electronics",
    expiredAgo: "Expired 3 days ago",
    views: 89,
    likes: 7,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBMWwjxlO1A3IpbkLt5RXBX5eoOm_8xnV2c3x68Uw9C8yEDh2jdFE_4QTNzw3H3vqfILQCbR3j_Hc7Fv4hzZd0zDI6VLJLfzKbK-XuJSR4CDNqjXdPr_JlKIBgGqQfK0KnPDRK0dCfpylC_4qxBKMVGq5xkGRr5yPWlVcjDqBbUMFcQGj",
  },
  {
    id: "2",
    title: "Mountain Bike - Trek X1",
    price: "₹18,000",
    category: "Sports",
    expiredAgo: "Expired 1 week ago",
    views: 234,
    likes: 15,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCS23_BQR_idKthAezAeDcFIDhoacF1CAF38RjLvBVBE-YTYCVmYGl1lrMab_i66GqNA2YYfwNTWLKTZGHNMh03sq8Wib7xalZ6kY_nKWg0z90fAqqWtdoCt0t7jQtaz9azz8_bqzbXR21g0szBtvT82R4o3qjUmdRnOx2_RGGxIppGgfJ9GtDs4sg",
  },
  {
    id: "3",
    title: "Ceramic Plant Pots Set",
    price: "₹1,200",
    category: "Home & Garden",
    expiredAgo: "Expired 2 weeks ago",
    views: 56,
    likes: 3,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBXuo6LzQc-Mij-_BvqApAiuGeVZjLT0p72YYK7WwfvGNiU5KVk_YPcMe5dG5C6hSyjlfjoAiq47yweiyuCU7KRlR4DtdFL8QeFjvAOPU28CWI0fkj-bczfgdeuRJd98TeOqZt6YRWFlfelf",
  },
];

const tabs = ["Active", "Expired", "Drafts"];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function MyListingsExpiredScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("Expired");
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    if (tab === "Active") router.replace("/my-listings-active");
    if (tab === "Drafts") router.replace("/my-listings-drafts");
  };

  const handleBottomTabPress = (tabId: string) => {
    if (tabId === "home") { router.push("/home-feed-root"); return; }
    if (tabId === "sell") { router.push("/sell-entry"); return; }
    if (tabId === "search") { router.push("/search-home"); return; }
    if (tabId === "messages") { router.push("/messages-inbox"); return; }
    if (tabId === "profile") { router.push("/dashboard-home"); return; }
  };

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
      >
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="storefront" size={24} color="#27BB97" />
          <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">Listify</Text>
        </View>
        <Pressable className="rounded-full p-2">
          <MaterialIcons name="notifications-none" size={24} color="#64748B" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 84 + bottomNavPadding }}
      >
        <View className="px-4">
          <Text className="mb-6 text-[24px] font-bold tracking-tight text-[#161D1A]">My Listings</Text>

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

          {/* Listings */}
          <View className="gap-6">
            {expiredListings.map((listing) => (
              <View
                key={listing.id}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
              >
                {/* Image with grayscale overlay */}
                <View className="relative h-40 w-full">
                  <Image source={listing.image} contentFit="cover" className="h-full w-full" style={{ opacity: 0.5 }} />
                  <View className="absolute inset-0 bg-slate-900/20" />
                  <View className="absolute left-2 top-2 rounded bg-[#EF4444] px-2 py-1">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-white">Expired</Text>
                  </View>
                </View>
                {/* Content */}
                <View className="p-4">
                  <View className="flex-row items-start justify-between">
                    <Text className="flex-1 pr-4 text-[18px] font-semibold text-[#161D1A]" numberOfLines={1}>{listing.title}</Text>
                    <Text className="text-[16px] font-bold text-[#94A3B8]">{listing.price}</Text>
                  </View>
                  <Text className="mt-1 text-[12px] font-medium text-[#EF4444]">{listing.expiredAgo}</Text>
                  <Text className="text-[12px] text-[#6C7A74]">{listing.category}</Text>
                  {/* Stats */}
                  <View className="mt-3 flex-row gap-4">
                    <View className="flex-row items-center gap-1.5">
                      <MaterialIcons name="visibility" size={18} color="#64748B" />
                      <Text className="text-[13px] font-medium text-[#64748B]">{listing.views} Views</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <MaterialIcons name="favorite" size={18} color="#64748B" />
                      <Text className="text-[13px] font-medium text-[#64748B]">{listing.likes} Likes</Text>
                    </View>
                  </View>
                  {/* Actions */}
                  <View className="mt-4 flex-row gap-2">
                    <Pressable
                      className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-slate-200 py-2"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <MaterialIcons name="delete-outline" size={18} color="#161D1A" />
                      <Text className="text-[12px] font-medium text-[#161D1A]">Delete</Text>
                    </Pressable>
                    <Pressable
                      className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-[#27BB97] py-2"
                      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}
                    >
                      <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
                      <Text className="text-[12px] font-medium text-white">Renew</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
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
