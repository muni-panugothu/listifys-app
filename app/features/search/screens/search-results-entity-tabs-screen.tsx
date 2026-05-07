import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
    Dimensions,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";

type SearchResultItem = {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  location: string;
  image: string;
  liked?: boolean;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GUTTER = 12;
const GRID_SIDE_PADDING = 20;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_SIDE_PADDING * 2 - GRID_GUTTER) / 2;

const entityTabs = ["All", "Items (240)", "Services (12)", "Jobs (3)"];
const filterChips = ["Price: Low to High", "Near by (5km)", "Nearby Map"];

const results: SearchResultItem[] = [
  {
    id: "iphone-blue",
    title: "iPhone 13 - 128GB Blue",
    subtitle: "Excellent condition",
    price: "₹42,999",
    location: "Bandra, Mumbai",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBygftIkUPI5aHY8q3lAAEU7r18zWQNmRIwTXBzkHm2I78K8Ao6zl5C3-lEGSF2P8p0DcMn7ovFPEoRD6hZjQCR-cDb9KHxBMExLnGMxlXtGzzKzKSsUWmaQyEfzXD2VG_P1Mh9672Nf_7VAvG4RiUqrb8NsSAEV7x4QVowFbS1Ra-MEF7g5P3MVu4wsA4Ui6GzQHuRw6p4O3uroblgXTROQN_l52AD-Zl999wIUlrB7t5eYh2kwilAVnJWNtvF3PN54mDFJazTeaU",
  },
  {
    id: "iphone-starlight",
    title: "iPhone 13 Starlight",
    subtitle: "6 months warranty",
    price: "₹44,500",
    location: "Indiranagar, BLR",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDkcwrJK-xeV0z84Wj9Zy8T93vhIdc7vIOMulf66E2pvX5CWVPH-Mdx0UtUrnYoYp4mTL0__FU2xyCxiFjHinlkmalIF5HGuxOdV3NggooDIiNWvchvA1NKlXFkvYNYFf7HuM3pMW9XmUoVHeHxjBFD0IXDp4bOyLwyEqPC6QOtGOc54az27S6rfK99NG_KDe7h6QI3uCMCGkCeLdCvNUG2-jp6QxZfj6xeZxiVEODJqEVZSG2S3-t6Ng0QiFMO5ElG9R9Cy9Sttmc",
    liked: true,
  },
  {
    id: "iphone-pink",
    title: "iPhone 13 Pink - MINT",
    subtitle: "Full kit available",
    price: "₹43,200",
    location: "Salt Lake, Kolkata",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA1U33AGzQPuq-zU7MkEsuarkCgQI-sJJ2RisYo4SattDV6xr2z6jmwXPBwS8W_V2qveHNyMbjCm7mc6_zrPShk3cpFOhLoo16VWQLKH6oYTD4Gh37Elv8B9sHaqiQV3e3eQbOhR3mxgNwJnEc-jfy1RH3ypLcyfvKcXmKMMWMuQGCPfhhb2yRHeuP7q0A_Lbow-9tJsCN3Ge9BhvpTaDFaypLEB34eqdR2FJilyvia2kjOwvHRsPgbD6jyRaX1zYznbMwvueLzZSk",
  },
  {
    id: "iphone-midnight",
    title: "iPhone 13 Midnight Black",
    subtitle: "Battery Health 92%",
    price: "₹41,800",
    location: "Adyar, Chennai",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD0YHeP8H0-dOkDda6DxMeeste2sIU1GDJcz382Fv5DOkoyRynABq0aNtv1k8pcUmJXifE34LWmq7JIXhZ-Ue4JdmBbTlJHKVdAGYQ8Kl56j2zLZHpR5L4ftKFFip72DxPhAkmUjnbBT8dYNDFatF7rH04dj12MqkAvruwPTNnbIvhClTTylZIsstfIRBuVO4MRZfCo-4ZG7lrEf6wErfYNq21GVcQ9FTy81Vxl3fB_rNsDR16kojyRb1rAyBNATufO1D6Qo6pS9Gk",
  },
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

function parseQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "iPhone 13";
  }
  return value ?? "iPhone 13";
}

