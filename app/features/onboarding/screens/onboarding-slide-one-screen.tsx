import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    ListifyColors,
    ListifyOnboardingAssets,
} from "@/constants/listify-theme";
import { Image } from "@/lib/nativewind-interop";

export function OnboardingSlideOneScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <View className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#27BB97]/6" />
      <View className="absolute -right-32 top-[40%] h-80 w-80 rounded-full bg-[#2D7DD7]/6" />

      <View
        className="flex-1 self-center px-4"
        style={{ width: "100%", maxWidth: 430 }}
      >
        <View
          className="absolute inset-x-0 z-20 flex-row justify-end px-4"
          style={{ top: insets.top + 8, height: 56 }}
        >
          <Pressable
            onPress={() => {}}
            android_ripple={{
              color: "rgba(156, 163, 175, 0.12)",
              borderless: true,
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className="h-10 items-center justify-center rounded-full px-4"
          >
            <Text className="text-[13px] font-semibold text-[#9CA3AF]">
              Skip
            </Text>
          </Pressable>
        </View>

        <View
          className="flex-1 items-center justify-center"
          style={{
            paddingTop: insets.top + 72,
            paddingBottom: insets.bottom + 180,
          }}
        >
          <View className="w-full items-center">
            <View className="mb-6 w-full aspect-square items-center justify-center">
              <View className="absolute inset-0 rounded-full bg-[#27BB97]/8" />

              <View className="h-full w-full overflow-hidden rounded-4xl border border-white/80 bg-white shadow-sm">
                <Image
                  source={ListifyOnboardingAssets.slide1Illustration}
                  contentFit="cover"
                  transition={150}
                  className="h-full w-full"
                />

                <View className="absolute bottom-6 right-6 flex-row items-center gap-2 rounded-full border border-white/90 bg-white/85 px-4 py-2 shadow-sm">
                  <MaterialIcons
                    name="location-on"
                    size={18}
                    color={ListifyColors.primary}
                  />
                  <Text className="text-[12px] font-semibold text-[#111827]">
                    Local deals
                  </Text>
                </View>
              </View>
            </View>

            <View className="items-center px-4">
              <Text className="text-center text-[30px] font-bold tracking-[-0.6px] text-[#111827]">
                Buy &amp; Sell Nearby
              </Text>
              <Text className="mt-4 text-center text-[17px] leading-7 text-[#4B5563]">
                Discover great deals on everything from electronics to furniture
                in your neighborhood.
              </Text>
            </View>
          </View>
        </View>

        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.92)", "#FFFFFF"]}
          className="absolute inset-x-0 bottom-0 h-40"
        />

        <View
          className="absolute inset-x-0 bottom-0 z-20 px-4"
          style={{ paddingBottom: Math.max(insets.bottom + 16, 24) }}
        >
          <View className="items-center gap-6">
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-6 rounded-full bg-[#27BB97]" />
              <View className="h-2 w-2 rounded-full bg-[#D1D5DB]" />
              <View className="h-2 w-2 rounded-full bg-[#D1D5DB]" />
            </View>

            <Pressable
              onPress={() => {
                router.push("/onboarding-slide-2");
              }}
              style={({ pressed }) => [
                { transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
              className="w-full overflow-hidden rounded-2xl shadow-lg"
            >
              <LinearGradient
                colors={[ListifyColors.primary, ListifyColors.gradientEnd]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                className="h-13 flex-row items-center justify-center gap-2 rounded-2xl"
              >
                <Text className="text-[18px] font-semibold text-white">
                  Next
                </Text>
                <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
