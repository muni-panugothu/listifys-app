import { type Href, useRouter } from "@/lib/safe-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";

import {
  ProfileSectionCard,
  ProfileSubScreenLayout,
} from "@/components/profile-sub-screen-layout";
import { SettingsMenuRow } from "@/components/settings-menu-row";
import {
  type SettingsPreferences,
  getSettingsPreferences,
  updateSettingsPreferences,
} from "@/features/auth/services/auth-api";
import { ListifyFonts } from "@/constants/typography";
import { useAppSelector } from "@/store/hooks";

export function SettingsScreen() {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);

  const [preferences, setPreferences] = useState<SettingsPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof SettingsPreferences | null>(null);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getSettingsPreferences();
      setPreferences(response.preferences);
    } catch (error) {
      Alert.alert(
        "Settings",
        error instanceof Error ? error.message : "Failed to load settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPreferences();
    }, [loadPreferences]),
  );

  const updatePreference = useCallback(
    async <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => {
      if (!preferences) return;

      const previous = preferences;
      const next = { ...previous, [key]: value };
      setPreferences(next);
      setSavingKey(key);

      try {
        const response = await updateSettingsPreferences({ [key]: value });
        setPreferences(response.preferences);
      } catch (error) {
        setPreferences(previous);
        Alert.alert(
          "Settings",
          error instanceof Error ? error.message : "Failed to update settings.",
        );
      } finally {
        setSavingKey(null);
      }
    },
    [preferences],
  );

  const push = (route: string) => router.push(route as Href);

  return (
    <ProfileSubScreenLayout title="Settings">
      <ProfileSectionCard title="Account">
        <SettingsMenuRow
          icon="person-outline"
          iconBg="rgba(39,187,151,0.12)"
          iconColor="#27BB97"
          label="Edit profile"
          type="navigate"
          onPress={() => push("/profile-details-edit")}
        />
        <SettingsMenuRow
          icon="lock-reset"
          iconBg="rgba(139,92,246,0.12)"
          iconColor="#8B5CF6"
          label={user?.hasPassword === false ? "Set password" : "Change password"}
          subtitle={
            user?.hasPassword === false
              ? "Add a password to your account"
              : "Update your login password"
          }
          type="navigate"
          onPress={() => push("/change-password")}
          showDivider
        />
        <SettingsMenuRow
          icon="lock-open"
          iconBg="rgba(244,63,156,0.12)"
          iconColor="#F43F9C"
          label="Forgot password"
          subtitle="Reset via email OTP"
          type="navigate"
          onPress={() => push("/forgot-password")}
        />
      </ProfileSectionCard>

      <ProfileSectionCard title="Notifications">
        <SettingsMenuRow
          icon="notifications-active"
          iconBg="rgba(59,130,246,0.12)"
          iconColor="#3B82F6"
          label="Push notifications"
          subtitle="Orders, messages, and activity"
          type="toggle"
          value={preferences?.pushNotifications ?? true}
          onToggle={(value) => void updatePreference("pushNotifications", value)}
          disabled={loading || savingKey === "pushNotifications"}
        />
        <SettingsMenuRow
          icon="mail"
          iconBg="rgba(244,63,156,0.12)"
          iconColor="#F472B6"
          label="Email updates"
          subtitle="News and marketplace updates"
          type="toggle"
          value={preferences?.marketingEmails ?? false}
          onToggle={(value) => void updatePreference("marketingEmails", value)}
          disabled={loading || savingKey === "marketingEmails"}
          showDivider
        />
      </ProfileSectionCard>

      <ProfileSectionCard title="Support">
        <SettingsMenuRow
          icon="help-outline"
          iconBg="#F3F4F6"
          iconColor="#6B7280"
          label="Help & support"
          type="navigate"
          onPress={() => Linking.openURL("mailto:support@listifys.com")}
        />
        <SettingsMenuRow
          icon="bug-report"
          iconBg="#F3F4F6"
          iconColor="#6B7280"
          label="Report a problem"
          type="navigate"
          onPress={() =>
            Linking.openURL("mailto:bugs@listifys.com?subject=Bug%20Report")
          }
          showDivider
        />
      </ProfileSectionCard>

      <ProfileSectionCard title="Legal">
        <SettingsMenuRow
          icon="info"
          iconBg="#F3F4F6"
          iconColor="#6B7280"
          label="About Listify"
          type="navigate"
          onPress={() => {}}
        />
        <SettingsMenuRow
          icon="policy"
          iconBg="#F3F4F6"
          iconColor="#6B7280"
          label="Privacy policy"
          type="navigate"
          onPress={() => {}}
          showDivider
        />
        <SettingsMenuRow
          icon="description"
          iconBg="#F3F4F6"
          iconColor="#6B7280"
          label="Terms of service"
          type="navigate"
          onPress={() => {}}
        />
      </ProfileSectionCard>

      <ProfileSectionCard>
        <View className="flex-row items-center justify-between px-4 py-3.5">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#F3F4F6]">
              <Text style={{ fontFamily: ListifyFonts.bold, color: "#9CA3AF" }}>v</Text>
            </View>
            <Text
              className="text-[16px] text-[#1A1A1A]"
              style={{ fontFamily: ListifyFonts.medium }}
            >
              App version
            </Text>
          </View>
          <Text
            className="rounded-lg bg-[#F6F7F8] px-2.5 py-1 text-[12px] text-[#6B7280]"
            style={{ fontFamily: ListifyFonts.semiBold }}
          >
            2.4.1
          </Text>
        </View>
      </ProfileSectionCard>

      <Pressable
        onPress={() => router.push("/logout-modal" as Href)}
        className="mt-2 h-14 items-center justify-center rounded-2xl border border-red-100 bg-white"
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        <Text
          className="text-[16px] text-red-600"
          style={{ fontFamily: ListifyFonts.semiBold }}
        >
          Sign out
        </Text>
      </Pressable>
    </ProfileSubScreenLayout>
  );
}
