import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "@/lib/safe-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    ListifyColors,
    ListifyOnboardingAssets,
} from "@/constants/listify-theme";
import { Image } from "@/lib/nativewind-interop";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearError, googleLogin, register, sendPhoneOtp } from "@/store/slices/auth-slice";

// Check if the native Google Sign-In TurboModule exists in this binary
function isGoogleNativeModuleAvailable(): boolean {
  const proxy = (global as any).__turboModuleProxy;
  if (proxy != null) {
    return proxy("RNGoogleSignin") != null;
  }
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

  if (!isGoogleNativeModuleAvailable()) {
    _googleModule = null;
    return null;
  }

  try {
    _googleModule = require("@react-native-google-signin/google-signin");
  } catch {
    _googleModule = null;
  }
  return _googleModule;
}

function getPasswordStrength(password: string) {
  let score = 0;

  if (password.length >= 8) {
    score += 1;
  }

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) {
    score += 1;
  }

  if (/\d/.test(password)) {
    score += 1;
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  }

  if (score >= 4) {
    return { label: "Strong password", activeBars: 4, color: "#27BB97" };
  }

  if (score >= 2) {
    return { label: "Medium password", activeBars: 2, color: "#F59E0B" };
  }

  return {
    label: "Weak password",
    activeBars: password.length > 0 ? 1 : 0,
    color: "#9CA3AF",
  };
}