export function SearchResultsEntityTabsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const [activeEntityTab, setActiveEntityTab] = useState("Items (240)");
  const [searchQuery, setSearchQuery] = useState(() =>
    parseQueryParam(params.q),
  );
  const { refreshing, onRefresh } = usePullToRefresh();

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);

  const handleBottomTabPress = (tabId: string) => {
    if (tabId === "home") {
      router.push("/home-feed-root");
      return;
    }

    if (tabId === "sell") {
      router.push("/sell-entry");
      return;
    }

    if (tabId === "search") {
      router.push("/search-home");
      return;
    }

    if (tabId === "messages") {
      router.push("/messages-inbox");
      return;
    }

    if (tabId === "profile") {
      router.push("/dashboard-home");
      return;
    }
  };

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      <View
        className="absolute inset-x-0 top-0 z-50 border-b border-slate-100 bg-white/90 px-4"
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
        <View className="h-16 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={23} color="#27BB97" />
          </Pressable>

          <View className="relative flex-1">
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="h-10 rounded-full bg-[#EFF5F0] pl-10 pr-4 text-[14px] text-[#161D1A]"
              style={{ paddingVertical: 0 }}
            />
            <View className="absolute left-3 top-0 h-10 items-center justify-center">
              <MaterialIcons name="search" size={16} color="#6C7A74" />
            </View>
          </View>

          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="tune" size={21} color="#64748B" />
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
          paddingBottom: 84 + bottomNavPadding,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-[#DDE4DF] bg-white"
          contentContainerStyle={{ paddingHorizontal: 8 }}
        >
          {entityTabs.map((tab) => {
            const isActive = tab === activeEntityTab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveEntityTab(tab)}
                className="px-4 py-3"
                style={{
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? "#27BB97" : "transparent",
                }}
              >
                <Text
                  className="text-[12px] font-medium"
                  style={{ color: isActive ? "#27BB97" : "#6C7A74" }}
                >
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 8,
            paddingVertical: 16,
          }}
        >
          <Pressable className="flex-row items-center gap-1 rounded-full border border-[#DDE4DF] bg-white px-3 py-1.5">
            <Text className="text-[12px] font-medium text-[#3C4A44]">
              {filterChips[0]}
            </Text>
            <MaterialIcons name="expand-more" size={16} color="#3C4A44" />
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/nearby-map-view-bottom-sheet",
                params: { q: searchQuery },
              })
            }
            className="flex-row items-center gap-1 rounded-full border border-[#27BB97]/20 bg-[#27BB97]/10 px-3 py-1.5"
          >
            <MaterialIcons name="near-me" size={15} color="#27BB97" />
            <Text className="text-[12px] font-medium text-[#27BB97]">
              {filterChips[1]}
            </Text>
            <MaterialIcons name="close" size={16} color="#27BB97" />
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/nearby-map-view-bottom-sheet",
                params: { q: searchQuery },
              })
            }
            className="flex-row items-center gap-1 rounded-full border border-[#27BB97]/20 bg-white px-3 py-1.5"
          >
            <MaterialIcons name="map" size={15} color="#27BB97" />
            <Text className="text-[12px] font-medium text-[#27BB97]">
              {filterChips[2]}
            </Text>
          </Pressable>
        </ScrollView>

        <View
          className="flex-row flex-wrap"
          style={{
            paddingHorizontal: GRID_SIDE_PADDING,
            columnGap: GRID_GUTTER,
            rowGap: GRID_GUTTER,
          }}
        >
          {results.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push("/listing-detail-template")}
              className="overflow-hidden rounded-xl border border-[#E9EFEB] bg-white"
              style={{ width: CARD_WIDTH }}
            >
              <View style={{ width: CARD_WIDTH, height: CARD_WIDTH }}>
                <Image
                  source={item.image}
                  contentFit="cover"
                  transition={200}
                  className="h-full w-full"
                />
                <Pressable className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/80">
                  <MaterialIcons
                    name={item.liked ? "favorite" : "favorite-border"}
                    size={18}
                    color={item.liked ? "#BA1A1A" : "#161D1A"}
                  />
                </Pressable>
              </View>

              <View className="flex-1 p-3">
                <View>
                  <Text
                    numberOfLines={1}
                    className="text-[14px] text-[#161D1A]"
                  >
                    {item.title}
                  </Text>
                  <Text className="mt-1 text-[12px] text-[#6C7A74]">
                    {item.subtitle}
                  </Text>
                </View>

                <View className="mt-2">
                  <Text className="text-[16px] font-bold text-[#27BB97]">
                    {item.price}
                  </Text>
                  <View className="mt-1 flex-row items-center gap-1">
                    <MaterialIcons
                      name="location-on"
                      size={12}
                      color="#6C7A74"
                    />
                    <Text className="text-[10px] text-[#6C7A74]">
                      {item.location}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

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
                className="items-center py-1"
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
