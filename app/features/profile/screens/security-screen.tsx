import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

const googleLogo = "https://lh3.googleusercontent.com/aida-public/AB6AXuB0Fv9YujEQndmInZn8UL9wNaXlcju4h_W9rdQi1QXQrNa9Hb3lroDZzejdbsMYJPwiu5Vuo3yihw53J_F-SOC7-wpEImOfx-lMLszse1-wwlYy9vIz5b0UT7T9wD2TH1mSf_CUoC9SmbU_Qf_rQK4pJJ3V7f4VM1tc5Fp7zEe3OWIRbMDTRWsns7Yn2eeQ1zykKB6TQirm7ZMBsp-ZsiUknsCFkMe2Yhns06gIqY1_9m-yc3S1wNNjhMC98OnCxN90Dhs8-benkhc";

type CheckItem = { label: string; status: "secure" | "warning"; statusLabel: string };
const checklist: CheckItem[] = [
  { label: "Verified Email", status: "secure", statusLabel: "Secure" },
  { label: "Strong Password", status: "secure", statusLabel: "Secure" },
  { label: "Recovery Phone", status: "warning", statusLabel: "Add now" },
];

type SecurityOption = { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; sublabel: string; sublabelColor: string; type: "navigate" | "toggle"; value?: boolean };

export function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const [twoFa, setTwoFa] = useState(false);
  const [biometric, setBiometric] = useState(true);

  const securityOptions: SecurityOption[] = [
    { icon: "lock-reset", label: "Change Password", sublabel: "Update your login credentials", sublabelColor: "#6C7A74", type: "navigate" },
    { icon: "verified-user", label: "Two-Factor Authentication", sublabel: twoFa ? "Currently On" : "Currently Off", sublabelColor: twoFa ? "#006B55" : "#BA1A1A", type: "toggle", value: twoFa },
    { icon: "fingerprint", label: "Biometric Login", sublabel: biometric ? "Currently On" : "Currently Off", sublabelColor: biometric ? "#006B55" : "#BA1A1A", type: "toggle", value: biometric },
  ];

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4" style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}>
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="arrow-back" size={24} color="#161D1A" /></Pressable>
          <Text className="text-[14px] font-semibold tracking-tight text-[#27BB97]">Profile</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="shield" size={22} color="#27BB97" />
          <Pressable onPress={() => router.push("/app-settings")} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="settings" size={22} color="#161D1A" /></Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 40 + Math.max(insets.bottom, 8) }}>
        <View className="px-4 gap-6">
          {/* Hero Bento */}
          <View className="flex-row gap-3">
            <View className="flex-[2] overflow-hidden rounded-xl" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }}>
              <LinearGradient colors={["#006B55", "#00513F"]} style={{ padding: 24, position: "relative", overflow: "hidden" }}>
                <Text className="text-[12px] font-medium text-[#55DCB6]/90 mb-1">Security Score</Text>
                <Text className="text-[24px] font-bold text-white mb-2">Strong Status</Text>
                <Text className="text-[14px] text-[#55DCB6]/80 max-w-[200px]">Your account is well-protected with modern security standards.</Text>
                <View className="absolute -right-4 -bottom-4 opacity-10"><MaterialIcons name="verified-user" size={120} color="#FFFFFF" /></View>
              </LinearGradient>
            </View>
            <View className="flex-1 items-center justify-center rounded-xl border border-[#BBCAC3] bg-white p-5">
              <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-[rgba(39,187,151,0.1)]"><MaterialIcons name="security-update-good" size={24} color="#006B55" /></View>
              <Text className="text-[18px] font-semibold text-[#161D1A]">Last Check</Text>
              <Text className="text-[12px] text-[#6C7A74]">2 hours ago</Text>
            </View>
          </View>

          {/* Checklist */}
          <View className="gap-4">
            <Text className="text-[20px] font-semibold text-[#161D1A]">Security Checklist</Text>
            <View className="overflow-hidden rounded-xl border border-[#BBCAC3] bg-white">
              {checklist.map((item, i) => (
                <View key={item.label} className="flex-row items-center justify-between p-4" style={{ borderBottomWidth: i < checklist.length - 1 ? 1 : 0, borderBottomColor: "rgba(187,202,195,0.3)" }}>
                  <View className="flex-row items-center gap-3">
                    <MaterialIcons name={item.status === "secure" ? "check-circle" : "info"} size={22} color={item.status === "secure" ? "#006B55" : "#CBA100"} />
                    <Text className="text-[14px] font-medium text-[#161D1A]">{item.label}</Text>
                  </View>
                  <Text className="text-[12px] font-medium" style={{ color: item.status === "secure" ? "#006B55" : "#755B00" }}>{item.statusLabel}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Privacy & Safety */}
          <View className="gap-4">
            <Text className="text-[20px] font-semibold text-[#161D1A]">Privacy & Safety</Text>
            <View className="gap-2">
              {securityOptions.map((opt) => (
                <Pressable key={opt.label} className="flex-row items-center justify-between rounded-xl border border-[#BBCAC3] bg-white p-4" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                  <View className="flex-row items-center gap-4">
                    <View className="h-10 w-10 items-center justify-center rounded-lg bg-slate-100"><MaterialIcons name={opt.icon} size={22} color="#161D1A" /></View>
                    <View>
                      <Text className="text-[16px] font-semibold text-[#161D1A]">{opt.label}</Text>
                      <Text className="text-[12px]" style={{ color: opt.sublabelColor }}>{opt.sublabel}</Text>
                    </View>
                  </View>
                  {opt.type === "toggle" ? (
                    <Switch value={opt.value} onValueChange={(v) => opt.label.includes("Two") ? setTwoFa(v) : setBiometric(v)} trackColor={{ false: "#E9EFEB", true: "#006B55" }} thumbColor="#FFFFFF" />
                  ) : (
                    <MaterialIcons name="chevron-right" size={22} color="#6C7A74" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Connected Accounts */}
          <View className="gap-4">
            <Text className="text-[20px] font-semibold text-[#161D1A]">Connected Accounts</Text>
            <View className="flex-row gap-3">
              <View className="flex-1 flex-row items-center justify-between rounded-xl border border-[#BBCAC3] bg-white p-4">
                <View className="flex-row items-center gap-3">
                  <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-50"><Image source={googleLogo} contentFit="contain" className="h-5 w-5" /></View>
                  <Text className="text-[14px] font-medium text-[#161D1A]">Google</Text>
                </View>
                <Text className="text-[12px] font-bold text-[#006B55]">Linked</Text>
              </View>
              <View className="flex-1 flex-row items-center justify-between rounded-xl border border-[#BBCAC3] bg-white p-4">
                <View className="flex-row items-center gap-3">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-slate-950"><MaterialIcons name="apple" size={20} color="#FFFFFF" /></View>
                  <Text className="text-[14px] font-medium text-[#161D1A]">Apple ID</Text>
                </View>
                <Text className="text-[12px] font-bold text-[#006B55]">Linked</Text>
              </View>
            </View>
          </View>

          {/* Sign Out All */}
          <View className="pt-4">
            <Pressable className="flex-row items-center justify-center gap-2 rounded-xl p-4" style={({ pressed }) => ({ backgroundColor: pressed ? "rgba(186,26,26,0.05)" : "transparent" })}>
              <MaterialIcons name="no-accounts" size={22} color="#BA1A1A" />
              <Text className="text-[14px] font-semibold text-[#BA1A1A]">Sign out from all devices</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
