import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppSelector } from "@/store/hooks";

const SETTINGS_KEY = "@listify/app_settings";

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const user = useAppSelector((s) => s.auth.user);

  const [darkMode, setDarkMode] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved.darkMode !== undefined) setDarkMode(saved.darkMode);
          if (saved.pushNotifications !== undefined) setPushNotifications(saved.pushNotifications);
          if (saved.emailUpdates !== undefined) setEmailUpdates(saved.emailUpdates);
        } catch { /* ignore */ }
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ darkMode, pushNotifications, emailUpdates }));
  }, [darkMode, pushNotifications, emailUpdates, loaded]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home-feed-root" as Href);
  };

  type SettingRow = { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; subtitle?: string; type: "toggle" | "navigate"; value?: boolean; onToggle?: (v: boolean) => void; route?: string; onPress?: () => void };

  const sections: { title: string; items: SettingRow[] }[] = [
    {
      title: "Account",
      items: [
        { icon: "person-outline", label: "Edit Profile", type: "navigate", route: "/profile-details-edit" },
        { icon: "lock-reset", label: user?.hasPassword === false ? "Set Password" : "Change Password", subtitle: user?.hasPassword === false ? "Add password to your account" : "Old password → New password", type: "navigate", route: "/change-password" },
        { icon: "lock-open", label: "Forgot Password", subtitle: "Reset via email OTP verification", type: "navigate", route: "/forgot-password" },
        { icon: "shield", label: "Security", subtitle: "2FA, biometrics, devices", type: "navigate", route: "/security" },
      ],
    },
    {
      title: "Preferences",
      items: [
        { icon: "dark-mode", label: "Dark Mode", type: "toggle", value: darkMode, onToggle: setDarkMode },
        { icon: "language", label: "Language", subtitle: "English (US)", type: "navigate" },
      ],
    },
    {
      title: "Notifications",
      items: [
        { icon: "notifications-active", label: "Push notifications", type: "toggle", value: pushNotifications, onToggle: setPushNotifications },
        { icon: "mail", label: "Email updates", type: "toggle", value: emailUpdates, onToggle: setEmailUpdates },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: "help-outline", label: "Help & Support", type: "navigate", onPress: () => Linking.openURL("mailto:support@listifys.com") },
        { icon: "bug-report", label: "Report a Problem", type: "navigate", onPress: () => Linking.openURL("mailto:bugs@listifys.com?subject=Bug%20Report") },
      ],
    },
    {
      title: "App Info",
      items: [
        { icon: "info", label: "About Listifys", type: "navigate" },
        { icon: "policy", label: "Privacy Policy", type: "navigate" },
        { icon: "description", label: "Terms of Service", type: "navigate" },
      ],
    },
  ];

  return (
    <View className="flex-1 bg-white">
      {/* Top Bar */}
      <View className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4" style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}>
        <View className="flex-row items-center gap-4">
          <Pressable onPress={handleBack} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="arrow-back" size={24} color="#161D1A" /></Pressable>
          <Text className="text-[20px] font-bold text-[#161D1A]">Settings</Text>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="help-outline" size={24} color="#161D1A" /></Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 40 + Math.max(insets.bottom, 8) }}>
        <View className="px-4 gap-8">
          {sections.map((section) => (
            <View key={section.title}>
              <Text className="mb-3 px-1 text-[18px] font-semibold text-[#3C4A44]">{section.title}</Text>
              <View className="overflow-hidden rounded-xl border border-slate-100 bg-white" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                {section.items.map((item, index) => (
                  <View key={item.label}>
                    <Pressable
                      onPress={() => {
                        if (item.onPress) item.onPress();
                        else if (item.route) router.push(item.route as Href);
                      }}
                      className="flex-row items-center justify-between p-4"
                      style={({ pressed }) => ({ backgroundColor: pressed ? "#F8FAFC" : "transparent" })}
                    >
                      <View className="flex-row items-center gap-4">
                        <View className="h-10 w-10 items-center justify-center rounded-full bg-teal-50"><MaterialIcons name={item.icon} size={22} color="#006B55" /></View>
                        <View>
                          <Text className="text-[16px] text-[#161D1A]">{item.label}</Text>
                          {item.subtitle && <Text className="text-[12px] text-[#3C4A44]">{item.subtitle}</Text>}
                        </View>
                      </View>
                      {item.type === "toggle" ? (
                        <Switch value={item.value} onValueChange={item.onToggle} trackColor={{ false: "#E2E8F0", true: "#27BB97" }} thumbColor="#FFFFFF" />
                      ) : (
                        <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
                      )}
                    </Pressable>
                    {index < section.items.length - 1 && <View className="mx-4 h-[1px] bg-slate-100" />}
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Version */}
          <View className="overflow-hidden rounded-xl border border-slate-100 bg-white" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <View className="flex-row items-center justify-between bg-slate-50/50 p-4">
              <View className="flex-row items-center gap-4">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"><MaterialIcons name="terminal" size={22} color="#94A3B8" /></View>
                <Text className="text-[16px] text-[#161D1A]">Version</Text>
              </View>
              <View className="rounded bg-slate-200 px-2 py-1"><Text className="text-[12px] font-bold text-[#64748B]">2.4.1</Text></View>
            </View>
          </View>

          {/* Sign Out */}
          <Pressable
            onPress={() => router.push("/logout-modal")}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-red-100 bg-white p-4"
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 })}
          >
            <MaterialIcons name="logout" size={22} color="#BA1A1A" />
            <Text className="text-[18px] font-semibold text-[#BA1A1A]">Sign Out</Text>
          </Pressable>

          <Text className="text-center text-[12px] text-[#94A3B8]">Made with passion in Bangalore</Text>
        </View>
      </ScrollView>
    </View>
  );
}
