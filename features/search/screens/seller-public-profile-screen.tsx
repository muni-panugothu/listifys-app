import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";

type ListingCard = {
  id: string;
  title: string;
  price: string;
  condition: string;
  image: string;
  liked?: boolean;
  featured?: boolean;
  premium?: boolean;
  subtitle?: string;
};

const COVER_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDieOcT68a3pkiyCzXQEpMRO5s3IqzQqlMEkLxYJVcK1hDaT2R3IoV5US6JPwoRd0wuuwyTh5mTeaHfgf5jp-MO5pP69JauU2w5SoHConLSJJMRiYyFT-6B-BCITtsBR__EA_CI4vDEcSLxT40Fu2Zk6Sy55DLONg_tk-OF9ZB1nP1xIVj0xJ4mniLFtDrR-bnXnfwrMxYDxyhs_GfJrjsdEROcRr3_VKffXr-sZluQlca9hMupn70otULVsTB2RJ6OSONsl26NA0g";

const SELLER_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB6sjmZrFqYeUvnkauYkOGBOiBov1QeXSC1pGtilvnYxZe4nXbfR9KfR6GuaH6cEkIb0rECQLrKdIF7QxnnTm20MR0xwItW6Pm6UIEGutPs-NYYn4stMjXnkyyD7T4FlpsePfSpN1UpywjXCqZJgxvYA7lvEZYkUfUYMU3TYkOGknZ6a4fdW-AUKu9w_7KFXBdOHYxvTTPWZ5nbZMdS-nYH7bedA8uZpdDra9xCLSHRtWpFMHMBxCYYtdNoHwjJCHLaGJXMMTXbKp0";

const listings: ListingCard[] = [
  {
    id: "headphones",
    title: "Sony WH-1000XM4 Headphones",
    price: "₹18,500",
    condition: "Like New",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuABf_gn8i_ib5E-ISYEUBENG_hOoNfiC1s7DA_-Ojs6avBF5QbIAYHKAu82t4E3s8gwUB7zWPNhA6xxD0NqktZqYTlYzBqweD_FHIDuw6g2y2_7HQfv9e8-_wo6gC_ToBSVrMLjaoT5qTbSYFTNfmYInMUkqX_V00v4z8Lb59dbbVk3yyRMKP7exbgvFmVRcAXeBedKmbKWE3T6TpcJIT6--Lm8a4_O28Jch_m2huptG2idSjy6QaL25sDO42djTUlACckWIM9eiVE",
  },
  {
    id: "smart-watch",
    title: "Premium Smart Watch Series 7",
    price: "₹12,200",
    condition: "Used",
    liked: true,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBVkDZQXIGwkNuEf-4f_xFneUCOLNsTLgz0wovkM3XUMkLLR_38hOHEi_FHZiK_BqYov7PZvsDpuv57rKV10EYWftgA1MYxg_SVOxvvMCZAh9rphlmKn2p7TMPcd9UXKIeGPBz8cajerJJpQMEqJqUYnwnRZwy85xIN6YT5nP_022KWE3QHBsZ6HQKZ_XVIHv0teIYlfnQYdQSnBNgfpmvgLKj5HUuMxWnapOFgjBSpL8J-mccjMXDwC7WCIjmrZvNGKvEBTINBDNw",
  },
  {
    id: "macbook",
    title: 'MacBook Pro 14" M1 Max',
    subtitle: "32GB RAM, 1TB SSD. Pristine condition.",
    price: "₹1,45,000",
    condition: "Premium",
    premium: true,
    featured: true,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDEYpjJYqSUVlbviny3_0UQDG4o4rWtIsxKAKXutm0iEwZDybw3eekBIEofkr5CEX5_gdRTGSpt_P306iOqcEmR-dMG0ZV3JhaC4pRc1WjdyFsvbMXt69lFZTv3Z2P_yLyeITUd0Xt5W7cnybabEXII7XE2w4-V1Z8-4U_Zii0XG4lNWlIfquBcoVwIkpQdsFT5man04YTsBzTm4L26RSPg7otqqbVpGval_pdw-jW9d_x2ym18EE5LfgExx2njPwDNqb25YUD1Lu0",
  },
  {
    id: "running-shoes",
    title: "Performance Running Shoes",
    price: "₹4,200",
    condition: "New",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDv5s7KZyWGhAWT9f4GuhYbtCO5x83d3gvUDVb3kvERTtGK6fmaJepLOrLMbKbdzYYgrX4mCT9rFp3lnQqemI7SohpDY-dUCVaM5ZbLOQCdpGSVSTOAFTpnSljNmq7zDKeWWVBzdOLDN-msqbH7eVYtOceHSil7IZnpYkP9ZgkZuD4XbeZG5kgI6-J8Q9EKUCSGY25tLMuvtAA2VffzleQvUaxy-SmT_xTqWz-85DOXZ22UzYXMNu4MjSbZyxbenqYBFusgZe5GTdY",
  },
  {
    id: "film-camera",
    title: "Retro Film Camera 35mm",
    price: "₹6,800",
    condition: "Vintage",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAVN468mu8uSnv-hNH4Xj0qXpAODLML7gdyguFmt_7kFdylDhlYs2ArO0ULBXy74WQt-r9JncnxtPY5vIjZJ9LFJJgZ4L2pitwYmMLen4bYyoNlWJvwNPgHNKn9Mi_wBxJkgj6LLMpT6Nz3kvKXk22pNQ0jI1ljxbwtOZocl1SyALFJmQKt5Vyh5hs0bM21p-JAvuChc9mnjCagfkttjh_7VQhv5-zGNcTjxXPwl3Qv1NWcqe4ML1DvfcwEQCcZgcVFFYZ25imZkqM",
  },
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const, active: true },
];

