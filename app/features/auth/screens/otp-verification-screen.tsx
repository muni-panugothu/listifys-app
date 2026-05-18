import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "@/lib/safe-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_SCREEN_BG } from "@/constants/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  resetAuthStatus,
  resendOtp,
  sendPhoneOtp,
  verifyOtp,
  verifyPhoneOtp,
} from "@/store/slices/auth-slice";

const OTP_LENGTH = 6;
const INITIAL_TIMER = 59;

function normalizeOtp(value: string) {
  return value.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export function OtpVerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { status, isAuthenticated, registrationEmail, registrationPhone } =
    useAppSelector((s) => s.auth);

  const [otp, setOtp] = useState("");
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(INITIAL_TIMER);
  const inputRef = useRef<TextInput>(null);

  const headerHeight = useMemo(() => insets.top + 52, [insets.top]);
  const isLoading = status === "loading";
  const timerLabel = `00:${String(secondsRemaining).padStart(2, "0")}`;
  const canResend = secondsRemaining === 0;
  const isEmailFlow = Boolean(registrationEmail && !registrationPhone);
  const isVerifyEnabled = otp.length === OTP_LENGTH;

  const otpSlots = useMemo(() => {
    const chars = otp.split("");
    return Array.from({ length: OTP_LENGTH }, (_, index) => chars[index] ?? "");
  }, [otp]);

  const contactSubtitle = useMemo(() => {
    if (registrationPhone) {
      const digits = registrationPhone.replace(/\D/g, "");
      if (digits.length >= 10) {
        return `+${digits.slice(0, 1)} ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
      }
      return registrationPhone;
    }
    return registrationEmail ?? "";
  }, [registrationEmail, registrationPhone]);

  useEffect(() => {
    dispatch(resetAuthStatus());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(tabs)/home-feed-root" as Href);
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(focusTimer);
  }, []);

  useEffect(() => {
    if (secondsRemaining === 0) return;
    const timer = setTimeout(() => {
      setSecondsRemaining((current) => current - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [secondsRemaining]);

  const handleOtpChange = (value: string) => {
    setVerificationError(null);
    setOtp(normalizeOtp(value));
  };

  const handleVerify = async () => {
    if (!registrationEmail && !registrationPhone) {
      Alert.alert("Error", "Registration session expired. Please start over.");
      router.replace("/sign-up" as Href);
      return;
    }

    if (!isVerifyEnabled) {
      setVerificationError("Please enter the full 6-digit code.");
      return;
    }

    setVerificationError(null);

    try {
      if (registrationPhone) {
        await dispatch(verifyPhoneOtp({ phone: registrationPhone, otp })).unwrap();
      } else {
        await dispatch(
          verifyOtp({ email: registrationEmail as string, otp }),
        ).unwrap();
      }
    } catch (message) {
      const errorText =
        typeof message === "string" && message.trim().length > 0
          ? message
          : "Invalid verification code. Please try again.";
      setVerificationError(errorText);
      setOtp("");
      inputRef.current?.focus();
      dispatch(resetAuthStatus());
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setVerificationError(null);
    setOtp("");

    try {
      if (registrationPhone) {
        await dispatch(sendPhoneOtp({ phone: registrationPhone })).unwrap();
      } else if (registrationEmail) {
        await dispatch(resendOtp({ email: registrationEmail })).unwrap();
      } else {
        return;
      }
      setSecondsRemaining(INITIAL_TIMER);
      inputRef.current?.focus();
    } catch (message) {
      const errorText =
        typeof message === "string" && message.trim().length > 0
          ? message
          : "Could not resend code. Please try again.";
      setVerificationError(errorText);
      dispatch(resetAuthStatus());
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: APP_SCREEN_BG }}>
      <StatusBar style="dark" />

      <View
        className="flex-row items-center px-4"
        style={{ paddingTop: insets.top + 8, height: headerHeight }}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <MaterialIcons name="arrow-back" size={24} color="#161D1A" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16,
            flexGrow: 1,
          }}
        >
          <View className="w-full max-w-md self-center">
            <View className="relative mb-6 items-center">
              <View className="h-24 w-24 items-center justify-center rounded-full bg-[#27BB97]/10">
                <MaterialIcons
                  name={isEmailFlow ? "mark-email-unread" : "sms"}
                  size={48}
                  color="#006B55"
                />
              </View>
            </View>

            <View className="mb-6 items-center gap-2">
              <Text className="text-center text-[24px] font-bold tracking-[-0.48px] text-[#161D1A]">
                Enter verification code
              </Text>
              <Text className="max-w-[300px] text-center text-[14px] leading-5 text-[#3C4A44]">
                We sent a 6-digit code to{" "}
                <Text className="font-semibold text-[#161D1A]">{contactSubtitle}</Text>
              </Text>
            </View>

            <Pressable
              onPress={() => inputRef.current?.focus()}
              className="relative mb-2 w-full flex-row justify-between gap-2"
            >
              {otpSlots.map((digit, index) => (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    digit ? styles.otpBoxFilled : null,
                    verificationError ? styles.otpBoxError : null,
                  ]}
                >
                  <Text style={styles.otpBoxText}>{digit || "–"}</Text>
                </View>
              ))}
              <TextInput
                ref={inputRef}
                value={otp}
                onChangeText={handleOtpChange}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
                maxLength={OTP_LENGTH}
                caretHidden
                style={styles.hiddenInput}
              />
            </Pressable>

            <Text className="mb-2 text-center text-[13px] text-[#6C7A74]">
              Tap the boxes to enter your code
            </Text>

            {verificationError ? (
              <View className="mb-3 flex-row items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-2">
                <MaterialIcons name="error-outline" size={18} color="#DC2626" />
                <Text className="flex-1 text-center text-[13px] font-medium text-red-600">
                  {verificationError}
                </Text>
              </View>
            ) : null}

            <View className="mt-2 items-center gap-2">
              {canResend ? (
                <Pressable onPress={handleResend} hitSlop={8} disabled={isLoading}>
                  <Text className="text-center text-[14px] text-[#3C4A44]">
                    Didn&apos;t receive the code?{" "}
                    <Text className="font-semibold text-[#006B55]">Resend</Text>
                  </Text>
                </Pressable>
              ) : (
                <Text className="text-center text-[14px] text-[#3C4A44]">
                  Resend code in{" "}
                  <Text className="font-semibold text-[#161D1A]">{timerLabel}</Text>
                </Text>
              )}
            </View>

            {isEmailFlow ? (
              <View className="mt-6 flex-row items-start gap-4 rounded-xl border border-[#DDE4DF]/50 bg-white/70 p-4">
                <View className="rounded-lg bg-[#006B55]/10 p-2">
                  <MaterialIcons name="info-outline" size={20} color="#006B55" />
                </View>
                <View className="flex-1">
                  <Text className="mb-1 text-[12px] font-bold text-[#161D1A]">
                    Check your spam folder
                  </Text>
                  <Text className="text-[13px] leading-5 text-[#3C4A44]">
                    If you don&apos;t see the email in your inbox, check junk or spam.
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View
          className="border-t border-[#DDE4DF] bg-white px-4 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <Pressable
            onPress={handleVerify}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.verifyButton,
              !isVerifyEnabled && !isLoading ? styles.verifyButtonDisabled : null,
              pressed && isVerifyEnabled && !isLoading ? { opacity: 0.9 } : null,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText}>
                {isVerifyEnabled ? "Verify & Continue" : "Enter 6-digit code"}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  otpBox: {
    flex: 1,
    maxWidth: 48,
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBCAC3",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  otpBoxFilled: {
    borderColor: "#27BB97",
    backgroundColor: "#F4FBF9",
  },
  otpBoxError: {
    borderColor: "#F87171",
    backgroundColor: "#FEF2F2",
  },
  otpBoxText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#161D1A",
  },
  hiddenInput: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.02,
    color: "transparent",
    fontSize: 16,
  },
  verifyButton: {
    height: 52,
    borderRadius: 9999,
    backgroundColor: "#161D1A",
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
