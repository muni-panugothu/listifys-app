import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

const heroImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuAuhXEzk0isZFjM8QbQX3ab0RiYIrvSTgaGYCMtVk2FxJdctudTkhBu3vtypIGtH22NbYhrapHrRbtoyoxNcBOUQNo4-O1tBi4ZqiPBo_Z5QESK_EwRmsvUUvVdjfR5wa3kT1JKjkf1U_FAlPZJpTksljkOR-PxjQfExczQXS08bwCIPvRitXOg8vY-FpCIvvkdqG4B62ilLEw-W00wmjf5Ai3YqwNFuVsC1QSD4rnZiM4TloOxUFIAT_8WqMmB_GDEhkc6X8s-MIo";

type Device = {
  id: string;
  name: string;
  location: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  current?: boolean;
};

const devices: Device[] = [
  { id: "1", name: "iPhone 15 Pro", location: "Mumbai • Active Now", icon: "smartphone", current: true },
  { id: "2", name: "Chrome on MacOS", location: "Bangalore • 2 days ago", icon: "laptop-mac" },
  { id: "3", name: "Safari on iPad", location: "Delhi • 1 week ago", icon: "tablet-mac" },
];

export function DevicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4" style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="arrow-back" size={24} color="#27BB97" /></Pressable>
        <Text className="text-[20px] font-bold text-[#161D1A]">Devices</Text>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="settings" size={22} color="#64748B" /></Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 100 + Math.max(insets.bottom, 8) }}>
        <View className="px-4">
          {/* Hero */}
          <View className="mb-6 h-48 overflow-hidden rounded-xl" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 }}>
            <Image source={heroImage} contentFit="cover" className="h-full w-full" />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={{ position: "absolute", inset: 0 }} />
            <View className="absolute bottom-0 left-0 p-6">
              <Text className="text-[20px] font-semibold text-white">Security & Access</Text>
              <Text className="text-[12px] text-white/80">Manage where you are currently signed in</Text>
            </View>
          </View>

          {/* Info */}
          <View className="mb-6 flex-row gap-3 rounded-xl border border-[rgba(39,187,151,0.2)] bg-[rgba(39,187,151,0.1)] p-4">
            <MaterialIcons name="info" size={22} color="#006B55" />
            <Text className="flex-1 text-[14px] leading-5 text-[#004535]">If you see a device you don't recognize, log out immediately and change your password to keep your account secure.</Text>
          </View>

          {/* Sessions */}
          <Text className="mb-3 px-1 text-[18px] font-semibold text-[#161D1A]">Active Sessions</Text>
          <View className="gap-3">
            {devices.map((device) => (
              <View key={device.id} className="flex-row items-center justify-between rounded-xl border border-slate-100 bg-white/70 p-4" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 }}>
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: device.current ? "rgba(39,187,151,0.2)" : "#F3F4F6" }}>
                    <MaterialIcons name={device.icon} size={24} color={device.current ? "#006B55" : "#64748B"} />
                  </View>
                  <View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[16px] font-semibold text-[#161D1A]">{device.name}</Text>
                      {device.current && <View className="rounded-full bg-[rgba(0,107,85,0.1)] px-2 py-0.5"><Text className="text-[10px] font-bold uppercase tracking-wider text-[#006B55]">Current</Text></View>}
                    </View>
                    <Text className="text-[12px] text-[#64748B]">{device.location}</Text>
                  </View>
                </View>
                {device.current ? (
                  <MaterialIcons name="chevron-right" size={22} color="#CBD5E1" />
                ) : (
                  <Pressable className="p-2"><MaterialIcons name="more-vert" size={22} color="#94A3B8" /></Pressable>
                )}
              </View>
            ))}
          </View>

          {/* Logout All */}
          <View className="mt-8">
            <Pressable className="overflow-hidden rounded-xl" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <LinearGradient colors={["#27BB97", "#1E9E7E"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#27BB97", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }}>
                <MaterialIcons name="logout" size={20} color="#FFFFFF" />
                <Text className="text-[16px] font-semibold text-white">Log out from all devices</Text>
              </LinearGradient>
            </Pressable>
            <Text className="mt-4 text-center text-[12px] text-[#94A3B8]">This will sign you out of all devices except this one.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
