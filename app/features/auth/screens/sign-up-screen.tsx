import { type Href, useRouter } from "@/lib/safe-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearError, googleLogin, register } from "@/store/slices/auth-slice";

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

export function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { status, error, registrationEmail, isAuthenticated } = useAppSelector(
    (s) => s.auth,
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const contentPaddingBottom = useMemo(
    () => Math.max(insets.bottom + 24, 24),
    [insets.bottom],
  );
  const isLoading = status === "loading";

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/home-feed-root" as Href);
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (registrationEmail) {
      router.push("/otp-verification" as Href);
    }
  }, [registrationEmail, router]);

  useEffect(() => {
    if (error) {
      Alert.alert("Sign Up Failed", error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  useEffect(() => {
    const googleModule = getGoogleSigninModule();
    if (!googleModule) {
      return;
    }

    googleModule.GoogleSignin.configure({
      webClientId:
        "335766515911-5corrme09mfaplitd0r9ra9k7m2nr76i.apps.googleusercontent.com",
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

      try {
        await GoogleSignin.signOut();
      } catch {
        // ignore
      }

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
        const message = typeof err?.message === "string" ? err.message : "";
        const isDeveloperError =
          err?.code === 10 ||
          message.includes("DEVELOPER_ERROR") ||
          message.includes("Developer console is not set up correctly") ||
          message.toLowerCase().includes("developer error");

        if (isDeveloperError) {
          Alert.alert(
            "Google Sign In",
            "Google Sign-In is not configured correctly for this Android build. Verify the Android package name and SHA-1 in Firebase or Google Cloud, then rebuild the app.",
          );
          return;
        }

        switch (err.code) {
          case statusCodes.IN_PROGRESS:
            break;
          case statusCodes.SIGN_IN_CANCELLED:
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert("Google Sign In", "Google Play Services not available.");
            break;
          default:
            if (
              typeof err?.message === "string" &&
              (err.message.includes("DEVELOPER_ERROR") || err.message.includes("code: 10"))
            ) {
              showGoogleDeveloperError();
            } else {
              Alert.alert("Google Sign In", err?.message || "Something went wrong.");
            }
        }
      } else {
        if (
          typeof err?.message === "string" &&
          (err.message.includes("DEVELOPER_ERROR") || err.message.includes("code: 10"))
        ) {
          showGoogleDeveloperError();
        } else {
          Alert.alert("Google Sign In", err?.message || "Failed to connect.");
        }
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingBottom: contentPaddingBottom,
            paddingHorizontal: 16,
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          <View className="w-full self-center" style={{ maxWidth: 430 }}>
            <View className="w-full items-center">
              <Text className="text-gray-800 text-[30px] font-extrabold mb-5">
                Sign Up
              </Text>

              <View className="w-full flex flex-col gap-3">
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full Name"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  className="border border-gray-300 p-4 rounded-full w-full text-gray-800"
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="border border-gray-300 p-4 rounded-full w-full text-gray-800"
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  className="border border-gray-300 p-4 rounded-full w-full text-gray-800"
                />
              </View>

              <Pressable
                onPress={handleCreateAccount}
                disabled={isLoading || isGoogleLoading}
                style={({ pressed }) => [
                  { opacity: pressed ? 0.9 : 1 },
                  { opacity: isLoading ? 0.7 : 1 },
                ]}
                className="bg-black text-white px-5 py-3 rounded-full w-full items-center mt-5"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-center font-semibold">
                    Create Account
                  </Text>
                )}
              </Pressable>
            </View>

            <View className="flex-row items-center gap-3 w-full my-7">
              <View className="flex-1 bg-gray-400 h-px" />
              <Text className="text-gray-400">or</Text>
              <View className="flex-1 bg-gray-400 h-px" />
            </View>

            <View className="w-full flex flex-col gap-2">
              <Pressable
                onPress={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
                className="bg-gray-200 text-black px-6 py-3 rounded-full flex-row items-center justify-center gap-4"
              >
                <Image
                  source={require("../../../assets/google.webp")}
                  className="h-8 w-8"
                />
                <Text className="font-semibold text-black">
                  {isGoogleLoading ? "Connecting..." : "Continue with Google"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  router.push("/mobile" as Href);
                }}
                className="bg-gray-200 text-black px-6 py-3 rounded-full flex-row items-center justify-center gap-4"
              >
                <Image
                  source={require("../../../assets/mobile.png")}
                  className="h-8 w-10"
                  resizeMode="contain"
                />
                <Text className="font-semibold text-black">Continue with Mobile</Text>
              </Pressable>
            </View>

            <Text className="text-gray-500 text-center mt-4">
              Already have an account?{" "}
              <Text
                className="text-[17px] font-bold text-gray-800"
                onPress={() => {
                  router.push("/sign-in" as Href);
                }}
              >
                Login
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
