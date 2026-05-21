import { type Href, useRouter } from "@/lib/safe-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function AuthSkipButton() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute inset-x-0 z-20 flex-row justify-start px-4"
      style={{ top: insets.top + 8, height: 56 }}
    >
      <Pressable
        onPress={() => router.replace("/(tabs)/home-feed-root" as Href)}
        android_ripple={{
          color: "rgba(156, 163, 175, 0.12)",
          borderless: true,
        }}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        className="h-10 items-center justify-center rounded-full px-4"
      >
        <Text className="text-[13px] font-semibold text-[#9CA3AF]">Skip</Text>
      </Pressable>
    </View>
  );
}