function HalfCard({ item, width }: { item: ListingCard; width: number }) {
  return (
    <View
      className="overflow-hidden rounded-xl border border-[#dde4df] bg-white"
      style={{
        width,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View className="relative h-44 w-full">
        <Image
          source={item.image}
          contentFit="cover"
          transition={200}
          className="h-full w-full"
        />
        <Pressable
          className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/70"
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
        >
          <MaterialIcons
            name={item.liked ? "favorite" : "favorite-border"}
            size={20}
            color={item.liked ? "#EF4444" : "#161D1A"}
          />
        </Pressable>
      </View>
      <View className="flex-1 p-2">
        <Text
          className="text-[14px] leading-5 text-[#161D1A]"
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <View className="mt-2 flex-row items-end justify-between">
          <Text className="text-[16px] font-bold text-[#006b55]">
            {item.price}
          </Text>
          <Text className="text-[10px] font-medium text-[#6c7a74]">
            {item.condition}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function SellerPublicProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { refreshing, onRefresh } = usePullToRefresh();

  const topBarHeight = insets.top + 64;
  const halfCardWidth = useMemo(
    () => (screenWidth - 16 * 2 - 12) / 2,
    [screenWidth],
  );

  const featured = listings.find((item) => item.featured);
  const firstRow = listings.filter((item) => !item.featured).slice(0, 2);
  const secondRow = listings.filter((item) => !item.featured).slice(2);

  const handleBottomTabPress = (tabId: string) => {
    if (tabId === "home") {
      router.push("/home-feed-root");
      return;
    }
    if (tabId === "search") {
      router.push("/search-home");
    }
  };

  return (
    <View className="flex-1 bg-[#F4FBF6]">
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
        <View className="flex-row items-center gap-3">
          <Pressable
            className="-ml-2 h-10 w-10 items-center justify-center"
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={24} color="#161D1A" />
          </Pressable>
          <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
            Listify
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            className="h-10 w-10 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="share" size={22} color="#161D1A" />
          </Pressable>
          <Pressable
            className="h-10 w-10 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="more-vert" size={22} color="#161D1A" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#27BB97"]}
            tintColor="#27BB97"
            progressViewOffset={topBarHeight}
          />
        }
        contentContainerStyle={{
          paddingTop: topBarHeight,
          paddingBottom: 92 + Math.max(insets.bottom, 16),
        }}
      >
        <View>
          <View className="h-40 w-full overflow-hidden">
            <Image
              source={COVER_IMAGE}
              contentFit="cover"
              transition={200}
              className="h-full w-full"
            />
          </View>

          <View className="-mt-12 px-4">
            <View className="h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-white">
              <Image
                source={SELLER_AVATAR}
                contentFit="cover"
                transition={200}
                className="h-full w-full"
              />
            </View>
            <View className="-mt-7 ml-16 h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#006b55]">
              <MaterialIcons name="verified" size={16} color="#FFFFFF" />
            </View>

            <View className="mt-4">
              <Text className="text-[24px] font-bold leading-8 tracking-tight text-[#161D1A]">
                Arjun Sharma
              </Text>
              <View className="mt-1 flex-row items-center gap-1">
                <MaterialIcons name="star" size={14} color="#cba100" />
                <Text className="text-[12px] font-medium text-[#161D1A]">
                  4.9
                </Text>
                <Text className="text-[12px] font-medium text-[#6c7a74]">
                  (214 Reviews)
                </Text>
              </View>
            </View>

            <View className="mt-4 flex-row gap-6 border-y border-[#dde4df]/70 py-2">
              <View>
                <Text className="text-[18px] font-semibold text-[#161D1A]">
                  12
                </Text>
                <Text className="text-[12px] font-medium text-[#6c7a74]">
                  Listings
                </Text>
              </View>
              <View>
                <Text className="text-[18px] font-semibold text-[#161D1A]">
                  450
                </Text>
                <Text className="text-[12px] font-medium text-[#6c7a74]">
                  Followers
                </Text>
              </View>
              <View>
                <Text className="text-[18px] font-semibold text-[#161D1A]">
                  89
                </Text>
                <Text className="text-[12px] font-medium text-[#6c7a74]">
                  Following
                </Text>
              </View>
            </View>

            <View className="mt-4 flex-row gap-4">
              <Pressable
                className="flex-1 items-center rounded-xl bg-[#27BB97] py-3"
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Text className="text-[18px] font-semibold text-white">
                  Follow
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-xl border border-[#bbcac3] bg-white py-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <Text className="text-[18px] font-semibold text-[#161D1A]">
                  Message
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View className="mt-6">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            className="border-b border-[#dde4df]"
          >
            <Pressable className="border-b-2 border-[#006b55] px-6 py-4">
              <Text className="text-[14px] font-semibold text-[#006b55]">
                Listings
              </Text>
            </Pressable>
            <Pressable className="border-b-2 border-transparent px-6 py-4">
              <Text className="text-[14px] font-medium text-[#6c7a74]">
                Reviews
              </Text>
            </Pressable>
            <Pressable className="border-b-2 border-transparent px-6 py-4">
              <Text className="text-[14px] font-medium text-[#6c7a74]">
                About
              </Text>
            </Pressable>
          </ScrollView>

          <View className="mt-4 px-4">
            <View className="flex-row justify-between">
              {firstRow.map((item) => (
                <HalfCard key={item.id} item={item} width={halfCardWidth} />
              ))}
            </View>

            {featured ? (
              <View
                className="mt-3 overflow-hidden rounded-xl border border-[#dde4df] bg-white"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <View className="relative h-56 w-full">
                  <Image
                    source={featured.image}
                    contentFit="cover"
                    transition={200}
                    className="h-full w-full"
                  />
                  {featured.premium ? (
                    <View className="absolute left-2 top-2 rounded-full bg-[#27BB97] px-3 py-1">
                      <Text className="text-[12px] font-medium text-white">
                        Premium
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    className="absolute right-2 top-2 h-10 w-10 items-center justify-center rounded-full bg-white/70"
                    style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                  >
                    <MaterialIcons
                      name="favorite-border"
                      size={24}
                      color="#161D1A"
                    />
                  </Pressable>
                </View>
                <View className="p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-[18px] font-semibold text-[#161D1A]">
                        {featured.title}
                      </Text>
                      {featured.subtitle ? (
                        <Text className="mt-1 text-[14px] leading-5 text-[#6c7a74]">
                          {featured.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-[20px] font-bold text-[#006b55]">
                      {featured.price}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View className="mt-3 flex-row justify-between">
              {secondRow.map((item) => (
                <HalfCard key={item.id} item={item} width={halfCardWidth} />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-100 bg-white"
        style={{
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 12,
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
                  <Text className="mt-1 text-[11px] font-medium tracking-wide text-slate-400">
                    {tab.label}
                  </Text>
                </Pressable>
              );
            }

            return (
              <Pressable
                key={tab.id}
                onPress={() => handleBottomTabPress(tab.id)}
                className="items-center justify-center py-1"
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
