import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BOTTOM_NAV_TABS,
  type BottomNavTabId,
} from "@/constants/bottom-nav-tabs";
import { ListifyFonts } from "@/constants/typography";

type FloatingBottomNavProps = {
  activeTabId: BottomNavTabId;
  onTabPress: (tabId: string) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FloatingBottomNav({ activeTabId, onTabPress }: FloatingBottomNavProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-5 z-50 items-center"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
    >
      <View
        className="flex-row items-center rounded-full border border-white/80 px-1.5 py-2"
        style={{
          width: "92%",
          maxWidth: 420,
          backgroundColor: "rgb(255, 255, 255)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.14,
          shadowRadius: 28,
          elevation: 14,
        }}
      >
        {BOTTOM_NAV_TABS.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <AnimatedPressable
              key={tab.id}
              layout={Layout.springify().damping(18).stiffness(220)}
              onPress={() => onTabPress(tab.id)}
              className="flex-1 items-center justify-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
            >
              {isActive ? (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(120)}
                  layout={Layout.springify().damping(20).stiffness(240)}
                  className="w-full flex-row items-center justify-center gap-1 rounded-full bg-neutral-900 px-2 py-2.5"
                >
                  <MaterialIcons name={tab.icon} size={22} color="#FFFFFF" />
                  <Text
                    className="text-[12px] text-white"
                    style={{ fontFamily: ListifyFonts.semiBold }}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </Animated.View>
              ) : (
                <View className="items-center justify-center py-2.5">
                  <MaterialIcons name={tab.icon} size={26} color="#1F2937" />
                </View>
              )}
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}
