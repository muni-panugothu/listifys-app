import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  date: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  iconBg: string;
  iconColor: string;
  image?: string;
  imageTag?: string;
  avatar?: string;
  actionLabel?: string;
  actionIcon?: React.ComponentProps<typeof MaterialIcons>["name"];
  badgeLabel?: string;
  badgeBg?: string;
  badgeColor?: string;
};

const activities: ActivityItem[] = [
  { id: "1", date: "Today", title: "Listed 'Modern Desk'", description: "Item added successfully to the Furniture category.", time: "14:20", icon: "inventory-2", iconBg: "#27BB97", iconColor: "#FFFFFF", image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC7O30AXOLDVkXDa8TChxy17XT8_7I8nuJNG1QU24wmLa3Zb6xY5Z2i6z8KasvPsaYbF9fpLz7cfqT-xQWSg96_lNAnLPdhGI-7xt9EMnb1pgun7g_7cDk69_hs7VE_ifGZhuwz8j817CC2QGLFcn_CC4jo8U2k2yDTNyqW_0DGULDt1Y9_ZvQefYAdyc616KVyUGgqRpmaOIR50VFNPwUhk6PpGnKMn8EVLfkdajqissdJEbwdg6ik1R0mwSTUvGHC31eXIXYHRVw", imageTag: "ACTIVE" },
  { id: "2", date: "Yesterday", title: "New login detected", description: "Logged in from a MacBook Pro in Mumbai, India.", time: "09:15", icon: "devices", iconBg: "#005FB0", iconColor: "#FFFFFF", actionLabel: "Verify identity", actionIcon: "verified-user" },
  { id: "3", date: "Aug 10", title: "Changed profile picture", description: "Your new identity looks great!", time: "", icon: "face", iconBg: "#755B00", iconColor: "#FFFFFF", avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBQtODfJ8ZlRAIPaXskhHIPqGJF1WET2WY0zaANLr2KL6QxxCfVo5vtAiahdIOb1nJp-YkMZnrUhIwzTOqgVOqd-JwzOKU8hpvwpJYeVbOJVWubBF3IWozAB1W8fXbYwwo1tO024o6hZDZyQEV9fkiivzH8txgnjXniQIZ__lEtg1ybnlL1PfzGN1wk1fzlVpoak3pHz2PnKwj3edBT9aa1ggDZcV5iia9M1qMzCLxuu6FdG6Rcany0FRRNVC6Fl-TfPHTGyarskoo" },
  { id: "4", date: "Aug 08", title: "Password updated", description: "Security credentials successfully modified.", time: "", icon: "lock-reset", iconBg: "#BA1A1A", iconColor: "#FFFFFF", badgeLabel: "High Priority", badgeBg: "rgba(186,26,26,0.1)", badgeColor: "#BA1A1A" },
];

const stats = [
  { label: "Total Actions", value: "128", color: "#006B55" },
  { label: "Trust Score", value: "98%", color: "#005FB0" },
];

export function ActivityLogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4" style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}>
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="arrow-back" size={24} color="#27BB97" /></Pressable>
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-[#161D1A]">Activity Log</Text>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="settings" size={22} color="#64748B" /></Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 40 + Math.max(insets.bottom, 8) }}>
        <View className="px-4">
          {/* Stats */}
          <View className="mb-8 flex-row gap-3">
            {stats.map((s) => (
              <View key={s.label} className="flex-1 gap-1 rounded-xl border border-slate-100 bg-white p-4" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                <Text className="text-[12px] font-medium text-[#3C4A44]">{s.label}</Text>
                <Text className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</Text>
              </View>
            ))}
          </View>

          <Text className="mb-6 text-[20px] font-semibold text-[#161D1A]">Recent Activity</Text>

          {/* Timeline */}
          <View className="relative pl-12">
            <View className="absolute bottom-0 left-[19px] top-0 w-[2px] bg-[#DDE4DF]" />
            {activities.map((item) => (
              <View key={item.id} className="relative mb-8">
                <View className="absolute -left-12 top-1 h-10 w-10 items-center justify-center rounded-full z-10" style={{ backgroundColor: item.iconBg, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
                  <MaterialIcons name={item.icon} size={20} color={item.iconColor} />
                </View>
                <View className="gap-1">
                  <Text className="text-[12px] font-medium uppercase tracking-wider" style={{ color: item.iconBg }}>{item.date}</Text>
                  <View className="rounded-xl border border-slate-100 bg-white p-4" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="text-[18px] font-semibold text-[#161D1A]">{item.title}</Text>
                      {item.time ? <Text className="text-[12px] text-[#3C4A44]">{item.time}</Text> : null}
                    </View>
                    <Text className="text-[14px] leading-5 text-[#3C4A44]">{item.description}</Text>
                    {item.image && (
                      <View className="relative mt-3 h-32 overflow-hidden rounded-lg border border-slate-100">
                        <Image source={item.image} contentFit="cover" className="h-full w-full" />
                        {item.imageTag && <View className="absolute left-2 top-2 rounded bg-white/70 px-2 py-1"><Text className="text-[10px] font-bold text-[#006B55]">{item.imageTag}</Text></View>}
                      </View>
                    )}
                    {item.avatar && (
                      <View className="mt-3 flex-row items-center gap-4">
                        <View className="h-12 w-12 overflow-hidden rounded-full border-2 border-white" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }}><Image source={item.avatar} contentFit="cover" className="h-full w-full" /></View>
                      </View>
                    )}
                    {item.actionLabel && (
                      <Pressable className="mt-3 flex-row items-center gap-2" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                        {item.actionIcon && <MaterialIcons name={item.actionIcon} size={16} color="#006B55" />}
                        <Text className="text-[12px] font-medium text-[#006B55]">{item.actionLabel}</Text>
                      </Pressable>
                    )}
                    {item.badgeLabel && (
                      <View className="mt-3 self-start flex-row items-center gap-2 rounded-full px-3 py-1" style={{ backgroundColor: item.badgeBg }}>
                        <Text className="text-[10px] font-bold" style={{ color: item.badgeColor }}>{item.badgeLabel}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
