import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "@/lib/safe-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { changePassword, setupPassword } from "@/features/auth/services/auth-api";
import { showErrorToast } from "@/lib/toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProfile } from "@/store/slices/auth-slice";

function getPasswordRequirements(password: string) {
  return [
    { id: "length", label: "At least 8 characters", met: password.length >= 8 },
    { id: "number", label: "At least 1 number", met: /\d/.test(password) },
    { id: "special", label: "At least 1 special character (@, #, $)", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/home-feed-root" as Href);
  };

  const hasExistingPassword = user?.hasPassword !== false && user?.provider !== "google";
  const isGoogleOnly = user?.provider === "google" && user?.hasPassword === false;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const headerHeight = useMemo(() => insets.top + 64, [insets.top]);
  const requirements = getPasswordRequirements(newPassword);
  const allMet = requirements.every((r) => r.met) && newPassword.length > 0;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmit = isGoogleOnly
    ? allMet && passwordsMatch
    : allMet && passwordsMatch && currentPassword.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      if (isGoogleOnly) {
        await setupPassword(newPassword);
        dispatch(fetchProfile());
        handleBack();
      } else {
        const result = await changePassword(currentPassword, newPassword);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        void dispatch(fetchProfile());
        handleBack();
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to update password";
      showErrorToast("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F6F7F8]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{ paddingTop: insets.top, height: headerHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
      >
        <Pressable onPress={handleBack} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <MaterialIcons name="arrow-back" size={24} color="#27BB97" />
        </Pressable>
        <Text className="text-[20px] font-bold text-[#161D1A]">{isGoogleOnly ? "Set Password" : "Change Password"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: headerHeight + 16, paddingBottom: 40 + Math.max(insets.bottom, 8) }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-4 gap-6">
            {/* Info Banner */}
            <View className="flex-row gap-3 rounded-xl border border-[rgba(39,187,151,0.2)] bg-[rgba(39,187,151,0.1)] p-4">
              <MaterialIcons name={isGoogleOnly ? "add-circle-outline" : "info"} size={22} color="#006B55" />
              <Text className="flex-1 text-[14px] leading-5 text-[#004535]">
                {isGoogleOnly
                  ? "You signed in with Google. Set a password to also sign in with your email and password."
                  : "Choose a strong password that you haven't used before. Your password should be at least 8 characters with numbers and special characters."}
              </Text>
            </View>

            {/* Current Password (only for users with existing password) */}
            {!isGoogleOnly && (
              <View className="gap-2">
                <Text className="text-[14px] font-semibold text-[#3C4A44]">Current Password</Text>
                <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4">
                  <MaterialIcons name="lock-outline" size={20} color="#94A3B8" />
                  <TextInput
                    className="flex-1 px-3 py-4 text-[16px] text-[#161D1A]"
                    placeholder="Enter current password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showCurrent}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowCurrent(!showCurrent)}>
                    <MaterialIcons name={showCurrent ? "visibility" : "visibility-off"} size={22} color="#94A3B8" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* New Password */}
            <View className="gap-2">
              <Text className="text-[14px] font-semibold text-[#3C4A44]">New Password</Text>
              <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4">
                <MaterialIcons name="lock" size={20} color="#94A3B8" />
                <TextInput
                  className="flex-1 px-3 py-4 text-[16px] text-[#161D1A]"
                  placeholder="Enter new password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowNew(!showNew)}>
                  <MaterialIcons name={showNew ? "visibility" : "visibility-off"} size={22} color="#94A3B8" />
                </Pressable>
              </View>

              {/* Requirements */}
              <View className="mt-2 gap-1.5">
                {requirements.map((req) => (
                  <View key={req.id} className="flex-row items-center gap-2">
                    <MaterialIcons
                      name={req.met ? "check-circle" : "radio-button-unchecked"}
                      size={16}
                      color={req.met ? "#006B55" : "#CBD5E1"}
                    />
                    <Text className="text-[13px]" style={{ color: req.met ? "#006B55" : "#94A3B8" }}>{req.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Confirm Password */}
            <View className="gap-2">
              <Text className="text-[14px] font-semibold text-[#3C4A44]">Confirm New Password</Text>
              <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-4" style={{ borderColor: confirmPassword.length > 0 ? (passwordsMatch ? "#006B55" : "#BA1A1A") : "#E2E8F0" }}>
                <MaterialIcons name="lock" size={20} color="#94A3B8" />
                <TextInput
                  className="flex-1 px-3 py-4 text-[16px] text-[#161D1A]"
                  placeholder="Re-enter new password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowConfirm(!showConfirm)}>
                  <MaterialIcons name={showConfirm ? "visibility" : "visibility-off"} size={22} color="#94A3B8" />
                </Pressable>
              </View>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <Text className="text-[12px] text-[#BA1A1A]">Passwords do not match</Text>
              )}
            </View>

            {/* Forgot Password Link */}
            {!isGoogleOnly && (
              <Pressable
                onPress={() => router.push("/forgot-password")}
                className="self-start"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-[14px] font-medium text-[#27BB97]">Forgot your current password?</Text>
              </Pressable>
            )}

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit || loading}
              className="overflow-hidden rounded-xl"
              style={({ pressed }) => ({ opacity: !canSubmit ? 0.5 : pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <LinearGradient
                colors={canSubmit ? ["#27BB97", "#006B55"] : ["#CBD5E1", "#94A3B8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name={isGoogleOnly ? "add-circle-outline" : "lock-reset"} size={22} color="#FFFFFF" />
                    <Text className="text-[18px] font-bold text-white">{isGoogleOnly ? "Set Password" : "Update Password"}</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
