import { MaterialIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListifyFonts } from "@/constants/typography";
import type { AppToastType } from "@/lib/toast";

type TopSaveToastProps = {
  visible: boolean;
  title?: string;
  message?: string;
  type?: AppToastType;
  onHidden?: () => void;
};

const SHOW_DURATION_MS: Record<AppToastType, number> = {
  success: 2200,
  info: 2800,
  error: 9000,
};

export function TopSaveToast({
  visible,
  title,
  message = "Item saved",
  type = "success",
  onHidden,
}: TopSaveToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  const toastAccentByType: Record<AppToastType, { icon: React.ComponentProps<typeof MaterialIcons>["name"]; color: string }> = {
    success: { icon: "check", color: "#27BB97" },
    error: { icon: "error-outline", color: "#DC2626" },
    info: { icon: "info-outline", color: "#3B82F6" },
  };

  const accent = toastAccentByType[type];
  const isError = type === "error";

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
    }, SHOW_DURATION_MS[type]);

    return () => clearTimeout(hideTimer);
  }, [visible, message, onHidden, opacity, translateY, type]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      className="absolute inset-x-3 z-[100]"
      style={[{ top: insets.top + 8 }, animatedStyle]}
    >
      <View
        className="flex-row items-start gap-2.5 rounded-2xl bg-[#1A1A1A] px-4 py-3"
        style={{
          maxHeight: isError ? 320 : 120,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View
          className="mt-0.5 h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: accent.color }}
        >
          <MaterialIcons name={accent.icon} size={18} color="#FFFFFF" />
        </View>
        <ScrollView
          className="flex-1"
          nestedScrollEnabled
          showsVerticalScrollIndicator={isError}
        >
          {title ? (
            <Text
              className="text-[14px] text-white"
              style={{ fontFamily: ListifyFonts.semiBold }}
            >
              {title}
            </Text>
          ) : null}
          <Text
            className="text-[14px] leading-5 text-white"
            style={{ fontFamily: ListifyFonts.medium }}
            selectable={isError}
          >
            {message}
          </Text>
        </ScrollView>
      </View>
    </Animated.View>
  );
}
