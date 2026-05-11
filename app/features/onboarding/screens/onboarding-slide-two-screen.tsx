import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "@/lib/safe-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    ListifyColors,
    ListifyOnboardingAssets,
} from "@/constants/listify-theme";
import { Image } from "@/lib/nativewind-interop";

export function OnboardingSlideTwoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <View
        className="absolute left-1/2 top-[18%] h-80 w-80 rounded-[40px] bg-[#75F9D2]/30"
        style={{
          transform: [
            { translateX: -160 },
            { rotate: "6deg" },
            { scale: 0.95 },
          ],
        }}
      />

      <View
        className="w-full flex-row items-center justify-end px-4"
        style={{ paddingTop: insets.top + 12, height: insets.top + 64 }}
      >
        <Pressable
          onPress={() => {}}
          android_ripple={{
            color: "rgba(39, 187, 151, 0.08)",
            borderless: false,
          }}
          style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}
          className="rounded-full px-4 py-2"
        >
          <Text className="text-[12px] font-semibold text-[#9CA3AF]">Skip</Text>
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center px-4 pb-12">
        <View className="w-full items-center" style={{ maxWidth: 430 }}>
          <View className="mb-12 h-80 w-80 items-center justify-center">
            <View className="h-full w-full overflow-hidden rounded-4xl border border-white/40 bg-white/70 shadow-xl">
              <Image
                source={ListifyOnboardingAssets.slide2Illustration}
                contentFit="cover"
                transition={150}
                className="h-full w-full opacity-80"
              />

              <View className="absolute inset-0 bg-white/10" />

              <View className="absolute left-6 top-6 gap-2">
                <View className="flex-row items-center gap-2 rounded-full border border-slate-100 bg-white/90 px-3 py-1.5 shadow-sm">
                  <MaterialIcons
                    name="brush"
                    size={16}
                    color={ListifyColors.primary}
                  />
                  <Text className="text-[12px] font-medium text-[#111827]">
                    Design
                  </Text>
                </View>

                <View className="ml-4 flex-row items-center gap-2 rounded-full border border-slate-100 bg-white/90 px-3 py-1.5 shadow-sm">
                  <MaterialIcons
                    name="code"
                    size={16}
                    color={ListifyColors.secondaryBlue}
                  />
                  <Text className="text-[12px] font-medium text-[#111827]">
                    Development
                  </Text>
                </View>
              </View>

              <View className="absolute bottom-6 left-6 right-6 flex-row items-center gap-3 rounded-2xl border border-white/50 bg-white/75 p-4 shadow-sm">
                <Image
                  source={ListifyOnboardingAssets.slide2ProviderPortrait}
                  contentFit="cover"
                  transition={150}
                  className="h-12 w-12 rounded-xl"
                />

                <View className="flex-1">
                  <Text className="text-[14px] font-semibold text-[#111827]">
                    David Chen
                  </Text>
                  <View className="mt-1 flex-row items-center gap-1">
                    <MaterialIcons
                      name="star"
                      size={14}
                      color={ListifyColors.accentYellow}
                    />
                    <Text className="text-[12px] font-medium text-[#9CA3AF]">
                      4.9 (124 reviews)
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View className="max-w-70 items-center gap-4">
            <Text className="text-center text-[30px] font-bold tracking-[-0.6px] text-[#111827]">
              Find Expert Services
            </Text>
            <Text className="px-2 text-center text-[14px] leading-6 text-[#9CA3AF]">
              Need a plumber, tutor, or designer? Browse top-rated local
              services at your fingertips.
            </Text>
          </View>
        </View>
      </View>

      <View
        className="w-full items-center gap-8 px-4"
        style={{
          paddingBottom: Math.max(insets.bottom + 28, 48),
          paddingTop: 24,
        }}
      >
        <View className="flex-row items-center gap-3">
          <View className="h-2 w-2 rounded-full bg-[#D1D5DB]" />
          <View className="h-2 w-6 rounded-full bg-[#27BB97]" />
          <View className="h-2 w-2 rounded-full bg-[#D1D5DB]" />
        </View>

        <Pressable
          onPress={() => {
            router.push("/onboarding-slide-3" as Href);
          }}
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
          className="w-full max-w-sm overflow-hidden rounded-xl"
        >
          <LinearGradient
            colors={[ListifyColors.primary, ListifyColors.gradientEnd]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl"
            style={{
              shadowColor: "rgba(39,187,151,0.39)",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 1,
              shadowRadius: 14,
              elevation: 6,
            }}
          >
            <Text className="text-[20px] font-semibold text-white">Next</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
