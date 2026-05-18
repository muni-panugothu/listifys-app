import { MaterialIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListifyFonts } from "@/constants/typography";

type TopSaveToastProps = {
  visible: boolean;
  message?: string;
  onHidden?: () => void;
};

const SHOW_DURATION_MS = 1800;

export function TopSaveToast({
  visible,
  message = "Item saved",
  onHidden,
}: TopSaveToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;

    translateY.value = withSpring(0, { damping: 16, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 200 });

    const hideTimer = setTimeout(() => {
      translateY.value = withTiming(-120, { duration: 280 }, (finished) => {
        if (finished && onHidden) {
          runOnJS(onHidden)();
        }
      });
      opacity.value = withTiming(0, { duration: 280 });
    }, SHOW_DURATION_MS);

    return () => clearTimeout(hideTimer);
  }, [visible, message, onHidden, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute inset-x-4 z-[100]"
      style={[{ top: insets.top + 8 }, animatedStyle]}
    >
      <View
        className="flex-row items-center gap-2.5 rounded-2xl bg-[#1A1A1A] px-4 py-3"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View className="h-7 w-7 items-center justify-center rounded-full bg-[#27BB97]">
          <MaterialIcons name="check" size={18} color="#FFFFFF" />
        </View>
        <Text
          className="text-[15px] text-white"
          style={{ fontFamily: ListifyFonts.medium }}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
