import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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
import { useTabNavigation } from "@/lib/use-tab-navigation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GUTTER = 12;
const GRID_SIDE_PADDING = 16;
const GRID_CELL_WIDTH =
  (SCREEN_WIDTH - GRID_SIDE_PADDING * 2 - GRID_GUTTER) / 2;

type SearchCategory = {
  id: string;
  title: string;
  image: string;
  height: number;
  offsetTop?: number;
};

const initialRecentSearches = [
  "iPhone 15 Pro Max",
  "Studio apartments in South Delhi",
  "UI UX Designer remote",
];

const popularCategories: SearchCategory[] = [
  {
    id: "electronics",
    title: "Electronics",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDKRtow-oWeIMQCgxj2ATd4umi7fmWR04G7ILRQwkoZ8_0ReWf-ChWPEsj6gAbNjsMcWlsXmS6gMpOwWaCC9ZoB3P9AHKoJU3DCAKbmiElkrpdZ6ZZB7shFtOOamP4u0GKVjd71MagV0mLoPJ1vLy-TEFJXxdG2tJq4mqEf4Q_QlPiqMvUu5ezByznNJmSZS6ZKFTYFrNgbO5_SN9O38_Y6ngKu8daVF5TfIPWX4uEJaTgVIKuYGBN0X5DRIeIed6-zeIY_C6a1S3Q",
    height: GRID_CELL_WIDTH,
  },
  {
    id: "properties",
    title: "Properties",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBbW24kPsM9cbWASfSHcqD6hCD3C6ZuHyUzTACrVVwAyhswvUaRAkfcw1WsSA4Dd_ZZ7IbeN3fkRYW2dgWzhGq9PaC27ZghXQ5d9XlQpoDpjzHxf5rB9h243ZgjL_2_w_WqgemFj-tnSSlMraNH2ByioNWVyDP8vY7W9QMO898pP98SqbMukoMmV02tV2ObJIjNKcMcetObHmpzKmXdsMvgd6QnfvOZvOLaL8G1_KFn8J_6CyuKSh5p3uxhY8iX-q1cTsLDM0ZoLi0",
    height: Math.round((GRID_CELL_WIDTH * 3) / 4),
  },
  {
    id: "jobs",
    title: "Jobs",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBS13aRPmBXyQ4xQwBh8WDA18DrWVgZyUL9yubDrIk6yHC920ZZIjvARaMn4yK5e8gcWKMv2mECP3Ht87BRTCGwukva-sHHzgbPvcbUTI4_BGCFdDby2WSFLYPrPz8ji5v-RTOkWgluDRVwJ5z5RjlJi4u1HzkzrTeNKikj7TPMgDEkkEvQdADixtuRy7rptLes7YpE3t240EukcsoRVv86oPZ0xDZU-G489AsouY8WJCRsMC93DUBUulqGe10Tq0tzBIjn030OeLs",
    height: Math.round((GRID_CELL_WIDTH * 3) / 4),
    offsetTop: -40,
  },
  {
    id: "services",
    title: "Services",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDxBZRUkvMzcyKUpl0vMK4qfV4iXAU3q763_0nbiUp7Qesf09ZGlHWRHdhaQ-oHzFbarMXSBbHsMgZVysWcVlP9ZjNAxDGz9KmpjCNhT2yu5xumIn7OydHP8AsvExRtT5AHfOAs5Yt0_XVHlRNE41tGOLSehtjWFPDNSW2jWeOB5x1JzZ__mYKfSHHFzbeFYotI82a26MVxmsHOm8-iFZn6DvZfbDBWVALObcd21xfEHfL4xgTywKjJB3kQnQOw28u0apox-QPq1FM",
    height: GRID_CELL_WIDTH,
    offsetTop: -40,
  },
];

