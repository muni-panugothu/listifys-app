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

import { ListifyOnboardingAssets } from "@/constants/listify-theme";
import { Image } from "@/lib/nativewind-interop";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearError, clearResetFlow, resetPassword } from "@/store/slices/auth-slice";

function getPasswordRequirements(password: string) {
  return [
    {
      id: "length",
      label: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      id: "number",
      label: "At least 1 number",
      met: /\d/.test(password),
    },
    {
      id: "special",
      label: "At least 1 special character (@, #, $)",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export function NewPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { status, error, resetToken, resetEmail } = useAppSelector((s) => s.auth);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);

  const headerHeight = useMemo(() => insets.top + 64, [insets.top]);
  const requirements = getPasswordRequirements(password);
  const canReset =
    requirements.every((requirement) => requirement.met) &&
    password.length > 0 &&
    password === confirmPassword;
  const isLoading = status === "loading";

  useEffect(() => {
    if (error) {
      showErrorToast("Reset Failed", error);
      dispatch(clearError());
    }
  }, [dispatch, error]);

  const handleResetPassword = async () => {
    if (!resetToken || !resetEmail) {
      showErrorToast("Error", "Session expired. Please start over.");
      router.replace("/forgot-password" as Href);
      return;
    }

    if (!password || !confirmPassword) {
      showErrorToast("Required", "Please fill in both password fields.");
      return;
    }

    if (!requirements.every((requirement) => requirement.met)) {
      showErrorToast(
        "Weak Password",
        "Use 8+ chars with at least one number and one special character.",
      );
      return;
    }

    if (password.trim() !== confirmPassword.trim()) {
      showErrorToast("Mismatch", "Password and confirm password do not match.");
      return;
    }

    const action = await dispatch(resetPassword({ resetToken, password, email: resetEmail }));
    if (action.meta.requestStatus === "fulfilled") {
      dispatch(clearResetFlow());
      showSuccessToast("Success", "Password reset successfully. Please sign in.");
      setTimeout(() => {
        router.replace("/sign-in" as Href);
      }, 700);
    }
  };

  return (
    <View className="flex-1 items-center bg-[#F6F7F8]">
      <View className="absolute inset-0 overflow-hidden">
        <View className="absolute -right-24 -top-24 h-75 w-75 rounded-full bg-[#27BB97]/5 blur-[100px]" />
        <View className="absolute -bottom-24 -left-24 h-75 w-75 rounded-full bg-[#5BA2FF]/5 blur-[100px]" />
      </View>

      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/80 px-4"
        style={{ paddingTop: insets.top, height: headerHeight }}
      >
        <Pressable
          onPress={() => {
            router.back();
          }}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </Pressable>

        <View
          className="absolute inset-x-0 items-center"
          style={{ top: insets.top + 18 }}
        >
          <Text className="text-xl font-black tracking-tight text-[#27BB97]">
            Listify
          </Text>
        </View>

        <View className="h-10 w-10" />
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
            paddingBottom: Math.max(insets.bottom + 24, 32),
            paddingHorizontal: 16,
            flexGrow: 1,
          }}
        >
          <View className="mx-auto flex-1 w-full max-w-md">
            <View
              className="mb-6 overflow-hidden rounded-xl border border-slate-100 bg-[#F3F4F6] shadow-sm"
              style={{ aspectRatio: 16 / 9 }}
            >
              <Image
                source={ListifyOnboardingAssets.newPasswordSecurityIllustration}
                contentFit="cover"
                transition={150}
                className="h-full w-full opacity-80"
              />
              <View className="absolute inset-0 bg-white/20" />
              <LinearGradient
                colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.4)"]}
                className="absolute inset-0"
              />
            </View>

            <View className="mb-6 gap-1">
              <Text className="text-[24px] font-bold tracking-[-0.48px] text-[#161D1A]">
                Set New Password
              </Text>
              <Text className="text-[14px] leading-5 text-[#6C7A74]">
                Create a strong password for your account
              </Text>
            </View>

            <View className="flex-1 gap-4">
              <View className="gap-2">
                <Text className="text-[12px] font-medium tracking-[0.24px] text-[#161D1A]">
                  New Password
                </Text>
                <View className="relative justify-center">
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#CBD5E1"
                    secureTextEntry={!isPasswordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="h-12 rounded-lg border border-[#F3F4F6] bg-white px-4 pr-12 text-[14px] text-[#161D1A]"
                  />
                  <Pressable
                    onPress={() => {
                      setIsPasswordVisible((current) => !current);
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="absolute right-4 h-10 w-10 items-center justify-center rounded-full"
                  >
                    <MaterialIcons
                      name={isPasswordVisible ? "visibility-off" : "visibility"}
                      size={22}
                      color="#94A3B8"
                    />
                  </Pressable>
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-[12px] font-medium tracking-[0.24px] text-[#161D1A]">
                  Confirm New Password
                </Text>
                <View className="relative justify-center">
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#CBD5E1"
                    secureTextEntry={!isConfirmPasswordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="h-12 rounded-lg border border-[#F3F4F6] bg-white px-4 pr-12 text-[14px] text-[#161D1A]"
                  />
                  <Pressable
                    onPress={() => {
                      setIsConfirmPasswordVisible((current) => !current);
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="absolute right-4 h-10 w-10 items-center justify-center rounded-full"
                  >
                    <MaterialIcons
                      name={
                        isConfirmPasswordVisible
                          ? "visibility-off"
                          : "visibility"
                      }
                      size={22}
                      color="#94A3B8"
                    />
                  </Pressable>
                </View>
              </View>

              <View className="mt-2 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <Text className="mb-3 text-[12px] font-medium tracking-[0.24px] text-[#BBCAC3]">
                  Security Requirements
                </Text>
                <View className="gap-3">
                  {requirements.map((requirement) => (
                    <View
                      key={requirement.id}
                      className="flex-row items-center gap-3"
                    >
                      <View
                        className="h-5 w-5 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: requirement.met
                            ? "rgba(39,187,151,0.1)"
                            : "#DDE4DF",
                        }}
                      >
                        <MaterialIcons
                          name={
                            requirement.met ? "check" : "radio-button-unchecked"
                          }
                          size={14}
                          color={requirement.met ? "#006B55" : "#6C7A74"}
                        />
                      </View>
                      <Text
                        className="flex-1 text-[14px]"
                        style={{
                          color: requirement.met ? "#161D1A" : "#6C7A74",
                        }}
                      >
                        {requirement.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className="mt-6 pb-4">
              <Pressable
                onPress={handleResetPassword}
                disabled={isLoading}
                style={({ pressed }) => [
                  { transform: [{ scale: pressed && !isLoading ? 0.95 : 1 }] },
                  { opacity: !isLoading ? 1 : 0.55 },
                ]}
                className="overflow-hidden rounded-lg"
              >
                <LinearGradient
                  colors={["#27BB97", "#1E9E7E"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  className="h-12 items-center justify-center rounded-lg"
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
                      Reset Password
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>

              <Text className="mt-4 text-center text-[12px] font-medium tracking-[0.24px] text-[#6C7A74]">
                Need help?{" "}
                <Text className="font-semibold text-[#27BB97]">
                  Contact Support
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