export function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { status, error, registrationEmail, registrationPhone, isAuthenticated } = useAppSelector(
    (s) => s.auth,
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otpChannel, setOtpChannel] = useState<"sms" | "whatsapp">("sms");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const headerHeight = useMemo(() => insets.top + 64, [insets.top]);
  const passwordStrength = getPasswordStrength(password);
  const isLoading = status === "loading";
  const isPhoneOnlyMode =
    !!phoneNumber.trim() &&
    !fullName.trim() &&
    !email.trim() &&
    !password;

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/home-feed-root" as Href);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (registrationEmail || registrationPhone) {
      router.push("/otp-verification" as Href);
    }
  }, [registrationEmail, registrationPhone]);

  useEffect(() => {
    if (error) {
      Alert.alert("Registration Failed", error);
      dispatch(clearError());
    }
  }, [error]);

  useEffect(() => {
    const googleModule = getGoogleSigninModule();
    if (!googleModule) return;

    googleModule.GoogleSignin.configure({
      webClientId: "335766515911-5corrme09mfaplitd0r9ra9k7m2nr76i.apps.googleusercontent.com",
      offlineAccess: false,
    });
  }, []);

  const handleGoogleSignIn = async () => {
    const googleModule = getGoogleSigninModule();
    if (!googleModule) {
      Alert.alert(
        "Google Sign In",
        "Native Google Sign-In module is missing in this build. Rebuild and reinstall the Android app.",
      );
      return;
    }

    const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } =
      googleModule;

    try {
      setIsGoogleLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Sign out first so the account chooser always appears
      try { await GoogleSignin.signOut(); } catch (_) { /* ok if not signed in */ }

      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken;
        if (idToken) {
          dispatch(googleLogin({ idToken }));
        } else {
          Alert.alert("Google Sign In", "Failed to get authentication token.");
        }
      }
    } catch (err: any) {
      if (isErrorWithCode(err)) {
        switch (err.code) {
          case statusCodes.IN_PROGRESS:
            break;
          case statusCodes.SIGN_IN_CANCELLED:
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert("Google Sign In", "Google Play Services not available.");
            break;
          default:
            Alert.alert("Google Sign In", err?.message || "Something went wrong.");
        }
      } else {
        Alert.alert("Google Sign In", err?.message || "Failed to connect.");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleCreateAccount = () => {
    if (!acceptedTerms) {
      Alert.alert("Terms Required", "Please accept the Terms & Conditions.");
      return;
    }

    if (isPhoneOnlyMode) {
      const digitsOnly = phoneNumber.replace(/\D/g, "");
      if (digitsOnly.length !== 10) {
        Alert.alert("Invalid Phone", "Please enter a valid 10-digit phone number.");
        return;
      }

      const phone = `+91${digitsOnly}`;
      dispatch(sendPhoneOtp({ phone, channel: otpChannel }));
      return;
    }

    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert(
        "Missing Details",
        "Enter phone number only for OTP signup, or fill name, email, and password.",
      );
      return;
    }

    dispatch(register({ name: fullName.trim(), email: email.trim().toLowerCase(), password }));
  };

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      <View className="absolute inset-0 overflow-hidden">
        <View className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#27BB97]/5" />
        <View className="absolute -left-24 top-1/2 h-64 w-64 rounded-full bg-[#5BA2FF]/5" />
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
          className="-ml-2 h-10 w-10 items-center justify-center rounded-full"
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

        <Pressable
          onPress={() => {
            router.replace("/home-feed-root" as Href);
          }}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          className="h-10 items-center justify-center rounded-full px-2"
        >
          <Text className="text-[13px] font-semibold text-[#27BB97]">Skip</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: headerHeight + 32,
            paddingBottom: Math.max(insets.bottom + 32, 48),
            paddingHorizontal: 16,
            flexGrow: 1,
          }}
        >
          <View className="mx-auto w-full max-w-lg">
            <View className="mb-6">
              <Text className="text-[24px] font-bold tracking-[-0.48px] text-[#161D1A]">
                Create Account
              </Text>
              <Text className="mt-1 text-[16px] leading-6 text-[#6C7A74]">
                Start your journey with Listify
              </Text>
            </View>

            <View className="gap-4">
              <View className="gap-1">
                <Text className="px-1 text-[12px] font-medium tracking-[0.24px] text-[#161D1A]">
                  Full Name
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="John Doe"
                  placeholderTextColor="#6C7A74"
                  autoCapitalize="words"
                  className="h-12 rounded-lg border border-[#BBCAC3] bg-white px-4 text-[14px] text-[#161D1A]"
                />
              </View>

              <View className="gap-1">
                <Text className="px-1 text-[12px] font-medium tracking-[0.24px] text-[#161D1A]">
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="hello@example.com"
                  placeholderTextColor="#6C7A74"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="h-12 rounded-lg border border-[#BBCAC3] bg-white px-4 text-[14px] text-[#161D1A]"
                />
              </View>

              <View className="gap-1">
                <Text className="px-1 text-[12px] font-medium tracking-[0.24px] text-[#161D1A]">
                  Phone Number
                </Text>
                <View className="flex-row gap-2">
                  <View className="h-12 w-24 items-center justify-center rounded-lg border border-[#BBCAC3] bg-[#EFF5F0]">
                    <Text className="text-[14px] text-[#3C4A44]">+91</Text>
                  </View>
                  <TextInput
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="9876543210"
                    placeholderTextColor="#6C7A74"
                    keyboardType="phone-pad"
                    className="h-12 flex-1 rounded-lg border border-[#BBCAC3] bg-white px-4 text-[14px] text-[#161D1A]"
                  />
                </View>

                {isPhoneOnlyMode && (
                  <View className="mt-2 flex-row gap-2">
                    <Pressable
                      onPress={() => setOtpChannel("sms")}
                      className={`h-10 flex-1 flex-row items-center justify-center gap-2 rounded-lg border ${
                        otpChannel === "sms"
                          ? "border-[#27BB97] bg-[#27BB97]/10"
                          : "border-[#BBCAC3] bg-white"
                      }`}
                    >
                      <MaterialIcons
                        name="sms"
                        size={18}
                        color={otpChannel === "sms" ? "#27BB97" : "#6C7A74"}
                      />
                      <Text
                        className={`text-[13px] font-semibold ${
                          otpChannel === "sms" ? "text-[#27BB97]" : "text-[#6C7A74]"
                        }`}
                      >
                        SMS
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setOtpChannel("whatsapp")}
                      className={`h-10 flex-1 flex-row items-center justify-center gap-2 rounded-lg border ${
                        otpChannel === "whatsapp"
                          ? "border-[#25D366] bg-[#25D366]/10"
                          : "border-[#BBCAC3] bg-white"
                      }`}
                    >
                      <Ionicons
                        name="logo-whatsapp"
                        size={18}
                        color={otpChannel === "whatsapp" ? "#25D366" : "#6C7A74"}
                      />
                      <Text
                        className={`text-[13px] font-semibold ${
                          otpChannel === "whatsapp" ? "text-[#25D366]" : "text-[#6C7A74]"
                        }`}
                      >
                        WhatsApp
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <View className="gap-1">
                <Text className="px-1 text-[12px] font-medium tracking-[0.24px] text-[#161D1A]">
                  Password
                </Text>
                <View className="relative justify-center">
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#6C7A74"
                    secureTextEntry={!isPasswordVisible}
                    className="h-12 rounded-lg border border-[#BBCAC3] bg-white px-4 pr-12 text-[14px] text-[#161D1A]"
                  />
                  <Pressable
                    onPress={() => {
                      setIsPasswordVisible((current) => !current);
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                    className="absolute right-3 h-10 w-10 items-center justify-center rounded-full"
                  >
                    <MaterialIcons
                      name={isPasswordVisible ? "visibility-off" : "visibility"}
                      size={22}
                      color="#BBCAC3"
                    />
                  </Pressable>
                </View>

                <View className="pt-2">
                  <View className="h-1.5 w-full flex-row gap-1">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <View
                        key={index}
                        className="flex-1 rounded-full"
                        style={{
                          backgroundColor:
                            index < passwordStrength.activeBars
                              ? passwordStrength.color
                              : "#DDE4DF",
                        }}
                      />
                    ))}
                  </View>
                  <Text
                    className="mt-1.5 text-[12px] font-medium"
                    style={{ color: passwordStrength.color }}
                  >
                    {passwordStrength.label}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  setAcceptedTerms((current) => !current);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                className="flex-row items-start gap-3 py-2"
              >
                <View className="pt-0.5">
                  <View className="h-5 w-5 items-center justify-center rounded border border-[#BBCAC3] bg-white">
                    {acceptedTerms ? (
                      <MaterialIcons
                        name="check"
                        size={16}
                        color={ListifyColors.primary}
                      />
                    ) : null}
                  </View>
                </View>

                <Text className="flex-1 text-[14px] leading-5 text-[#3C4A44]">
                  I agree to{" "}
                  <Text className="font-medium text-[#006B55]">
                    Terms & Conditions
                  </Text>{" "}
                  and{" "}
                  <Text className="font-medium text-[#006B55]">
                    Privacy Policy
                  </Text>
                </Text>
              </Pressable>

              <Pressable
                onPress={handleCreateAccount}
                disabled={isLoading}
                style={({ pressed }) => [
                  { transform: [{ scale: pressed ? 0.98 : 1 }] },
                  { opacity: isLoading ? 0.7 : 1 },
                ]}
                className="mt-2 overflow-hidden rounded-lg"
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
                      {isPhoneOnlyMode ? "Send OTP" : "Create Account"}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>

              <View className="relative my-2">
                <View className="absolute inset-x-0 top-1/2 h-px bg-[#BBCAC3]/30" />
                <View className="items-center">
                  <Text className="bg-[#F4FBF6] px-4 text-[12px] text-[#6C7A74]">
                    Or continue with
                  </Text>
                </View>
              </View>

              <View className="mb-2 flex-row gap-4">
                <Pressable
                  onPress={handleGoogleSignIn}
                  disabled={isLoading || isGoogleLoading}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-[#BBCAC3] bg-white"
                >
                  <Image
                    source={ListifyOnboardingAssets.signInGoogleLogo}
                    contentFit="contain"
                    transition={150}
                    className="h-5 w-5"
                  />
                  <Text className="text-[14px] font-medium text-[#111827]">
                    {isGoogleLoading ? "Connecting..." : "Google"}
                  </Text>
                </Pressable>

                <Pressable className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-[#BBCAC3] bg-white">
                  <Ionicons name="logo-apple" size={20} color="#0F172A" />
                  <Text className="text-[14px] font-medium text-[#111827]">
                    Apple
                  </Text>
                </Pressable>
              </View>
            </View>

            <View className="mt-6 items-center">
              <Text className="text-[14px] text-[#3C4A44]">
                Already have an account?
                <Text
                  className="ml-1 font-semibold text-[#006B55]"
                  onPress={() => {
                    router.push("/sign-in" as Href);
                  }}
                >
                  {" "}
                  Sign In
                </Text>
              </Text>
            </View>

            <View className="mt-12 flex-row items-center gap-4 rounded-2xl border border-slate-100 bg-[#EFF5F0] p-6">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-[#27BB97]/10">
                <MaterialIcons name="verified-user" size={24} color="#27BB97" />
              </View>

              <View className="flex-1">
                <Text className="text-[12px] font-bold tracking-[0.24px] text-[#161D1A]">
                  100% Trusted Community
                </Text>
                <Text className="mt-1 text-[13px] leading-5 text-[#6C7A74]">
                  Verified profiles and secure transactions.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
