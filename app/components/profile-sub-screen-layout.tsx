import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "@/lib/safe-router";
import { type ReactNode } from "react";
import {
  type RefreshControlProps,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_SCREEN_BG } from "@/constants/theme";
import { ListifyFonts } from "@/constants/typography";

type ProfileSubScreenLayoutProps = {
  title: string;
  children: ReactNode;
  rightAction?: ReactNode;
  onBack?: () => void;
  fallbackRoute?: Href;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentContainerStyle?: object;
};

export function ProfileSubScreenLayout({
  title,
  children,
  rightAction,
  onBack,
  fallbackRoute = "/(tabs)/dashboard-home" as Href,
  refreshControl,
  contentContainerStyle,
}: ProfileSubScreenLayoutProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackRoute);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: APP_SCREEN_BG }}>
      <View
        className="flex-row items-center justify-between px-5"
        style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
      >
        <View className="flex-1 flex-row items-center">
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            className="mr-2 h-10 w-10 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="chevron-left" size={32} color="#1A1A1A" />
          </Pressable>
          <Text
            className="flex-1 text-[22px]"
            style={{ fontFamily: ListifyFonts.bold, color: "#1A1A1A" }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        {rightAction ? <View className="ml-2">{rightAction}</View> : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          ...contentContainerStyle,
        }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function ProfileSectionCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-5">
      {title ? (
        <Text
          className="mb-3 text-[13px] uppercase tracking-wide"
          style={{ fontFamily: ListifyFonts.semiBold, color: "#9CA3AF" }}
        >
          {title}
        </Text>
      ) : null}
      <View
        className="overflow-hidden rounded-2xl bg-white"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {children}
      </View>
    </View>
  );
}
