import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "@/lib/safe-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native";

import { showErrorToast } from "@/lib/toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearError, clearResetFlow, forgotPassword } from "@/store/slices/auth-slice";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { status, error, resetEmail } = useAppSelector((s) => s.auth);
  const [identity, setIdentity] = useState("");

  const headerHeight = useMemo(() => insets.top + 64, [insets.top]);
  const isLoading = status === "loading";

  // Clear any stale reset flow state left over from a previous session.
  // Without this, restoreSession would rehydrate resetEmail and the old
  // useEffect would skip this screen entirely on mount.
  useEffect(() => {
    dispatch(clearResetFlow());
  }, []);

  useEffect(() => {
    if (error) {
      showErrorToast("Error", error);
      dispatch(clearError());
    }
  }, [dispatch, error]);

  useEffect(() => {
    if (resetEmail) {
      router.push("/reset-otp-verification" as Href);
    }
  }, [resetEmail, router]);

  const handleSendCode = async () => {
    const trimmed = identity.trim();
    if (!trimmed) {
      showErrorToast("Required", "Please enter your email.");
      return;
    }
    const result = await dispatch(forgotPassword({ email: trimmed.toLowerCase() }));
    if (forgotPassword.fulfilled.match(result)) {
      router.push("/reset-otp-verification" as Href);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-[#F6F7F8]">
      <View className="absolute inset-0 overflow-hidden">
        <View className="absolute -left-12 -top-24 h-64 w-64 rounded-full bg-[#006B55]/5 blur-3xl" />
        <View className="absolute -bottom-24 -right-12 h-48 w-48 rounded-full bg-[#005FB0]/5 blur-3xl" />
      </View>

      <View
        className="absolute inset-x-0 top-0 z-50 h-16 flex-row items-center px-4"
        style={{ paddingTop: insets.top, height: headerHeight }}
      >
        <Pressable
          onPress={() => {
            router.back();
          }}
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <MaterialIcons name="arrow-back" size={24} color="#161D1A" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 w-full"
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: headerHeight + 24,
            paddingBottom: Math.max(insets.bottom + 32, 48),
            paddingHorizontal: 16,
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          <View className="relative mx-auto w-full max-w-md gap-6">
            <View className="relative z-10 items-center gap-2 pt-8">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-[#27BB97]/10">
                <MaterialIcons name="lock-reset" size={32} color="#006B55" />
              </View>
              <Text className="text-center text-[24px] font-bold tracking-[-0.48px] text-[#161D1A]">
                Forgot Password?
              </Text>
              <Text className="max-w-70 text-center text-[14px] leading-5 text-[#3C4A44]">
                Enter your registered email or phone to reset
              </Text>
            </View>

            <View className="relative z-10 gap-4 rounded-xl border border-[#DDE4DF]/50 bg-white/70 p-6 shadow-sm">
              <View className="gap-1">
                <Text className="text-[12px] font-medium tracking-[0.24px] text-[#161D1A]">
                  Email or Phone
                </Text>
                <View className="relative justify-center">
                  <MaterialIcons
                    name="alternate-email"
                    size={20}
                    color="#6C7A74"
                    style={{ position: "absolute", left: 16, zIndex: 1 }}
                  />
                  <TextInput
                    value={identity}
                    onChangeText={setIdentity}
                    placeholder="your@email.com or +91..."
                    placeholderTextColor="rgba(108,122,116,0.5)"
                    autoCapitalize="none"
                    className="h-12 rounded-lg border border-[#BBCAC3] bg-white pl-12 pr-4 text-[14px] text-[#161D1A]"
                  />
                </View>
              </View>

              <Pressable
                onPress={handleSendCode}
                disabled={isLoading}
                style={({ pressed }) => [
                  { transform: [{ scale: pressed ? 0.98 : 1 }] },
                  { opacity: isLoading ? 0.7 : 1 },
                ]}
                className="overflow-hidden rounded-lg"
              >
                <LinearGradient
                  colors={["#27BB97", "#1E9E7E"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  className="h-12 flex-row items-center justify-center gap-2 rounded-lg"
                  style={{
                    shadowColor: "rgba(39,187,151,0.2)",
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 1,
                    shadowRadius: 18,
                    elevation: 6,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-[18px] font-semibold text-white">
                      Send Code
                    </Text>
                  )}
                  {!isLoading && <MaterialIcons name="send" size={20} color="#FFFFFF" />}
                </LinearGradient>
              </Pressable>
            </View>

            <View className="relative z-10 items-center gap-4">
              <View className="w-full flex-row items-center gap-2">
                <View className="h-px flex-1 bg-[#BBCAC3]/30" />
                <Text className="text-[12px] font-medium tracking-[0.24px] text-[#6C7A74]">
                  OR
                </Text>
                <View className="h-px flex-1 bg-[#BBCAC3]/30" />
              </View>

              <Pressable
                onPress={() => {
                  router.push("/sign-in" as Href);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="flex-row items-center gap-2 py-2"
              >
                <Text className="text-[14px] text-[#3C4A44]">Back to</Text>
                <Text className="text-[14px] font-semibold text-[#006B55]">
                  Login
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
