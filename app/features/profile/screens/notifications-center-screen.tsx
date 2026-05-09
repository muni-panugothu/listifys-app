import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  type NotificationItem,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/auth/services/auth-api";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";

function getNotifStyle(type: string) {
  switch (type) {
    case "offer": return { icon: "sell" as const, bg: "rgba(39,187,151,0.1)", color: "#27BB97" };
    case "follower": return { icon: "person" as const, bg: "transparent", color: "#27BB97" };
    case "price_drop": return { icon: "trending-down" as const, bg: "rgba(203,161,0,0.1)", color: "#CBA100" };
    case "security": return { icon: "security" as const, bg: "rgba(186,26,26,0.1)", color: "#BA1A1A" };
    default: return { icon: "notifications" as const, bg: "rgba(39,187,151,0.1)", color: "#27BB97" };
  }
}

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const handleBottomTabPress = useTabNavigation();

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNotifications();
      setNotifications(res.notifications || []);
    } catch {
      /* silently handle */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      Alert.alert("Error", "Failed to mark notifications as read");
    }
  };

  const filtered = activeTab === "Unread" ? notifications.filter((n) => !n.read) : notifications;

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4" style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="arrow-back" size={24} color="#27BB97" /></Pressable>
          <Text className="text-[20px] font-black text-[#161D1A]">Notifications</Text>
        </View>
        <View className="flex-row items-center gap-4">
          <Pressable onPress={handleMarkAllRead} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><Text className="text-[12px] font-semibold text-[#27BB97]">Mark all as read</Text></Pressable>
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
          {loading ? (
            <ActivityIndicator size="large" color="#27BB97" style={{ marginVertical: 32 }} />
          ) : filtered.length === 0 ? (
            <Text className="py-12 text-center text-[14px] text-[#94A3B8]">No notifications yet.</Text>
          ) : (
          <View className="gap-3">
            {filtered.map((n) => {
              const style = getNotifStyle(n.type);
              return (
              <Pressable
                key={n._id}
                onPress={async () => {
                  if (!n.read) {
                    await markNotificationRead(n._id).catch(() => {});
                    setNotifications((prev) => prev.map((x) => x._id === n._id ? { ...x, read: true } : x));
                  }
                }}
                className="relative flex-row items-start gap-4 rounded-xl p-4"
                style={{ backgroundColor: !n.read ? "#FFFFFF" : "#FAFCFB", borderWidth: 1, borderColor: !n.read ? "rgba(39,187,151,0.2)" : "#F3F4F6", shadowColor: !n.read ? "#000" : "transparent", shadowOffset: { width: 0, height: 2 }, shadowOpacity: !n.read ? 0.08 : 0, shadowRadius: !n.read ? 6 : 0, elevation: !n.read ? 2 : 0 }}
              >
                {!n.read && <View className="absolute right-4 top-4 h-2 w-2 rounded-full bg-[#27BB97]" style={{ shadowColor: "#27BB97", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 }} />}
                <View className="h-12 w-12 items-center justify-center rounded-xl border" style={{ backgroundColor: style.bg, borderColor: style.bg }}><MaterialIcons name={style.icon} size={22} color={style.color} /></View>
                <View className="flex-1">
                  <View className="flex-row items-start justify-between mb-1">
                    <Text className="text-[18px] font-semibold text-[#161D1A]">{n.title}</Text>
                    <Text className="text-[10px] font-medium text-[#94A3B8]">{timeAgo(n.createdAt)}</Text>
                  </View>
                  <Text className="text-[14px] leading-5 text-[#3C4A44]">{n.message}</Text>
                </View>
              </Pressable>
              );
            })}
          </View>
          )}
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
