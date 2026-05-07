import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

type DraftListing = {
  id: string;
  title: string;
  price: string;
  category: string;
  lastEdited: string;
  progress: number;
  image: string;
};

const draftListings: DraftListing[] = [
  {
    id: "1",
    title: "Leather Office Chair",
    price: "₹12,000",
    category: "Furniture",
    lastEdited: "Edited 1 hour ago",
    progress: 75,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAHKuRSqBvFz-njyFPuaLRGuY2K8EBqo1tMeABWJW0980o5B2CbGHwlqB0gWK3hmcJ6QkfnFGojFw7PvCsIp2B7QlVzBYn2ZmFGJeks70ffx8iresJ8GyWyjlho24AkxrQE95hDxy2hIBAfeSd8ByLzS66ApdRvC9OzIFwNeYNf5KhgHBWZ7vz-pNUAtXVuw8-pXUbxx29-s5tGenJmSOkpAzqqzcgvdUbEq_vUKGrDP9FY0TJz19jER-WHnP4H1w4kNOzk3jb8cN0",
  },
  {
    id: "2",
    title: "Canon EOS R5 Camera",
    price: "₹1,85,000",
    category: "Electronics",
    lastEdited: "Edited 3 days ago",
    progress: 40,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBXuo6LzQc-Mij-_BvqApAiuGeVZjLT0p72YYK7WwfvGNiU5KVk_YPcMe5dG5C6hSyjlfjoAiq47yweiyuCU7KRlR4DtdFL8QeFjvAOPU28CWI0fkj-bczfgdeuRJd98TeOqZt6YRWFlfelf3845KQTVIDCBRuTNc8w_WpvEsiNTLEbcOuBwz_ixJK3qJ32sitTBZZ-pcOvXvuVihZmLqAjdOTZTGzFvlFcZelNgfQY1MTz7IbGJTYzlCGvo2BUx-qmDqmRVEAXkvk",
  },
  {
    id: "3",
    title: "Untitled Draft",
    price: "—",
    category: "Uncategorized",
    lastEdited: "Edited 1 week ago",
    progress: 10,
    image: "",
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

export function MyListingsDraftScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("Drafts");
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    if (tab === "Active") router.replace("/my-listings-active");
    if (tab === "Expired") router.replace("/my-listings-expired");
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

          {/* Drafts */}
          <View className="gap-6">
            {draftListings.map((listing) => (
              <View
                key={listing.id}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
              >
                {/* Image / Placeholder */}
                <View className="relative h-40 w-full">
                  {listing.image ? (
                    <Image source={listing.image} contentFit="cover" className="h-full w-full" style={{ opacity: 0.7 }} />
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
                    <Text className="flex-1 pr-4 text-[18px] font-semibold text-[#161D1A]" numberOfLines={1}>{listing.title}</Text>
                    <Text className="text-[16px] font-bold text-[#6C7A74]">{listing.price}</Text>
                  </View>
                  <Text className="mt-1 text-[12px] text-[#6C7A74]">{listing.category} • {listing.lastEdited}</Text>

                  {/* Progress */}
                  <View className="mt-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[12px] font-medium text-[#6C7A74]">Completion</Text>
                      <Text className="text-[12px] font-bold text-[#27BB97]">{listing.progress}%</Text>
                    </View>
                    <View className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EFF5F0]">
                      <View className="h-full rounded-full bg-[#27BB97]" style={{ width: `${listing.progress}%` }} />
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
                      onPress={() => router.push("/edit-listing")}
                      className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-[#27BB97] py-2"
                      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}
                    >
                      <MaterialIcons name="edit" size={18} color="#FFFFFF" />
                      <Text className="text-[12px] font-medium text-white">Resume</Text>
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
