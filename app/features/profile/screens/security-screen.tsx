import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "@/lib/safe-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { logoutAllDevices } from "@/features/auth/services/auth-api";
import { Image } from "@/lib/nativewind-interop";
import { useAppSelector } from "@/store/hooks";

const googleLogo = "https://lh3.googleusercontent.com/aida-public/AB6AXuB0Fv9YujEQndmInZn8UL9wNaXlcju4h_W9rdQi1QXQrNa9Hb3lroDZzejdbsMYJPwiu5Vuo3yihw53J_F-SOC7-wpEImOfx-lMLszse1-wwlYy9vIz5b0UT7T9wD2TH1mSf_CUoC9SmbU_Qf_rQK4pJJ3V7f4VM1tc5Fp7zEe3OWIRbMDTRWsns7Yn2eeQ1zykKB6TQirm7ZMBsp-ZsiUknsCFkMe2Yhns06gIqY1_9m-yc3S1wNNjhMC98OnCxN90Dhs8-benkhc";

type CheckItem = { label: string; status: "secure" | "warning"; statusLabel: string };

type SecurityOption = { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; sublabel: string; sublabelColor: string; type: "navigate" | "toggle"; value?: boolean };

export function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const [twoFa, setTwoFa] = useState(false);
  const [biometric, setBiometric] = useState(true);
  const user = useAppSelector((s) => s.auth.user);

  const isGoogleLinked = user?.provider === "google";
  const hasEmail = user?.isVerified ?? false;
  const hasPhone = !!user?.phone;
  const phoneVerified = user?.phoneVerified ?? false;
  const maskedPhone = user?.phone
    ? `${String(user.phone).slice(0, 2)}******${String(user.phone).slice(-2)}`
    : "Not added";

  const hasPasswordSet = user?.hasPassword !== false;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home-feed-root" as Href);
  };

  const checklist: CheckItem[] = [
    { label: "Verified Email", status: hasEmail ? "secure" : "warning", statusLabel: hasEmail ? "Secure" : "Verify now" },
    { label: "Strong Password", status: hasPasswordSet ? "secure" : "warning", statusLabel: hasPasswordSet ? "Secure" : "Set up now" },
    { label: "Recovery Phone", status: hasPhone ? "secure" : "warning", statusLabel: hasPhone ? (phoneVerified ? "Verified" : "Added") : "Add now" },
  ];

  const handleSignOutAll = () => {
    Alert.alert("Sign out everywhere?", "You will be signed out from all devices.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out All",
        style: "destructive",
        onPress: async () => {
          try {
            await logoutAllDevices();
            Alert.alert("Done", "Signed out from all devices.");
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed");
          }
        },
      },
    ]);
  };

  const securityOptions: SecurityOption[] = [
    { icon: "lock-reset", label: "Change Password", sublabel: isGoogleLinked && !user?.hasPassword ? "Set up a password" : "Update your login credentials", sublabelColor: "#6C7A74", type: "navigate" },
    { icon: "verified-user", label: "Two-Factor Authentication", sublabel: twoFa ? "Currently On" : "Currently Off", sublabelColor: twoFa ? "#006B55" : "#BA1A1A", type: "toggle", value: twoFa },
    { icon: "fingerprint", label: "Biometric Login", sublabel: biometric ? "Currently On" : "Currently Off", sublabelColor: biometric ? "#006B55" : "#BA1A1A", type: "toggle", value: biometric },
  ];

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4" style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}>
        <View className="flex-row items-center gap-4">
          <Pressable onPress={handleBack} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="arrow-back" size={24} color="#161D1A" /></Pressable>
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
                <Pressable key={opt.label} onPress={() => { if (opt.type === "navigate") router.push("/change-password" as Href); }} className="flex-row items-center justify-between rounded-xl border border-[#BBCAC3] bg-white p-4" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
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

          {/* Recovery Phone */}
          <View className="gap-4">
            <Text className="text-[20px] font-semibold text-[#161D1A]">Recovery Phone Number</Text>
            <View className="rounded-xl border border-[#BBCAC3] bg-white p-4">
              <View className="mb-3 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-[rgba(39,187,151,0.1)]">
                    <MaterialIcons name="phone-android" size={20} color="#006B55" />
                  </View>
                  <View>
                    <Text className="text-[15px] font-semibold text-[#161D1A]">{maskedPhone}</Text>
                    <Text className="text-[12px]" style={{ color: hasPhone ? (phoneVerified ? "#006B55" : "#755B00") : "#BA1A1A" }}>
                      {hasPhone ? (phoneVerified ? "Verified recovery phone" : "Phone added (verification pending)") : "No recovery phone added"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push("/profile-details-edit" as Href)}
                  className="rounded-lg border border-[#27BB97] px-3 py-2"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-[12px] font-semibold text-[#006B55]">{hasPhone ? "Update" : "Add"}</Text>
                </Pressable>
              </View>
              <Text className="text-[12px] text-[#64748B]">We use this number for account recovery and important security alerts.</Text>
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
                <Text className="text-[12px] font-bold" style={{ color: isGoogleLinked ? "#006B55" : "#94A3B8" }}>{isGoogleLinked ? "Linked" : "Not Linked"}</Text>
              </View>
            </View>
          </View>

          {/* Sign Out All */}
          <View className="pt-4">
            <Pressable onPress={handleSignOutAll} className="flex-row items-center justify-center gap-2 rounded-xl p-4" style={({ pressed }) => ({ backgroundColor: pressed ? "rgba(186,26,26,0.05)" : "transparent" })}>
              <MaterialIcons name="no-accounts" size={22} color="#BA1A1A" />
              <Text className="text-[14px] font-semibold text-[#BA1A1A]">Sign out from all devices</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
