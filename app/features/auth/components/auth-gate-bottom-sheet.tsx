/**
 * AuthGateBottomSheet — Flipkart-style bottom sheet that appears when a guest
 * user tries to save, message, or make an offer. Shows phone input → OTP flow,
 * with a "or sign in with Google" option below.
 */
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { googleLogin, sendPhoneOtp, verifyPhoneOtp } from "@/store/slices/auth-slice";

// ── Google Sign-In dynamic import ──────────────────────────────────────────────
function isGoogleNativeModuleAvailable(): boolean {
  const proxy = (global as any).__turboModuleProxy;
  if (proxy != null) return proxy("RNGoogleSignin") != null;
  try {
    const { NativeModules } = require("react-native");
    return NativeModules.RNGoogleSignin != null;
  } catch {
    return false;
  }
}

let _googleModule: any = null;
let _googleChecked = false;

function getGoogleSigninModule() {
  if (_googleChecked) return _googleModule;
  _googleChecked = true;
  if (!isGoogleNativeModuleAvailable()) { _googleModule = null; return null; }
  try { _googleModule = require("@react-native-google-signin/google-signin"); } catch { _googleModule = null; }
  return _googleModule;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** What action the user was trying to do (for the title) */
  action?: "save" | "message" | "offer" | "general";
};

const ACTION_TITLES: Record<string, string> = {
  save: "Save this item",
  message: "Message the seller",
  offer: "Make an offer",
  general: "Continue",
};

