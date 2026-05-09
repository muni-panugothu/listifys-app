import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
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

import { ListifyHomeFeedAssets } from "@/constants/listify-theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { useAppDispatch } from "@/store/hooks";
import { fetchProfile } from "@/store/slices/auth-slice";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2;
const SELL_BANNER_CAMERA_IMAGE =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=500&q=80";

const categories = [
  { id: "all", label: "All", icon: "grid-view" as const },
  { id: "electronics", label: "Electronics", icon: "devices" as const },
  { id: "vehicles", label: "Vehicles", icon: "directions-car" as const },
  { id: "mobiles", label: "Mobiles", icon: "smartphone" as const },
  { id: "furniture", label: "Furniture", icon: "chair" as const },
  { id: "fashion", label: "Fashion", icon: "checkroom" as const },
  { id: "services", label: "Services", icon: "home-repair-service" as const },
  { id: "properties", label: "Properties", icon: "apartment" as const },
  { id: "jobs", label: "Jobs", icon: "work" as const },
  { id: "events", label: "Events", icon: "event" as const },
];

const recommendations = [
  {
    id: "headphones",
    title: "Wireless Noise Cancelling Headphones - Mint Condition",
    price: "₹15,000",
    location: "Bandra, Mumbai",
    image: ListifyHomeFeedAssets.recommendationHeadphones,
    liked: false,
  },
  {
    id: "watch",
    title: "Premium Minimalist Watch Series 4 - Hardly Used",
    price: "₹8,499",
    location: "Andheri, Mumbai",
    image: ListifyHomeFeedAssets.recommendationWatch,
    liked: true,
  },
];

const featuredServices = [
  {
    id: "plumber-visit",
    title: "Expert Plumber Visit",
    price: "From ₹500",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCvVDeAqfUnThr5rMPGkBOzccH-zYB0x2u8Llq6IMX67bVxcgfeAMeq-9xWVITCmFZvTlbsquIc2igXE46GEROxOH2mrJ0JXVqh_2-xKdHW5P0ypObGDSY32ea_-6WBJkrGC1rgXOEDbyFlpRVeRqeT9yfMCSRI6U6-89-i6J9Q0nKn_m8EEnMpwSLqcsYtxraz53LZAuKNxia_R4f_ZGzssWOuB4KnNU5Gv2-r488y7JU5kMIORSz2Dx2988VY2wdzXgWmU1T2H-E",
  },
  {
    id: "deep-cleaning",
    title: "Deep Home Cleaning",
    price: "From ₹1,299",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBe0CDfy2_s56CJFW4z6PgMHbhIy5bCAEJPpKn-Y7PQ-mcJdsO7L49UHFxV6lrgVAMdJhbOn-wSErSrcqRdFiJg7l4aZVEhCLDb7uSGOmPlkRJELNRAW5B4_hoJBXB3m21S7h2ccZnzk4EOQ2mR46mBVSLoXY2O10TB-sCa2GtmGH72BLSlCXjinMag6zse2rQ5mmUNCbm1rkbKeMAdV0PsDsaeSzR1YYA57Nfk7Sk7Upu7Ogq9YdrAFmQxBUVWjfJbJq90VmVnrbE",
  },
  {
    id: "electric-repair",
    title: "Electric Repair & Fix",
    price: "From ₹650",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAMClfKgWx-R5cp0hXW2YY3caff5O-4Nou8qBYQ5ay3E7nlJ_Px0Tz-63SBX9neiDWF07oxrAwxLDgcBlPzy-GLoemjdXC9vaT7Zzcqva_WO_RAVLP94O-vE0D8E5An_Z-QskUcJUsdLlkebS8A4bSHHpLKu5baRbHtnv0nRNeq1kA81nOzJBOGQnKkd1AoPD1ybaF1CzhNfhIDH2WWyWSX1OWhB9LCsoUIROmU2UjomR0XrV0flTvXbOLLc-rZHzitc8lUQF7LIro",
  },
  {
    id: "leak-specialist",
    title: "Leak Detection Specialist",
    price: "From ₹450",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAojdUCJ2PxDfy74Vbyrz1zJc8WZPw9nQTzVxilu0RyTaefuCHAP_sCWfVsp0LlfcXb37lMnhIK6zudAObvSX0_jkECqQAuxEeKPfPvQt-voljCycnTqKYuhrbwZVp8RzQsemlIcHN5RUZznu0SoRQe7mny9kN04Bdg-zGtqjEgRieXqU4VosW7yXb7vp52hq6fY2xJESuoGTDbv5oLBRwy7QOTkS2Txm1B6F9ew09dKEMPjAzTdqGaqzOJ06XcaZf4AEwVf5BGsk4",
  },
];

