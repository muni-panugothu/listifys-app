import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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

type PropertyItem = {
  id: string;
  title: string;
  location: string;
  price: string;
  subtitle?: string;
  bhk: string;
  area: string;
  parking?: string;
  image: string;
  featured?: boolean;
  premium?: boolean;
  liked?: boolean;
};

const CONTAINER_PADDING = 16;
const GRID_GAP = 12;

const filterChips = ["BHK", "Budget", "Furnishing", "Amenities"];

const properties: PropertyItem[] = [
  {
    id: "elysian",
    title: "Elysian Heights Penthouse",
    location: "Worli Sea Face, Mumbai",
    price: "₹8.50 Cr",
    subtitle: "₹28,500/sq.ft",
    bhk: "4 BHK",
    area: "3,200 sq.ft",
    parking: "2 Parking",
    featured: true,
    premium: true,
    liked: true,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAX5Gu-WV6nZ0vwM9e6-QOBoMMYjpV2Zi_egjYx7zMj7EDDsAeZcCXMRNAkViHm_xy5f-e9xsM86HBJOSRJ17tCie3kjPLs4onMWD5OtZIz00prOayZwE-reE5xFfRBDGvpTFc1WOb1zDQm0DX7JVAh1qS_skvA-ytgnZBNVKy86Ns1poNryH87YzqwrMgrl67Ws7BE9xDZXgjqSWSi6FdBz3Rp9O5Gm3jHLfxF14BSW2jejxJQL8RankQpZaNr-3ux7WvmfRCoF08",
  },
  {
    id: "skyline",
    title: "Skyline Residency",
    location: "Andheri West, Mumbai",
    price: "₹2.40 Cr",
    bhk: "2 BHK",
    area: "1,050 sq.ft",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBunEimnF_YHK49Y9Gshu-fFGuOtQL4iJOmJmM6KpiY4uqzYp9J7UQTopNi1nobj5Ja4jINpB9m7_J0hZ4uBCGNI0eZ9EZcRIx1DXL25AyPnS6--l5mo-7ng7rN7_t_iaogm-dSHzqoRFRHkKE-gcL7_JwTqnm0UWMDC_RXvr5KIqV5y6_I9MbAoNfPGGHhn8GibhIn9GcUr6emLafhtGJvHknvDNjrj68ObimOxar69HqIu8KxfsCU3KU3iSD6ACbARzm1OhNMnFE",
  },
  {
    id: "green-valley",
    title: "Green Valley Villa",
    location: "Powai, Mumbai",
    price: "₹4.15 Cr",
    bhk: "3 BHK",
    area: "2,100 sq.ft",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDmFqHvJc9Gy6V01l986Mz6Yg67pPxuS_P_kAFjOQeAYXZaQGWchne4_q3k6GIB9WS2e0Cs98tNab-NqTM9wNOJ9HiosOnax9jqx1s4BfLad1kLQf3r27JdkcvvdmdxK9pnFGDmEAUAkFaEKuxJ7_GS4QmPmkII5i3cZ04AGwIDlaAdUHeuwG-zJkxXhCksjTJf9pWmHj40QA7tgbkMc37Xf44FcDMooOM30pPu7Q-ulpWHg5t5dQx1rd-MEGTCwZSpypTE5PEwfE4",
  },
  {
    id: "urban-loft",
    title: "The Urban Loft",
    location: "Bandra East, Mumbai",
    price: "₹1.10 Cr",
    bhk: "1 BHK",
    area: "650 sq.ft",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDVedqh2pkY54Q05JyRCpS34g-2Xr_1NiXmdjW4-Fd5iOUsiT3V8MDBtufyNF6M93Ocw4LxKUbJNkNsY5vupFvRV2oIGJHyB8NsyJgMdyshaLBrEtXkhzcQ8J7Jb5XZVIviUapAvpez3PW2SCgCYB04SCNmzcNw5PQBDxHmZxHbHn04kjdQbQHR0ZMMlGHbVnk34sArhMXhZO8AR9dNfiaVgYC6JnadchyurdnrZ9TYJi0AKiSmKEkn9X2--bWEpm3uxy7lAszGLWI",
  },
  {
    id: "oceanique",
    title: "Oceanique Towers",
    location: "Juhu, Mumbai",
    price: "₹6.75 Cr",
    bhk: "4 BHK",
    area: "2,800 sq.ft",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDnuECXdqus8UYk6pwuDJ0E-r8Gs0VHVD1L2L3gVy6TJMgVGxy59rv2Ye56CIerfLtEqtw7tHCIqrldsUBgnnSkGbpuXfG8W8thb7K0esvjPqvO5-eGNnMOQYkYte2TRe515DAe7AlNvXxCJICAlJ55ApBnFa0dnIDC7L8aVhgSuBNzl17yW3YhYFiaY-nZtwh0ozT_arlb3lE90tsZnuNiGQaO3iF7nxiF5Kud8gg2B613CJwuqVQ-JpPUs0sG7hD7L4x6FfKPV2g",
  },
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function PropertiesListingScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { refreshing, onRefresh } = usePullToRefresh();
  const [listingType, setListingType] = useState<"buy" | "rent">("buy");

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const columns = screenWidth >= 768 ? 2 : 1;
  const regularCardWidth = useMemo(() => {
    if (columns === 1) {
      return screenWidth - CONTAINER_PADDING * 2;
    }

    return (screenWidth - CONTAINER_PADDING * 2 - GRID_GAP) / 2;
  }, [columns, screenWidth]);

  const featured = properties.find((item) => item.featured);
  const regular = properties.filter((item) => !item.featured);

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
        className="absolute inset-x-0 top-0 z-50 border-b border-slate-100 bg-white/80 px-4"
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
        <View className="h-16 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="storefront" size={24} color="#27BB97" />
            <View>
              <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
                Listify
              </Text>
              <View className="-mt-1 flex-row items-center gap-1">
                <MaterialIcons name="location-on" size={12} color="#6C7A74" />
                <Text className="text-[12px] font-medium text-[#6C7A74]">
                  Bandra, Mumbai
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              className="rounded-full p-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <MaterialIcons name="search" size={22} color="#161D1A" />
            </Pressable>
            <Pressable
              className="rounded-full p-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <MaterialIcons name="notifications" size={22} color="#161D1A" />
            </Pressable>
          </View>
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
          paddingTop: topBarHeight + 16,
          paddingBottom: 90 + bottomNavPadding,
          paddingHorizontal: CONTAINER_PADDING,
        }}
      >
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-[24px] font-bold text-[#161D1A]">
            Real Estate
          </Text>
        </View>

        <View className="mb-4 rounded-xl bg-[#E9EFEB] p-1 flex-row">
          <Pressable
            onPress={() => setListingType("buy")}
            className="flex-1 rounded-lg py-2"
            style={{
              backgroundColor:
                listingType === "buy" ? "#FFFFFF" : "transparent",
              shadowColor: listingType === "buy" ? "#000" : "transparent",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: listingType === "buy" ? 0.08 : 0,
              shadowRadius: 2,
              elevation: listingType === "buy" ? 1 : 0,
            }}
          >
            <Text
              className="text-center text-[18px] font-semibold"
              style={{ color: listingType === "buy" ? "#006B55" : "#6C7A74" }}
            >
              Buy
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setListingType("rent")}
            className="flex-1 rounded-lg py-2"
            style={{
              backgroundColor:
                listingType === "rent" ? "#FFFFFF" : "transparent",
              shadowColor: listingType === "rent" ? "#000" : "transparent",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: listingType === "rent" ? 0.08 : 0,
              shadowRadius: 2,
              elevation: listingType === "rent" ? 1 : 0,
            }}
          >
            <Text
              className="text-center text-[18px] font-semibold"
              style={{ color: listingType === "rent" ? "#006B55" : "#6C7A74" }}
            >
              Rent
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          className="mb-6"
        >
          <Pressable className="flex-row items-center gap-1.5 rounded-full bg-[#27BB97] px-4 py-2">
            <MaterialIcons name="tune" size={18} color="#FFFFFF" />
            <Text className="text-[12px] font-medium text-white">Filters</Text>
          </Pressable>

          {filterChips.map((chip) => (
            <Pressable
              key={chip}
              className="rounded-full border px-4 py-2"
              style={{
                borderColor: "rgba(187,202,195,0.3)",
                backgroundColor: "#E3EAE5",
              }}
            >
              <Text className="text-[12px] font-medium text-[#161D1A]">
                {chip}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View
          className="flex-row flex-wrap"
          style={{ rowGap: GRID_GAP, columnGap: GRID_GAP }}
        >
          {featured ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/property-detail",
                  params: {
                    title: featured.title,
                    price: featured.price,
                    location: featured.location,
                    bhk: featured.bhk,
                    area: featured.area,
                  },
                })
              }
              className="overflow-hidden rounded-xl border border-slate-100 bg-white"
              style={{ width: screenWidth - CONTAINER_PADDING * 2 }}
            >
              <View
                style={{ height: columns === 1 ? 240 : 320 }}
                className="relative w-full"
              >
                <Image
                  source={featured.image}
                  contentFit="cover"
                  transition={200}
                  className="h-full w-full"
                />

                <View className="absolute right-4 top-4">
                  <Pressable
                    className="rounded-full bg-white/70 p-2"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <MaterialIcons
                      name={featured.liked ? "favorite" : "favorite-border"}
                      size={20}
                      color={featured.liked ? "#EF4444" : "#161D1A"}
                    />
                  </Pressable>
                </View>

                {featured.premium ? (
                  <View className="absolute bottom-4 left-4 rounded-full bg-[#27BB97] px-3 py-1">
                    <Text className="text-[12px] font-medium text-white">
                      Premium
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="p-4">
                <View className="mb-2 flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-[20px] font-semibold text-[#161D1A]">
                      {featured.title}
                    </Text>
                    <View className="mt-0.5 flex-row items-center gap-1">
                      <MaterialIcons
                        name="location-on"
                        size={16}
                        color="#6C7A74"
                      />
                      <Text className="text-[14px] text-[#6C7A74]">
                        {featured.location}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end">
                    <Text className="text-[20px] font-bold text-[#006B55]">
                      {featured.price}
                    </Text>
                    <Text className="text-[12px] text-[#6C7A74]">
                      {featured.subtitle}
                    </Text>
                  </View>
                </View>

                <View className="mt-2 flex-row gap-4 border-t border-slate-100 pt-3">
                  <View className="flex-row items-center gap-1">
                    <MaterialIcons name="bed" size={20} color="#6C7A74" />
                    <Text className="text-[12px] text-[#6C7A74]">
                      {featured.bhk}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-1">
                    <MaterialIcons
                      name="square-foot"
                      size={20}
                      color="#6C7A74"
                    />
                    <Text className="text-[12px] text-[#6C7A74]">
                      {featured.area}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-1">
                    <MaterialIcons
                      name="directions-car"
                      size={20}
                      color="#6C7A74"
                    />
                    <Text className="text-[12px] text-[#6C7A74]">
                      {featured.parking}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ) : null}

          {regular.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                router.push({
                  pathname: "/property-detail",
                  params: {
                    title: item.title,
                    price: item.price,
                    location: item.location,
                    bhk: item.bhk,
                    area: item.area,
                  },
                })
              }
              className="overflow-hidden rounded-xl border border-slate-100 bg-white"
              style={{ width: regularCardWidth }}
            >
              <View className="relative h-45 w-full">
                <Image
                  source={item.image}
                  contentFit="cover"
                  transition={200}
                  className="h-full w-full"
                />

                <Pressable
                  className="absolute right-3 top-3 rounded-full bg-white/70 p-1.5"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <MaterialIcons
                    name={item.liked ? "favorite" : "favorite-border"}
                    size={18}
                    color="#161D1A"
                  />
                </Pressable>
              </View>

              <View className="p-4">
                <Text className="mb-1 text-[16px] font-bold text-[#006B55]">
                  {item.price}
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-[18px] font-semibold text-[#161D1A]"
                >
                  {item.title}
                </Text>
                <Text
                  numberOfLines={1}
                  className="mb-3 text-[14px] text-[#6C7A74]"
                >
                  {item.location}
                </Text>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[12px] text-[#6C7A74]">
                      {item.bhk}
                    </Text>
                    <Text className="text-[12px] text-slate-300">•</Text>
                    <Text className="text-[12px] text-[#6C7A74]">
                      {item.area}
                    </Text>
                  </View>
                  <MaterialIcons name="verified" size={18} color="#6C7A74" />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/nearby-map-view-bottom-sheet",
            params: { q: "properties near me" },
          })
        }
        className="absolute right-6 z-40 flex-row items-center gap-2 rounded-full bg-[#27BB97] px-4 py-4"
        style={{
          bottom: 84 + bottomNavPadding,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <MaterialIcons name="map" size={20} color="#FFFFFF" />
        <Text className="text-[12px] font-medium text-white">View Map</Text>
      </Pressable>

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