const trendingTags = [
  "Tesla Model 3",
  "PlayStation 5",
  "Furniture",
  "MacBook Air M2",
  "Mountain Bikes",
  "Remote Work",
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function SearchHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState(initialRecentSearches);
  const { refreshing, onRefresh } = usePullToRefresh();

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);

  const openSearchResults = (value?: string) => {
    const text = value?.trim() || query.trim() || "iPhone 13";
    router.push({
      pathname: "/search-results-entity-tabs",
      params: { q: text },
    });
  };

  const handleBottomTabPress = useTabNavigation();

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center border-b border-slate-100 bg-white/90 px-4"
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
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={23} color="#64748B" />
          </Pressable>
        </View>

        <View className="relative flex-1">
          <View className="absolute left-3 top-0 h-10 items-center justify-center">
            <MaterialIcons name="search" size={20} color="#94A3B8" />
          </View>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => openSearchResults()}
            placeholder="Search on Listify..."
            placeholderTextColor="#94A3B8"
            className="h-10 rounded-full bg-slate-50 pl-10 pr-10 text-[14px] text-[#161D1A]"
            style={{ paddingVertical: 0 }}
          />
          <View className="absolute right-3 top-0 h-10 items-center justify-center">
            <Pressable
              onPress={() => setQuery("")}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <MaterialIcons name="cancel" size={20} color="#CBD5E1" />
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
          paddingTop: topBarHeight + 12,
          paddingBottom: 84 + bottomNavPadding,
        }}
      >
        <View className="px-4">
          <View className="mb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-[20px] font-semibold tracking-tight text-[#161D1A]">
                Recent Searches
              </Text>
              <Pressable onPress={() => setRecentSearches([])}>
                <Text className="text-[12px] font-medium text-[#27BB97]">
                  Clear all
                </Text>
              </Pressable>
            </View>

            <View className="gap-1">
              {recentSearches.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => openSearchResults(item)}
                  className="flex-row items-center justify-between py-2"
                >
                  <View className="flex-row items-center gap-3">
                    <MaterialIcons name="history" size={20} color="#94A3B8" />
                    <Text className="text-[14px] text-[#161D1A]">{item}</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      setRecentSearches((prev) =>
                        prev.filter((s) => s !== item),
                      )
                    }
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <MaterialIcons name="close" size={18} color="#CBD5E1" />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mb-8">
            <Text className="mb-4 text-[20px] font-semibold tracking-tight text-[#161D1A]">
              Popular Categories
            </Text>
            <View
              className="flex-row flex-wrap"
              style={{ columnGap: GRID_GUTTER, rowGap: GRID_GUTTER }}
            >
              {popularCategories.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => {
                    if (category.id === "services") {
                      router.push("/services-category-hub");
                      return;
                    }
                    openSearchResults(category.title);
                  }}
                  className="relative overflow-hidden rounded-xl border border-slate-100"
                  style={{
                    width: GRID_CELL_WIDTH,
                    height: category.height,
                    marginTop: category.offsetTop ?? 0,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 3,
                    elevation: 1,
                  }}
                >
                  <Image
                    source={category.image}
                    contentFit="cover"
                    transition={200}
                    className="h-full w-full"
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.62)"]}
                    start={{ x: 0.5, y: 0.2 }}
                    end={{ x: 0.5, y: 1 }}
                    className="absolute inset-0"
                  />
                  <View className="absolute inset-x-0 bottom-0 p-4">
                    <Text className="text-[18px] font-semibold text-white">
                      {category.title}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mb-8">
            <View className="mb-4 flex-row items-center gap-2">
              <MaterialIcons name="trending-up" size={20} color="#27BB97" />
              <Text className="text-[20px] font-semibold tracking-tight text-[#161D1A]">
                Trending Now
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {trendingTags.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => openSearchResults(tag)}
                  className="rounded-full border border-slate-100 bg-white px-4 py-2"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                >
                  <Text className="text-[14px] text-[#161D1A]">{tag}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <LinearGradient
            colors={["#27BB97", "#1E9E7E"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className="relative overflow-hidden rounded-2xl p-6"
          >
            <View className="gap-2">
              <View className="self-start rounded bg-white/20 px-2 py-1">
                <Text className="text-[10px] font-bold uppercase tracking-[1px] text-white">
                  New Feature
                </Text>
              </View>
              <Text className="text-[24px] font-bold leading-8 text-white">
                Sell faster with AI
              </Text>
              <Text className="max-w-52.5 text-[14px] text-white/90">
                Let our AI write the perfect listing description for you.
              </Text>
              <Pressable className="mt-4 self-start rounded-lg bg-white px-6 py-2">
                <Text className="text-[14px] font-bold text-[#27BB97]">
                  Try it now
                </Text>
              </Pressable>
            </View>
            <View className="absolute -bottom-6 -right-5 opacity-20">
              <MaterialIcons name="auto-awesome" size={140} color="#FFFFFF" />
            </View>
          </LinearGradient>
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
