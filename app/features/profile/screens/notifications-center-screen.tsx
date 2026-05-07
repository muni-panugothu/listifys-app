import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

type Notification = {
  id: string;
  type: "offer" | "follower" | "price_drop" | "security";
  title: string;
  description: string;
  time: string;
  unread?: boolean;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  iconBg: string;
  iconColor: string;
  avatar?: string;
  actionLabel?: string;
  product?: { image: string; oldPrice: string; newPrice: string };
};

const notifications: Notification[] = [
  { id: "1", type: "offer", title: "New Offer", description: "Someone placed an offer on your MacBook Pro M2. Tap to review details.", time: "2m ago", unread: true, icon: "sell", iconBg: "rgba(39,187,151,0.1)", iconColor: "#27BB97" },
  { id: "2", type: "follower", title: "Priya Sharma", description: "Started following you. View their profile to see what they are selling.", time: "1h ago", icon: "person", iconBg: "transparent", iconColor: "#27BB97", avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAKB4fqc9xbdNy-01QszLtRtNDj0GmIoizp83AO6hQtuiyOQ8CtfbRIHOugU1k7CctviY0ZpBrjX_zgVJV5QZEmWi9xjPlNQgxs97wWC2AIfZL-QwvAw6z81Ps5ducgUMWd9fooGp2ofPtjGH0clxPT9MzzGGlS1HpeeL_LFUylfO8qfvGLLEgoj33DUZrHiqXRXoswrMe9o_URnrfpQD7StgOgCnCPDqf0N4RQUDvlmCh8QLFzTySzamJ3JlUs2wH8qCc3DKks8WA", actionLabel: "Follow Back" },
  { id: "3", type: "price_drop", title: "Price Drop", description: "The price of your saved item Sony Headphones just dropped by 15%!", time: "3h ago", unread: true, icon: "trending-down", iconBg: "rgba(203,161,0,0.1)", iconColor: "#CBA100", product: { image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDXykz3M7wbiYYFFFAQ0f_1sa6LaJNiGYTPYe66TulO075GzjrSKUToXBT-dl_iJCwxXsMEh3WIuNXVoG_MnBNy2FHcw_Xx9JffEKIxZBIYIly0lBPPUmERfxb9cWllez7b0_Jtoke_n1VoV1alfnV6xlsVUb7b0WP9gN4zvEkAyPQ15HkVbHMIDjljqKe6s7muccg9zjJRBbq6A3tYguFz6wS4cx3-u78Urt0enQEqs68hjc5vVgwOpbWRIgttppfxECYlRbd_EQ0", oldPrice: "₹24,999", newPrice: "₹21,249" } },
  { id: "4", type: "security", title: "System Security Alert", description: "New login detected on a Chrome browser (Macintosh OS) from Bengaluru, India. If this wasn't you, secure your account now.", time: "Yesterday", icon: "security", iconBg: "rgba(186,26,26,0.1)", iconColor: "#BA1A1A" },
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const, active: true },
];

export function NotificationsCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const [activeTab, setActiveTab] = useState("All");

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
      <View className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4" style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="arrow-back" size={24} color="#27BB97" /></Pressable>
          <Text className="text-[20px] font-black text-[#161D1A]">Notifications</Text>
        </View>
        <View className="flex-row items-center gap-4">
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><Text className="text-[12px] font-semibold text-[#27BB97]">Mark all as read</Text></Pressable>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="settings" size={22} color="#64748B" /></Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 84 + bottomNavPadding }}>
        <View className="px-4">
          {/* Tabs */}
          <View className="mb-6 flex-row gap-2">
            {["All", "Unread"].map((tab) => (
              <Pressable key={tab} onPress={() => setActiveTab(tab)} className="rounded-full px-6 py-2" style={{ backgroundColor: tab === activeTab ? "#27BB97" : "#E9EFEB", shadowColor: tab === activeTab ? "#000" : "transparent", shadowOffset: { width: 0, height: 1 }, shadowOpacity: tab === activeTab ? 0.1 : 0, shadowRadius: 2, elevation: tab === activeTab ? 1 : 0 }}>
                <Text className="text-[12px] font-medium" style={{ color: tab === activeTab ? "#FFFFFF" : "#3C4A44" }}>{tab}</Text>
              </Pressable>
            ))}
          </View>

          {/* Feed */}
          <View className="gap-3">
            {notifications.map((n) => (
              <View key={n.id} className="relative flex-row items-start gap-4 rounded-xl p-4" style={{ backgroundColor: n.unread ? "#FFFFFF" : "#FAFCFB", borderWidth: 1, borderColor: n.unread ? "rgba(39,187,151,0.2)" : "#F3F4F6", shadowColor: n.unread ? "#000" : "transparent", shadowOffset: { width: 0, height: 2 }, shadowOpacity: n.unread ? 0.08 : 0, shadowRadius: n.unread ? 6 : 0, elevation: n.unread ? 2 : 0 }}>
                {n.unread && <View className="absolute right-4 top-4 h-2 w-2 rounded-full bg-[#27BB97]" style={{ shadowColor: "#27BB97", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 }} />}
                {/* Icon / Avatar */}
                {n.avatar ? (
                  <View className="h-12 w-12 overflow-hidden rounded-full border border-slate-100"><Image source={n.avatar} contentFit="cover" className="h-full w-full" /></View>
                ) : (
                  <View className="h-12 w-12 items-center justify-center rounded-xl border" style={{ backgroundColor: n.iconBg, borderColor: n.iconBg }}><MaterialIcons name={n.icon} size={22} color={n.iconColor} /></View>
                )}
                {/* Content */}
                <View className="flex-1">
                  <View className="flex-row items-start justify-between mb-1">
                    <Text className="text-[18px] font-semibold text-[#161D1A]">{n.title}</Text>
                    <Text className="text-[10px] font-medium text-[#94A3B8]">{n.time}</Text>
                  </View>
                  <Text className="text-[14px] leading-5 text-[#3C4A44]">{n.description}</Text>
                  {n.actionLabel && (
                    <Pressable className="mt-3 self-start rounded-lg border border-[#27BB97] px-4 py-1.5" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                      <Text className="text-[12px] font-medium text-[#27BB97]">{n.actionLabel}</Text>
                    </Pressable>
                  )}
                  {n.product && (
                    <View className="mt-3 flex-row items-center gap-3 rounded-lg border border-slate-100 bg-[#F4FBF6] p-2">
                      <Image source={n.product.image} contentFit="cover" className="h-10 w-10 rounded-md" />
                      <View>
                        <Text className="text-[10px] text-[#94A3B8] line-through">{n.product.oldPrice}</Text>
                        <Text className="text-[16px] font-bold text-[#27BB97]">{n.product.newPrice}</Text>
                      </View>
                    </View>
                  )}
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
            if (tab.highlight) { return (<Pressable key={tab.id} onPress={() => handleBottomTabPress(tab.id)} className="items-center justify-center" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><View className="-mt-7 rounded-full border-4 border-[#F4FBF6] bg-[#27BB97] p-2.5" style={{ shadowColor: "#27BB97", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}><MaterialIcons name={tab.icon} size={24} color="#FFFFFF" /></View><Text className="mt-1 text-[11px] font-medium tracking-wide text-slate-400">{tab.label}</Text></Pressable>); }
            return (<Pressable key={tab.id} onPress={() => handleBottomTabPress(tab.id)} className="items-center py-1" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name={tab.icon} size={24} color={tab.active ? "#27BB97" : "#94A3B8"} /><Text className="text-[11px] font-medium tracking-wide" style={{ color: tab.active ? "#27BB97" : "#94A3B8" }}>{tab.label}</Text></Pressable>);
          })}
        </View>
      </View>
    </View>
  );
}