const recentItems = [
  {
    id: "macbook",
    title: "MacBook Pro 2021",
    price: "₹85,000",
    image: ListifyHomeFeedAssets.recentMacbook,
  },
  {
    id: "nike",
    title: "Nike Air Max Speed",
    price: "₹4,200",
    image: ListifyHomeFeedAssets.recentNike,
  },
  {
    id: "sofa",
    title: "Velvet Modern Sofa",
    price: "₹22,500",
    image: ListifyHomeFeedAssets.recentSofa,
  },
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const, active: true },
  { id: "search", label: "Search", icon: "search" as const },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function HomeFeedRootScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const handleRefresh = useCallback(async () => {
    // Re-fetch user profile + any server-side data to keep the feed fresh
    await dispatch(fetchProfile()).unwrap().catch(() => {});
    // Future: fetch listings, recommendations, etc. from API here
  }, [dispatch]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const handleBottomTabPress = useTabNavigation();

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* ===== TOP APP BAR ===== */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{
          paddingTop: insets.top,
          height: insets.top + 64,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center gap-3">
          <MaterialIcons name="storefront" size={26} color="#27BB97" />
          <View>
            <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
              Listify
            </Text>
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="location-on" size={13} color="#64748B" />
              <Text className="text-[12px] font-medium tracking-wide text-slate-500">
                Mumbai, IN
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <MaterialIcons name="notifications-none" size={24} color="#161D1A" />
        </Pressable>
      </View>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#27BB97"]}
            tintColor="#27BB97"
            progressViewOffset={insets.top + 64}
          />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 64 + 16,
          paddingBottom: 80 + Math.max(insets.bottom, 16),
        }}
      >
        {/* Search Section */}
        <View className="mb-4 flex-row items-center gap-2 px-4">
          <View
            className="h-12 flex-1 flex-row items-center rounded-xl border border-slate-100 bg-white px-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <MaterialIcons name="search" size={22} color="#94A3B8" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search product, category..."
              placeholderTextColor="#94A3B8"
              className="ml-2 flex-1 text-[14px] leading-5 text-[#161D1A]"
              style={{ paddingVertical: 0 }}
            />
          </View>
          <Pressable
            className="h-12 w-12 items-center justify-center rounded-xl border border-slate-100 bg-white"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <MaterialIcons name="tune" size={22} color="#27BB97" />
          </Pressable>
        </View>

        {/* Horizontal Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
          className="mb-6"
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  setSelectedCategory(cat.id);
                  if (cat.id === "electronics") {
                    router.push("/category-listing-template");
                    return;
                  }
                  if (cat.id === "services") {
                    router.push("/services-category-hub");
                    return;
                  }
                  if (cat.id === "properties") {
                    router.push("/properties-listing");
                  }
                  if (cat.id === "jobs") {
                    router.push("/jobs-listing");
                  }
                  if (cat.id === "events") {
                    router.push("/events-listing");
                  }
                }}
                className="items-center gap-1"
              >
                <View
                  className="h-14 w-14 items-center justify-center rounded-full"
                  style={
                    isActive
                      ? {
                          backgroundColor: "#27BB97",
                          shadowColor: "#27BB97",
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.3,
                          shadowRadius: 6,
                          elevation: 4,
                        }
                      : {
                          backgroundColor: "#FFFFFF",
                          borderWidth: 1,
                          borderColor: "#F1F5F9",
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 2,
                          elevation: 1,
                        }
                  }
                >
                  <MaterialIcons
                    name={cat.icon}
                    size={24}
                    color={isActive ? "#FFFFFF" : "#475569"}
                  />
                </View>
                <Text
                  className="text-[12px] font-medium"
                  style={{
                    color: isActive ? "#161D1A" : "#64748B",
                    letterSpacing: 0.3,
                  }}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sell Banner */}
        <View className="mx-4 mb-6">
          <View
            className="h-36 overflow-hidden rounded-2xl"
            style={{
              shadowColor: "#27BB97",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.24,
              shadowRadius: 14,
              elevation: 8,
            }}
          >
            <LinearGradient
              colors={["#24B08F", "#1D9477"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            >
              <View className="absolute -top-8 -right-6 h-24 w-24 rounded-full bg-white/10" />
              <View className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/10" />

              <View className="flex-1 flex-row items-center justify-between px-4 py-4">
                <View className="max-w-44">
                  <Text className="mb-2 text-[17px] font-semibold leading-6 text-white">
                    Sell what you don&apos;t use and earn today
                  </Text>
                  <Text className="mb-3 text-[12px] leading-4 text-white/85">
                    Snap a photo, add details, and publish in minutes.
                  </Text>
                  <Pressable
                    onPress={() => router.push("/sell-entry")}
                    className="self-start flex-row items-center gap-1 rounded-full bg-white px-4 py-2"
                  >
                    <MaterialIcons
                      name="camera-alt"
                      size={15}
                      color="#1D9477"
                    />
                    <Text className="text-[12px] font-semibold text-[#1D9477]">
                      Sell Now
                    </Text>
                  </Pressable>
                </View>

                <View className="relative h-28 w-24 items-center justify-center">
                  <View className="h-28 w-24 overflow-hidden rounded-2xl border border-white/35 bg-white/20">
                    <Image
                      source={SELL_BANNER_CAMERA_IMAGE}
                      contentFit="cover"
                      transition={200}
                      className="h-full w-full"
                    />
                  </View>
                  <View className="absolute -bottom-2 -right-2 h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
                    <MaterialIcons
                      name="add-a-photo"
                      size={16}
                      color="#1D9477"
                    />
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Fresh Recommendations */}
        <View className="mb-6 px-4">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-[20px] font-semibold tracking-tight text-[#161D1A]">
              Fresh Recommendations
            </Text>
            <Pressable>
              <Text className="text-[12px] font-medium text-[#27BB97]">
                See all
              </Text>
            </Pressable>
          </View>

          <View className="flex-row justify-between">
            {recommendations.map((item) => (
              <View
                key={item.id}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white"
                style={{
                  width: CARD_WIDTH,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                {/* Product Image */}
                <View style={{ width: CARD_WIDTH, height: CARD_WIDTH }}>
                  <Image
                    source={item.image}
                    contentFit="cover"
                    transition={200}
                    className="h-full w-full"
                  />
                  {/* Trusted Badge */}
                  <View className="absolute left-2 top-2 flex-row items-center gap-1 rounded-full bg-white/90 px-2 py-0.5">
                    <MaterialIcons name="verified" size={13} color="#27BB97" />
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-[#161D1A]">
                      Trusted
                    </Text>
                  </View>
                  {/* Favorite Button */}
                  <Pressable className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/70">
                    <MaterialIcons
                      name={item.liked ? "favorite" : "favorite-border"}
                      size={18}
                      color={item.liked ? "#EF4444" : "#161D1A"}
                    />
                  </Pressable>
                </View>

                {/* Card Info */}
                <View className="p-3">
                  <Text
                    className="mb-1 text-[14px] leading-5 text-[#3C4A44]"
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text className="mb-2 text-[16px] font-bold leading-5 text-[#161D1A]">
                    {item.price}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <MaterialIcons
                      name="location-on"
                      size={13}
                      color="#94A3B8"
                    />
                    <Text className="text-[10px] font-medium text-[#94A3B8]">
                      {item.location}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Featured Services */}
        <View className="mb-6">
          <View className="mb-4 flex-row items-center justify-between px-4">
            <Text className="text-[20px] font-semibold tracking-tight text-[#161D1A]">
              Featured Services
            </Text>
            <Pressable onPress={() => router.push("/services-category-hub")}>
              <Text className="text-[12px] font-medium text-[#27BB97]">
                See all
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {featuredServices.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push("/services-category-hub")}
                className="w-48"
              >
                <View
                  className="mb-2 overflow-hidden rounded-xl"
                  style={{ aspectRatio: 4 / 3 }}
                >
                  <Image
                    source={item.image}
                    contentFit="cover"
                    transition={200}
                    className="h-full w-full"
                  />
                </View>
                <Text
                  className="text-[14px] leading-5 text-[#161D1A]"
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <Text className="text-[16px] font-bold text-[#27BB97]">
                  {item.price}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Recently Viewed */}
        <View className="mb-6">
          <View className="mb-4 flex-row items-center justify-between px-4">
            <Text className="text-[20px] font-semibold tracking-tight text-[#161D1A]">
              Recently Viewed
            </Text>
            <Pressable>
              <Text className="text-[12px] font-medium text-[#27BB97]">
                Clear
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {recentItems.map((item) => (
              <Pressable key={item.id} className="w-40">
                <View
                  className="mb-2 overflow-hidden rounded-xl"
                  style={{ aspectRatio: 4 / 3 }}
                >
                  <Image
                    source={item.image}
                    contentFit="cover"
                    transition={200}
                    className="h-full w-full"
                  />
                </View>
                <Text
                  className="text-[14px] leading-5 text-[#161D1A]"
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text className="text-[16px] font-bold text-[#27BB97]">
                  {item.price}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* ===== BOTTOM NAVIGATION BAR ===== */}
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
