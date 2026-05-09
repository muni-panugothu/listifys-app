import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";

const previewImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAHKuRSqBvFz-njyFPuaLRGuY2K8EBqo1tMeABWJW0980o5B2CbGHwlqB0gWK3hmcJ6QkfnFGojFw7PvCsIp2B7QlVzBYn2ZmFGJeks70ffx8iresJ8GyWyjlho24AkxrQE95hDxy2hIBAfeSd8ByLzS66ApdRvC9OzIFwNeYNf5KhgHBWZ7vz-pNUAtXVuw8-pXUbxx29-s5tGenJmSOkpAzqqzcgvdUbEq_vUKGrDP9FY0TJz19jER-WHnP4H1w4kNOzk3jb8cN0";

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const },
  {
    id: "sell",
    label: "Sell",
    icon: "add-circle" as const,
    highlight: true,
    active: true,
  },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function ListingSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);

  const handleBottomTabPress = useTabNavigation();

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{
          paddingTop: insets.top,
          height: topBarHeight,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="storefront" size={24} color="#27BB97" />
          <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
            Listify
          </Text>
        </View>
        <Pressable className="rounded-full p-2">
          <MaterialIcons name="notifications-none" size={24} color="#64748B" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topBarHeight + 24,
          paddingBottom: 84 + bottomNavPadding,
          alignItems: "center",
        }}
      >
        <View className="w-full max-w-md items-center px-4">
          {/* Success Icon */}
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-[rgba(39,187,151,0.1)]"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <View className="h-16 w-16 items-center justify-center rounded-full bg-[#27BB97]">
              <MaterialIcons name="check" size={36} color="#FFFFFF" />
            </View>
          </View>

          {/* Text */}
          <Text className="mb-2 text-center text-[24px] font-bold tracking-tight text-[#161D1A]">
            Success! Your ad is live
          </Text>
          <Text className="mb-6 text-center text-[14px] leading-5 text-[#6C7A74]">
            Millions of buyers can now see your listing. We'll notify you when
            someone reaches out.
          </Text>

          {/* Preview Card */}
          <View className="mb-6 w-full overflow-hidden rounded-xl border border-slate-100 bg-white"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View className="relative h-48 w-full">
              <Image
                source={previewImage}
                contentFit="cover"
                transition={200}
                className="h-full w-full"
              />
              <Pressable className="absolute right-3 top-3 rounded-full bg-white/70 p-2">
                <MaterialIcons name="share" size={20} color="#161D1A" />
              </Pressable>
              <View className="absolute bottom-3 left-3 rounded-full bg-[#27BB97]/90 px-3 py-1">
                <Text className="text-[12px] font-medium text-white">
                  Live Listing
                </Text>
              </View>
            </View>
            <View className="p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-[18px] font-semibold text-[#161D1A]">
                    Elegant Modern Living Sofa
                  </Text>
                  <View className="mt-1 flex-row items-center gap-1">
                    <MaterialIcons
                      name="location-on"
                      size={14}
                      color="#94A3B8"
                    />
                    <Text className="text-[14px] text-[#6C7A74]">
                      Indiranagar, Bangalore
                    </Text>
                  </View>
                </View>
                <Text className="text-[20px] font-bold text-[#27BB97]">
                  ₹24,999
                </Text>
              </View>
              <View className="mt-3 flex-row items-center justify-between border-t border-slate-50 pt-3">
                <View className="flex-row -space-x-2">
                  <View className="h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-200">
                    <MaterialIcons name="person" size={12} color="#94A3B8" />
                  </View>
                  <View className="h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-200">
                    <MaterialIcons name="person" size={12} color="#94A3B8" />
                  </View>
                  <View className="h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-100">
                    <Text className="text-[8px] font-bold">12+</Text>
                  </View>
                </View>
                <Text className="text-[12px] font-medium text-slate-400">
                  Listed 1m ago
                </Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View className="mb-6 w-full gap-4">
            <Pressable
              className="overflow-hidden rounded-lg"
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <LinearGradient
                colors={["#27BB97", "#1E9E7E"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{
                  height: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialIcons name="share" size={20} color="#FFFFFF" />
                <Text className="text-[16px] font-semibold text-white">
                  Share Your Listing
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => router.push("/home-feed-root")}
              className="h-12 flex-row items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white"
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#F8FAFC" : "#FFFFFF",
              })}
            >
              <Text className="text-[16px] font-semibold text-[#161D1A]">
                Back to Home
              </Text>
            </Pressable>
          </View>

          {/* Tips Bento */}
          <View className="w-full flex-row gap-2">
            <View className="flex-1 gap-2 rounded-xl border border-[#E9EFEB] bg-[#EFF5F0] p-4">
              <MaterialIcons name="trending-up" size={22} color="#27BB97" />
              <Text className="text-[12px] font-bold text-[#161D1A]">
                Reach 10x more
              </Text>
              <Text className="text-[11px] leading-4 text-[#6C7A74]">
                Boost your ad to reach thousands of buyers instantly.
              </Text>
            </View>
            <View className="flex-1 gap-2 rounded-xl border border-[#E9EFEB] bg-[#EFF5F0] p-4">
              <MaterialIcons name="verified-user" size={22} color="#27BB97" />
              <Text className="text-[12px] font-bold text-[#161D1A]">
                Safety first
              </Text>
              <Text className="text-[11px] leading-4 text-[#6C7A74]">
                Always meet in public places and use secure payments.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-100 bg-white"
        style={{
          paddingTop: 12,
          paddingBottom: bottomNavPadding,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View className="flex-row items-end justify-around px-2">
          {bottomTabs.map((tab) => {
            if (tab.highlight) {
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => handleBottomTabPress(tab.id)}
                  className="items-center justify-center"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <View
                    className="-mt-7 rounded-full border-4 border-[#F4FBF6] bg-[#27BB97] p-2.5"
                    style={{
                      shadowColor: "#27BB97",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <MaterialIcons name={tab.icon} size={24} color="#FFFFFF" />
                  </View>
                  <Text className="mt-1 text-[11px] font-semibold tracking-wide text-[#27BB97]">
                    {tab.label}
                  </Text>
                </Pressable>
              );
            }
            return (
              <Pressable
                key={tab.id}
                onPress={() => handleBottomTabPress(tab.id)}
                className="items-center py-1"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={24}
                  color={tab.active ? "#27BB97" : "#94A3B8"}
                />
                <Text
                  className="text-[11px] font-medium tracking-wide"
                  style={{ color: tab.active ? "#27BB97" : "#94A3B8" }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