export function AuthGateBottomSheet({ visible, onClose, action = "general" }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { isAuthenticated, status } = useAppSelector((s) => s.auth);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  const isLoading = status === "loading";

  // Close on successful auth
  useEffect(() => {
    if (isAuthenticated && visible) {
      onClose();
    }
  }, [isAuthenticated, visible, onClose]);

  // Animate in
  useEffect(() => {
    if (visible) {
      setStep("phone");
      setPhone("");
      setOtp("");
      setLocalError("");
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // Configure Google Sign-In once
  useEffect(() => {
    const gm = getGoogleSigninModule();
    if (gm) {
      gm.GoogleSignin.configure({
        webClientId: "335766515911-5corrme09mfaplitd0r9ra9k7m2nr76i.apps.googleusercontent.com",
        offlineAccess: false,
      });
    }
  }, []);

  const handleSendOtp = useCallback(async () => {
    const cleaned = phone.trim().replace(/\s+/g, "");
    if (cleaned.length < 10) {
      setLocalError("Enter a valid phone number");
      return;
    }
    setLocalError("");
    const formattedPhone = cleaned.startsWith("+") ? cleaned : `+91${cleaned}`;
    try {
      const result = await dispatch(sendPhoneOtp({ phone: formattedPhone })).unwrap();
      if (result.success) {
        setStep("otp");
      }
    } catch (err: any) {
      setLocalError(typeof err === "string" ? err : "Failed to send OTP");
    }
  }, [phone, dispatch]);

  const handleVerifyOtp = useCallback(async () => {
    if (otp.length < 4) {
      setLocalError("Enter the OTP sent to your phone");
      return;
    }
    setLocalError("");
    const formattedPhone = phone.trim().startsWith("+") ? phone.trim() : `+91${phone.trim()}`;
    try {
      await dispatch(verifyPhoneOtp({ phone: formattedPhone, otp })).unwrap();
      // Auth slice will set isAuthenticated → useEffect above closes sheet
    } catch (err: any) {
      setLocalError(typeof err === "string" ? err : "Invalid OTP");
    }
  }, [otp, phone, dispatch]);

  const handleGoogleSignIn = useCallback(async () => {
    const gm = getGoogleSigninModule();
    if (!gm) {
      Alert.alert("Google Sign In", "Google Sign-In not available in this build.");
      return;
    }

    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = gm;

    try {
      setIsGoogleLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      try { await GoogleSignin.signOut(); } catch { /* ok */ }
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken;
        if (idToken) {
          await dispatch(googleLogin({ idToken })).unwrap();
        }
      }
    } catch (err: any) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS) return;
      }
      Alert.alert("Google Sign In", "Sign in failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  }, [dispatch]);

  const title = `Sign in to ${ACTION_TITLES[action] ?? "continue"}`;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} className="flex-1 bg-black/40">
        <View style={{ flex: 1 }} />
      </Pressable>

      <Animated.View
        style={{
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [600, 0],
            }),
          }],
        }}
      >
        <View
          className="rounded-t-3xl bg-white"
          style={{
            paddingBottom: Math.max(insets.bottom, 20),
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -12 },
            shadowOpacity: 0.15,
            shadowRadius: 40,
            elevation: 24,
          }}
        >
          {/* Handle */}
          <View className="items-center py-3">
            <View className="h-1.5 w-12 rounded-full bg-slate-200" />
          </View>

          <View className="px-5 pb-4">
            {/* Header */}
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-[22px] font-bold tracking-tight text-[#161D1A]">
                {title}
              </Text>
              <Pressable onPress={onClose} className="rounded-full p-2">
                <MaterialIcons name="close" size={22} color="#94A3B8" />
              </Pressable>
            </View>
            <Text className="mb-6 text-[14px] text-[#6C7A74]">
              {step === "phone"
                ? "Enter your mobile number to get started"
                : `We sent a code to +91${phone.replace(/^\+91/, "")}`}
            </Text>

            {/* Error */}
            {localError ? (
              <View className="mb-4 flex-row items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
                <MaterialIcons name="error-outline" size={18} color="#EF4444" />
                <Text className="flex-1 text-[13px] text-red-600">{localError}</Text>
              </View>
            ) : null}

            {step === "phone" ? (
              <>
                {/* Phone Input */}
                <View className="mb-5 h-14 flex-row items-center rounded-xl border-2 border-slate-100 bg-slate-50 px-4">
                  <Text className="mr-2 text-[16px] font-medium text-[#3C4A44]">+91</Text>
                  <View className="mr-2 h-6 w-px bg-slate-200" />
                  <TextInput
                    value={phone}
                    onChangeText={(val) => { setPhone(val.replace(/[^0-9]/g, "")); setLocalError(""); }}
                    placeholder="Enter mobile number"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    maxLength={10}
                    className="flex-1 text-[16px] font-medium text-[#161D1A]"
                    style={{ paddingVertical: 0 }}
                    autoFocus
                  />
                </View>

                {/* Send OTP Button */}
                <Pressable
                  onPress={handleSendOtp}
                  disabled={isLoading}
                  className="mb-4 h-14 items-center justify-center rounded-xl bg-[#27BB97]"
                  style={{
                    opacity: isLoading ? 0.7 : 1,
                    shadowColor: "#27BB97",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-[16px] font-bold text-white">Send OTP</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                {/* OTP Input */}
                <View className="mb-5 h-14 flex-row items-center rounded-xl border-2 border-slate-100 bg-slate-50 px-4">
                  <MaterialIcons name="lock-outline" size={20} color="#94A3B8" />
                  <TextInput
                    value={otp}
                    onChangeText={(val) => { setOtp(val.replace(/[^0-9]/g, "")); setLocalError(""); }}
                    placeholder="Enter OTP"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                    className="ml-3 flex-1 text-[18px] font-bold tracking-[8px] text-[#161D1A]"
                    style={{ paddingVertical: 0 }}
                    autoFocus
                  />
                </View>

                {/* Verify Button */}
                <Pressable
                  onPress={handleVerifyOtp}
                  disabled={isLoading}
                  className="mb-3 h-14 items-center justify-center rounded-xl bg-[#27BB97]"
                  style={{
                    opacity: isLoading ? 0.7 : 1,
                    shadowColor: "#27BB97",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-[16px] font-bold text-white">Verify & Continue</Text>
                  )}
                </Pressable>

                {/* Back to phone */}
                <Pressable onPress={() => { setStep("phone"); setOtp(""); setLocalError(""); }} className="mb-2 items-center py-2">
                  <Text className="text-[14px] font-medium text-[#27BB97]">Change number</Text>
                </Pressable>
              </>
            )}

            {/* Divider */}
            <View className="my-4 flex-row items-center">
              <View className="h-px flex-1 bg-slate-200" />
              <Text className="mx-4 text-[12px] font-medium uppercase tracking-wider text-[#94A3B8]">or</Text>
              <View className="h-px flex-1 bg-slate-200" />
            </View>

            {/* Google Sign In */}
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="mb-3 h-14 flex-row items-center justify-center gap-3 rounded-xl border-2 border-slate-100 bg-white"
              style={{ opacity: isGoogleLoading ? 0.7 : 1 }}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color="#4285F4" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#4285F4" />
                  <Text className="text-[15px] font-semibold text-[#161D1A]">
                    Sign in with Google
                  </Text>
                </>
              )}
            </Pressable>

            {/* Sign in with email link */}
            <Pressable
              onPress={() => { onClose(); router.push("/sign-in" as Href); }}
              className="items-center py-3"
            >
              <Text className="text-[14px] text-[#6C7A74]">
                Have an account?{" "}
                <Text className="font-semibold text-[#27BB97]">Sign in with email</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
