import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";

type ServiceCategory = {
  id: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBg: string;
  iconColor: string;
};

type ProfessionalCard = {
  id: string;
  name: string;
  subtitle: string;
  rating: string;
  price: string;
  unit: string;
  image: string;
  topRated?: boolean;
};

const CONTAINER_PADDING = 16;
const GRID_GAP = 12;

const serviceCategories: ServiceCategory[] = [
  {
    id: "home-repairs",
    title: "Home Repairs",
    icon: "home-repair-service",
    iconBg: "#FFF7ED",
    iconColor: "#F97316",
  },
  {
    id: "cleaning",
    title: "Cleaning",
    icon: "cleaning-services",
    iconBg: "#EFF6FF",
    iconColor: "#3B82F6",
  },
  {
    id: "beauty",
    title: "Beauty",
    icon: "face-retouching-natural",
    iconBg: "#FDF2F8",
    iconColor: "#EC4899",
  },
  {
    id: "lessons",
    title: "Lessons",
    icon: "school",
    iconBg: "#FEFCE8",
    iconColor: "#CA8A04",
  },
  {
    id: "moving",
    title: "Moving",
    icon: "local-shipping",
    iconBg: "#FAF5FF",
    iconColor: "#A855F7",
  },
  {
    id: "more",
    title: "More",
    icon: "more-horiz",
    iconBg: "#F8FAFC",
    iconColor: "#64748B",
  },
];

const featuredProfessionals: ProfessionalCard[] = [
  {
    id: "amit-home-fix",
    name: "Amit's Home Fix",
    subtitle: "Plumbing & Electrical",
    rating: "4.9",
    price: "₹499",
    unit: "/ per visit",
    topRated: true,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC656NZRT5tfeOeGDSmYyblDMfhkUstZRIN1ioy2xQCS8yI7_RF4d0fPKN0VYwcmGkogX85-ZUHSAxmFkzUoy2a2MVB7qZk5InMNL6Krnmk4sV9-OaybnJqCnlG51bwrgB_3BIHpWGby2YEAEBKImf_RCpkwkOkSBR7IqczYAgXXJD37ttEfiQQd7JTjvFsea4uKGYAsqlnZgxxrbsyVBawCyCZKH8WTPm4YGOq9hAhBQQgtfxaUa0GRXy7eaSVdbJ0REXUVQgHIKA",
  },
  {
    id: "pristine-cleaners",
    name: "Pristine Cleaners",
    subtitle: "Deep House Cleaning",
    rating: "4.8",
    price: "₹1,299",
    unit: "/ session",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBe0CDfy2_s56CJFW4z6PgMHbhIy5bCAEJPpKn-Y7PQ-mcJdsO7L49UHFxV6lrgVAMdJhbOn-wSErSrcqRdFiJg7l4aZVEhCLDb7uSGOmPlkRJELNRAW5B4_hoJBXB3m21S7h2ccZnzk4EOQ2mR46mBVSLoXY2O10TB-sCa2GtmGH72BLSlCXjinMag6zse2rQ5mmUNCbm1rkbKeMAdV0PsDsaeSzR1YYA57Nfk7Sk7Upu7Ogq9YdrAFmQxBUVWjfJbJq90VmVnrbE",
  },
];

const seasonalPromoImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDdKp2gedTW5TK1ecawpDBHA_UJuCEOsLAlIQUUL8Fjl0mwdAadZbmTBdsHq71YhJdXiJDtlz22rx8I7k_pJlStDHGO6t_63Pm1arJOVR4nsecWduuOrnsG-x1irl_UPMazZO_DGJYt_z5eSgSIy0Q0pu06N6Rf7TUzIof9tY54ryKd3apUyuQBpItDmLrO-m3FppFARA4kp2aCOBRZlcE5AGnh4muKPJuHEqkm6RjNC9iJ7ElJcFDnI9JTmkMPsMx_aynvUZ24n4M";

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function ServicesCategoryHubScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const { refreshing, onRefresh } = usePullToRefresh();

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const categoryCardWidth = useMemo(
    () => (screenWidth - CONTAINER_PADDING * 2 - GRID_GAP) / 2,
    [screenWidth],
  );

  const openSearchResults = (value: string) => {
    router.push({
      pathname: "/search-results-entity-tabs",
      params: { q: value },
    });
  };

  const openServiceCategory = (name: string) => {
    const listingTitle =
      name === "Home Repairs" ? "Plumbing Services" : `${name} Services`;

    router.push({
      pathname: "/service-listing-grid",
      params: { title: listingTitle },
    });
  };

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
      {/* ===== TOP APP BAR ===== */}
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
          <Pressable
            className="flex-row items-center gap-2"
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="storefront" size={24} color="#27BB97" />
            <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
              Listify
            </Text>
          </Pressable>

          <Pressable
            className="rounded-full p-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="notifications" size={24} color="#64748B" />
          </Pressable>
        </View>
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
            progressViewOffset={topBarHeight}
          />
        }
        contentContainerStyle={{
          paddingTop: topBarHeight + 20,
          paddingBottom: 88 + bottomNavPadding,
          paddingHorizontal: CONTAINER_PADDING,
        }}
      >
        {/* Local Services Header & Location */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-[24px] font-bold tracking-tight text-[#161D1A]">
              Local Services
            </Text>
            <Pressable className="flex-row items-center gap-1">
              <MaterialIcons name="location-on" size={18} color="#005FB0" />
              <Text className="text-[12px] font-medium tracking-wide text-[#005FB0]">
                Bangalore, KA
              </Text>
            </Pressable>
          </View>
          <Text className="mt-1 text-[14px] text-[#3C4A44]">
            Find trusted professionals for every task.
          </Text>
        </View>

        {/* Search Bar */}
        <View className="relative mb-6">
          <View className="pointer-events-none absolute bottom-0 left-4 top-0 z-10 justify-center">
            <MaterialIcons name="search" size={24} color="#6C7A74" />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() =>
              openSearchResults(query.trim() || "Services")
            }
            placeholder="Search for cleaning, repairs, etc."
            placeholderTextColor="#6C7A74"
            className="h-12 rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-[14px] text-[#161D1A]"
            style={{
              paddingVertical: 0,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 2,
              elevation: 1,
            }}
          />
        </View>

        {/* Safety Guarantee Banner */}
        <View
          className="mb-6 flex-row items-start gap-3 rounded-xl border p-4"
          style={{
            borderColor: "rgba(0,95,176,0.2)",
            backgroundColor: "rgba(0,95,176,0.1)",
            shadowColor: "#005FB0",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.12,
            shadowRadius: 20,
            elevation: 2,
          }}
        >
          <View className="rounded-lg bg-[#005FB0] p-2">
            <MaterialIcons name="verified-user" size={20} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-[18px] font-semibold leading-6 text-[#005FB0]">
              Safety Guarantee
            </Text>
            <Text className="mt-1 text-[12px] font-medium tracking-wide text-[#005FB0]/80">
              Every service is backed by our ₹50k insurance and verified
              experts.
            </Text>
          </View>
        </View>

        {/* Explore Categories */}
        <View className="mb-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-[20px] font-semibold tracking-tight text-[#161D1A]">
              Explore Categories
            </Text>
            <Pressable onPress={() => openSearchResults("Services")}>
              <Text className="text-[12px] font-semibold tracking-wide text-[#005FB0]">
                View All
              </Text>
            </Pressable>
          </View>

          <View
            className="flex-row flex-wrap"
            style={{ columnGap: GRID_GAP, rowGap: GRID_GAP }}
          >
            {serviceCategories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => openServiceCategory(category.title)}
                className="items-center gap-2 rounded-xl border border-slate-100 bg-white p-4"
                style={({ pressed }) => ({
                  width: categoryCardWidth,
                  minHeight: 108,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                  borderColor: pressed ? "#005FB0" : "#F1F5F9",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 2,
                  elevation: 1,
                })}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: category.iconBg }}
                >
                  <MaterialIcons
                    name={category.icon}
                    size={24}
                    color={category.iconColor}
                  />
                </View>
                <Text className="text-center text-[14px] font-medium text-[#161D1A]">
                  {category.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Featured Professionals */}
        <View className="mb-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-[20px] font-semibold tracking-tight text-[#161D1A]">
              Featured Professionals
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/nearby-map-view-bottom-sheet",
                  params: { q: "services near me" },
                })
              }
            >
              <Text className="text-[12px] font-semibold tracking-wide text-[#005FB0]">
                View Map
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 16, paddingRight: 4 }}
          >
            {featuredProfessionals.map((pro) => (
              <Pressable
                key={pro.id}
                onPress={() => router.push("/listing-detail-template")}
                className="w-70 overflow-hidden rounded-xl border border-slate-100 bg-white"
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 2,
                  elevation: 1,
                })}
              >
                {/* Card Image */}
                <View className="relative h-32 overflow-hidden bg-slate-200">
                  <Image
                    source={pro.image}
                    contentFit="cover"
                    transition={200}
                    className="h-full w-full"
                  />

                  {/* Favorite */}
                  <Pressable
                    className="absolute right-3 top-3 rounded-full p-2"
                    style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
                  >
                    <MaterialIcons
                      name="favorite-border"
                      size={18}
                      color="#161D1A"
                    />
                  </Pressable>

                  {/* Top Rated Badge */}
                  {pro.topRated ? (
                    <View className="absolute bottom-3 left-3 rounded bg-[#005FB0] px-2 py-1">
                      <Text className="text-[10px] font-bold uppercase text-white">
                        Top Rated
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Card Info */}
                <View className="gap-2 p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-[18px] font-semibold leading-6 text-[#161D1A]">
                        {pro.name}
                      </Text>
                      <Text className="text-[12px] font-medium tracking-wide text-[#3C4A44]">
                        {pro.subtitle}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-0.5">
                      <MaterialIcons name="star" size={16} color="#005FB0" />
                      <Text className="text-[12px] font-bold text-[#005FB0]">
                        {pro.rating}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <Text className="text-[16px] font-bold text-[#005FB0]">
                      {pro.price}
                    </Text>
                    <Text className="text-[12px] italic text-[#BBCAC3]">
                      {pro.unit}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Season Special Promo Banner */}
        <View
          className="mb-4 overflow-hidden rounded-2xl"
          style={{ aspectRatio: 16 / 9 }}
        >
          <Image
            source={seasonalPromoImage}
            contentFit="cover"
            transition={200}
            className="absolute inset-0 h-full w-full"
          />
          <LinearGradient
            colors={["rgba(0,95,176,0.9)", "rgba(0,95,176,0.4)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className="absolute inset-0 justify-center p-6"
          >
            <Text className="text-[10px] font-bold uppercase tracking-[2px] text-white/80">
              Season Special
            </Text>
            <Text className="mt-1 max-w-45 text-[24px] font-bold leading-8 text-white">
              AC Servicing Starts @ ₹299
            </Text>
            <Pressable
              onPress={() => openSearchResults("AC servicing")}
              className="mt-4 self-start rounded-lg bg-white px-4 py-2"
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.95 : 1 }],
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 4,
              })}
            >
              <Text className="text-[12px] font-bold text-[#005FB0]">
                Book Now
              </Text>
            </Pressable>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* ===== BOTTOM NAVIGATION BAR ===== */}
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
