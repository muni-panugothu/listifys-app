import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListifyColors } from "@/constants/listify-theme";

export function SplashScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.98,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace("/onboarding-slide-1");
    }, 1800);

    return () => {
      clearTimeout(timeout);
    };
  }, [router]);

  const animatedStyle = {
    opacity: pulse.interpolate({
      inputRange: [0.98, 1],
      outputRange: [0.85, 1],
    }),
    transform: [{ scale: pulse }],
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="light" />

      <LinearGradient
        colors={[
          ListifyColors.primary,
          ListifyColors.primaryDark,
          ListifyColors.gradientEnd,
        ]}
        start={{ x: 0.15, y: 0.2 }}
        end={{ x: 0.9, y: 0.95 }}
        className="flex-1 overflow-hidden"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="absolute left-[-10%] top-[-10%] h-80 w-80 rounded-full bg-white/10" />
        <View className="absolute bottom-[-6%] right-[-6%] h-60 w-60 rounded-full bg-white/5" />

        <View className="flex-1 items-center justify-center px-6">
          <Animated.View style={animatedStyle} className="items-center">
            <View className="mb-4 h-24 w-24 items-center justify-center rounded-3xl border border-white/30 bg-white/20 shadow-2xl">
              <MaterialIcons name="storefront" size={46} color="#FFFFFF" />
            </View>

            <Text className="text-[42px] font-black tracking-[-1.6px] text-white">
              Listify
            </Text>
            <Text className="mt-2 text-[12px] font-semibold uppercase tracking-[4px] text-white/80">
              Marketplace
            </Text>
          </Animated.View>
        </View>

        <View
          className="absolute inset-x-0 items-center"
          style={{ bottom: Math.max(insets.bottom + 52, 64) }}
        >
          <View className="items-center gap-4">
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text className="text-[12px] font-semibold uppercase tracking-[3px] text-white/70">
              Loading...
            </Text>
          </View>
        </View>

        <View
          className="absolute inset-x-0 items-center"
          style={{ bottom: Math.max(insets.bottom + 8, 16) }}
        >
          <View className="h-1 w-32 rounded-full bg-white/30" />
        </View>
      </LinearGradient>
    </View>
  );
}
