import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ActivityLogEntry, getActivityLog } from "@/features/auth/services/auth-api";
import { Image } from "@/lib/nativewind-interop";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

function getActivityIcon(action: string): { icon: React.ComponentProps<typeof MaterialIcons>["name"]; bg: string } {
  const a = action.toLowerCase();
  if (a.includes("login") || a.includes("sign")) return { icon: "devices", bg: "#005FB0" };
  if (a.includes("password")) return { icon: "lock-reset", bg: "#BA1A1A" };
  if (a.includes("profile") || a.includes("avatar") || a.includes("picture")) return { icon: "face", bg: "#755B00" };
  if (a.includes("list") || a.includes("post")) return { icon: "inventory-2", bg: "#27BB97" };
  return { icon: "history", bg: "#27BB97" };
}

export function ActivityLogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);

  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getActivityLog();
      setActivities(res.activities || []);
    } catch {
      /* silently handle */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  const handleRefresh = useCallback(async () => {
    try {
      const res = await getActivityLog();
      setActivities(res.activities || []);
    } catch {
      /* silently handle */
    }
  }, []);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  return (
    <View className="flex-1 bg-[#F6F7F8]">
      {/* Top Bar */}
      <View className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4" style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}>
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="arrow-back" size={24} color="#27BB97" /></Pressable>
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-[#161D1A]">Activity Log</Text>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="settings" size={22} color="#64748B" /></Pressable>
      </View>

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
        contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 40 + Math.max(insets.bottom, 8) }}
      >
        <View className="px-4">
          {/* Stats */}
          <View className="mb-8 flex-row gap-3">
            {[
              { label: "Total Actions", value: String(activities.length), color: "#006B55" },
            ].map((s) => (
              <View key={s.label} className="flex-1 gap-1 rounded-xl border border-slate-100 bg-white p-4" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                <Text className="text-[12px] font-medium text-[#3C4A44]">{s.label}</Text>
                <Text className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</Text>
              </View>
            ))}
          </View>

          <Text className="mb-6 text-[20px] font-semibold text-[#161D1A]">Recent Activity</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#27BB97" style={{ marginVertical: 32 }} />
          ) : activities.length === 0 ? (
            <Text className="py-8 text-center text-[14px] text-[#94A3B8]">No activity yet.</Text>
          ) : (
          <View className="relative pl-12">
            <View className="absolute bottom-0 left-4.75 top-0 w-0.5 bg-[#DDE4DF]" />
            {activities.map((item) => {
              const { icon, bg } = getActivityIcon(item.action);
              const d = new Date(item.createdAt);
              const dateLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              const timeLabel = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
              return (
              <View key={item._id || item.createdAt} className="relative mb-8">
                <View className="absolute -left-12 top-1 h-10 w-10 items-center justify-center rounded-full z-10" style={{ backgroundColor: bg, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
                  <MaterialIcons name={icon} size={20} color="#FFFFFF" />
                </View>
                <View className="gap-1">
                  <Text className="text-[12px] font-medium uppercase tracking-wider" style={{ color: bg }}>{dateLabel}</Text>
                  <View className="rounded-xl border border-slate-100 bg-white p-4" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="flex-1 text-[18px] font-semibold text-[#161D1A]">{item.action}</Text>
                      <Text className="text-[12px] text-[#3C4A44]">{timeLabel}</Text>
                    </View>
                    {item.description ? <Text className="text-[14px] leading-5 text-[#3C4A44]">{item.description}</Text> : null}
                  </View>
                </View>
              </View>
              );
            })}
          </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
