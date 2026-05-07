import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
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

export function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const headerHeight = useMemo(() => insets.top + 64, [insets.top]);

  return (
    <View className="flex-1 bg-white">
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{ paddingTop: insets.top, height: headerHeight }}
      >
        <Pressable
          onPress={() => {
            router.back();
          }}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <MaterialIcons name="arrow-back" size={22} color="#0F172A" />
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
            paddingTop: headerHeight + 24,
            paddingBottom: Math.max(insets.bottom + 24, 40),
            paddingHorizontal: 16,
            flexGrow: 1,
          }}
        >
          <View className="mx-auto flex-1 w-full max-w-md justify-center">
            <View className="mb-6">
              <Text className="text-[24px] font-bold tracking-[-0.48px] text-[#111827]">
                Welcome Back
              </Text>
              <Text className="mt-2 text-[16px] leading-6 text-[#9CA3AF]">
                Enter your details to continue
              </Text>
            </View>

            <View className="gap-4">
              <View className="gap-2">
                <Text className="text-[12px] font-medium text-[#111827]">
                  Email or Phone
                </Text>
                <TextInput
                  value={credential}
                  onChangeText={setCredential}
                  placeholder="email@example.com"
                  placeholderTextColor={ListifyColors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="h-12 rounded-lg border border-[#BBCAC3] bg-white px-4 text-[14px] text-[#111827]"
                />
              </View>

              <View className="gap-2">
                <Text className="text-[12px] font-medium text-[#111827]">
                  Password
                </Text>
                <View className="relative justify-center">
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={ListifyColors.muted}
                    secureTextEntry={!isPasswordVisible}
                    className="h-12 rounded-lg border border-[#BBCAC3] bg-white px-4 pr-12 text-[14px] text-[#111827]"
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
                      color={ListifyColors.muted}
                    />
                  </Pressable>
                </View>

                <View className="items-end">
                  <Pressable
                    onPress={() => {
                      router.push("/forgot-password" as Href);
                    }}
                  >
                    <Text className="text-[12px] font-semibold text-[#27BB97]">
                      Forgot Password?
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  { transform: [{ scale: pressed ? 0.95 : 1 }] },
                ]}
                className="overflow-hidden rounded-lg"
              >
                <LinearGradient
                  colors={[ListifyColors.primary, ListifyColors.gradientEnd]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  className="h-12 items-center justify-center rounded-lg"
                >
                  <Text className="text-[18px] font-semibold text-white">
                    Sign In
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            <View className="relative my-6">
              <View className="absolute inset-x-0 top-1/2 h-px bg-[#BBCAC3]/30" />
              <View className="items-center">
                <Text className="bg-white px-4 text-[12px] text-[#9CA3AF]">
                  Or continue with
                </Text>
              </View>
            </View>

            <View className="mb-6 flex-row gap-4">
              <Pressable className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-[#BBCAC3] bg-white">
                <Image
                  source={ListifyOnboardingAssets.signInGoogleLogo}
                  contentFit="contain"
                  transition={150}
                  className="h-5 w-5"
                />
                <Text className="text-[14px] font-medium text-[#111827]">
                  Google
                </Text>
              </Pressable>

              <Pressable className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-[#BBCAC3] bg-white">
                <Ionicons name="logo-apple" size={20} color="#0F172A" />
                <Text className="text-[14px] font-medium text-[#111827]">
                  Apple
                </Text>
              </Pressable>
            </View>

            <View className="mt-auto pt-8">
              <View className="relative h-32 overflow-hidden rounded-2xl">
                <Image
                  source={ListifyOnboardingAssets.signInMarketplaceBanner}
                  contentFit="cover"
                  transition={150}
                  className="h-full w-full"
                />

                <LinearGradient
                  colors={["rgba(39,187,151,0.20)", "rgba(39,187,151,0.05)"]}
                  className="absolute inset-0"
                />

                <View className="absolute inset-0 items-center justify-center">
                  <Text className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[12px] font-medium text-white">
                    The most trusted local marketplace
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-8 items-center">
              <Text className="text-[14px] text-[#9CA3AF]">
                Don&apos;t have an account?{" "}
                <Text
                  className="font-bold text-[#27BB97]"
                  onPress={() => {
                    router.push("/sign-up" as Href);
                  }}
                >
                  Sign Up
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
