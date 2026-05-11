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
import { useAppDispatch } from "@/store/hooks";
import { completeOnboarding } from "@/store/slices/onboarding-slice";

export function OnboardingSlideThreeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const handleGetStarted = () => {
    dispatch(completeOnboarding());
    router.push("/sign-in" as Href);
  };

  return (
    <View
      className="flex-1 items-center justify-center bg-white px-4"
      style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
    >
      <StatusBar style="dark" />

      <View className="w-full flex-1" style={{ maxWidth: 430 }}>
        <View className="flex-1 justify-between overflow-hidden">
          <View className="mb-6 flex-1 items-center justify-center">
            <View className="w-full" style={{ maxHeight: 450 }}>
              <View className="flex-row gap-3">
                <View className="h-56 flex-1 overflow-hidden rounded-xl shadow-sm">
                  <Image
                    source={ListifyOnboardingAssets.slide3CommunityIllustration}
                    contentFit="cover"
                    transition={150}
                    className="h-full w-full"
                  />

                  <View className="absolute left-4 top-4 flex-row items-center gap-2 rounded-full border border-white/30 bg-white/70 px-3 py-1.5">
                    <MaterialIcons
                      name="verified-user"
                      size={18}
                      color={ListifyColors.primary}
                    />
                    <Text className="text-[12px] font-medium text-[#111827]">
                      Trusted Network
                    </Text>
                  </View>
                </View>

                <View className="w-[32%] gap-3">
                  <View className="h-36 overflow-hidden rounded-xl shadow-sm">
                    <Image
                      source={
                        ListifyOnboardingAssets.slide3ConfettiIllustration
                      }
                      contentFit="cover"
                      transition={150}
                      className="h-full w-full"
                    />
                  </View>

                  <View className="h-23 items-center justify-center rounded-xl border border-black/5 bg-[#EFF5F0] px-2 shadow-sm">
                    <MaterialIcons
                      name="handshake"
                      size={32}
                      color={ListifyColors.primary}
                    />
                    <Text className="mt-1 text-center text-[12px] font-medium text-[#4B5563]">
                      Fair Trade
                    </Text>
                  </View>
                </View>
              </View>

              <View className="mt-3 flex-row gap-3">
                <View className="h-32 w-[38%] overflow-hidden rounded-xl shadow-sm">
                  <Image
                    source={ListifyOnboardingAssets.slide3SproutIllustration}
                    contentFit="cover"
                    transition={150}
                    className="h-full w-full"
                  />
                </View>

                <View className="h-32 flex-1 justify-end rounded-xl border border-[#27BB97]/10 bg-[#27BB97]/10 p-4 shadow-sm">
                  <View className="mb-2 flex-row items-center gap-2">
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-[#75F9D2]">
                      <MaterialIcons
                        name="add-business"
                        size={16}
                        color="#002118"
                      />
                    </View>
                    <Text className="text-[12px] font-bold text-[#004535]">
                      Sell Locally
                    </Text>
                  </View>

                  <View className="h-1 w-full rounded-full bg-[#6C7A74]/20">
                    <View className="h-1 w-3/4 rounded-full bg-[#27BB97]" />
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View className="px-4 pb-6 pt-2">
            <Text className="text-center text-[30px] font-bold tracking-[-0.6px] text-[#111827]">
              Join the Community
            </Text>
            <Text className="mx-auto mt-4 max-w-75 text-center text-[16px] leading-7 text-[#4B5563]">
              The easiest way to buy, sell, and grow your local network with
              trust and security.
            </Text>
          </View>

          <View className="items-center gap-6 pb-8">
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full bg-[#D1D5DB]" />
              <View className="h-2 w-2 rounded-full bg-[#D1D5DB]" />
              <View className="h-2 w-6 rounded-full bg-[#27BB97]" />
            </View>

            <Pressable
              onPress={handleGetStarted}
              style={({ pressed }) => [
                { transform: [{ scale: pressed ? 0.95 : 1 }] },
              ]}
              className="w-full overflow-hidden rounded-xl"
            >
              <LinearGradient
                colors={[ListifyColors.primary, ListifyColors.gradientEnd]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                className="h-14 flex-row items-center justify-center gap-2 rounded-xl"
                style={{
                  shadowColor: "rgba(39,187,151,0.2)",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 1,
                  shadowRadius: 18,
                  elevation: 6,
                }}
              >
                <Text className="text-[18px] font-semibold text-white">
                  Get Started
                </Text>
                <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>

            <Text className="text-[12px] font-medium text-[#4B5563]">
              Already have an account?{" "}
              <Text
                className="font-bold text-[#27BB97]"
                onPress={handleGetStarted}
              >
                Log In
              </Text>
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
