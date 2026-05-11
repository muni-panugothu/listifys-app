import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATEGORY_MAP, type CategorySlug } from "@/constants/categories";
import {
  fetchCategoryListings,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { Image } from "@/lib/nativewind-interop";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTabNavigation } from "@/lib/use-tab-navigation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GUTTER = 12;
const GRID_SIDE_PADDING = 16;
const PRODUCT_CARD_WIDTH =
  (SCREEN_WIDTH - GRID_SIDE_PADDING * 2 - GRID_GUTTER) / 2;

type ProductItem = {
  id: string;
  title: string;
  price: string;
  location: string;
  timeAgo: string;
  image: string;
  premium?: boolean;
};
const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function CategoryListingTemplateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const categorySlug = (params.category ?? "electronics") as CategorySlug;
  const categoryConfig = CATEGORY_MAP[categorySlug];
  const categoryName = categoryConfig?.name ?? "Electronics";
  const subcategories = ["All", ...(categoryConfig?.subcategories ?? [])];

  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);

  const handleBottomTabPress = useTabNavigation();

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCategoryListings(categorySlug, {
        subcategory: selectedSubcategory === "All" ? undefined : selectedSubcategory,
      });
      setListings(res.listings ?? []);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [categorySlug, selectedSubcategory]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const handleRefresh = useCallback(async () => {
    try {
      const res = await fetchCategoryListings(categorySlug, {
        subcategory: selectedSubcategory === "All" ? undefined : selectedSubcategory,
      });
      setListings(res.listings ?? []);
    } catch {
      // keep existing
    }
  }, [categorySlug, selectedSubcategory]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const displayProducts: ProductItem[] = listings.map((item) => ({
    id: item._id,
    title: item.title,
    price: item.price ? `₹${Number(item.price).toLocaleString("en-IN")}` : "Price on request",
    location: item.location ?? "",
    timeAgo: "",
    image: item.images?.[0] ?? "",
    premium: false,
  }));

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
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={22} color="#0F172A" />
          </Pressable>
          <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
            {categoryName}
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full"
            onPress={() => router.push("/search-home")}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="search" size={22} color="#0F172A" />
          </Pressable>
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons
              name="notifications-none"
              size={22}
              color="#0F172A"
            />
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
          paddingTop: topBarHeight + 8,
          paddingBottom: 84 + bottomNavPadding,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 8,
            paddingVertical: 8,
          }}
        >
          {subcategories.map((chip) => {
            const isActive = chip === selectedSubcategory;
            return (
              <Pressable
                key={chip}
                onPress={() => setSelectedSubcategory(chip)}
                className="rounded-full px-4 py-2"
                style={{
                  backgroundColor: isActive ? "#27BB97" : "#E9EFEB",
                  shadowColor: isActive ? "#27BB97" : "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isActive ? 0.22 : 0.04,
                  shadowRadius: 2,
                  elevation: isActive ? 2 : 1,
                }}
              >
                <Text
                  className="text-[12px] font-medium"
                  style={{ color: isActive ? "#FFFFFF" : "#3C4A44" }}
                >
                  {chip}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="flex-row items-center justify-between px-4 py-4">
          <Pressable
            className="flex-row items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-1.5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <MaterialIcons name="tune" size={18} color="#161D1A" />
            <Text className="text-[12px] font-medium text-[#161D1A]">
              Filters
            </Text>
            <View className="h-4 w-4 items-center justify-center rounded-full bg-[#27BB97]">
              <Text className="text-[10px] font-semibold text-white">2</Text>
            </View>
          </Pressable>

          <Pressable
            className="flex-row items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-1.5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <Text className="text-[12px] font-medium text-slate-500">
              Sort:
            </Text>
            <Text className="text-[12px] font-semibold text-[#161D1A]">
              Recommended
            </Text>
            <MaterialIcons
              name="keyboard-arrow-down"
              size={18}
              color="#161D1A"
            />
          </Pressable>
        </View>

        <View
          className="flex-row flex-wrap px-4"
          style={{ columnGap: GRID_GUTTER, rowGap: GRID_GUTTER }}
        >
          {loading ? (
            <View className="w-full items-center py-16">
              <ActivityIndicator size="large" color="#27BB97" />
              <Text className="mt-3 text-[14px] text-[#6C7A74]">Loading listings...</Text>
            </View>
          ) : displayProducts.length === 0 ? (
            <View className="w-full items-center py-16">
              <MaterialIcons name="inventory-2" size={56} color="#CBD5E1" />
              <Text className="mt-3 text-[16px] font-semibold text-[#161D1A]">
                No listings yet
              </Text>
              <Text className="mt-1 text-center text-[13px] text-[#6C7A74]">
                Be the first to post in {categoryName}!
              </Text>
            </View>
          ) : (
          displayProducts.map((product) => (
            <Pressable
              key={product.id}
              onPress={() => router.push(`/listing-detail-template?category=${categorySlug}&id=${product.id}` as Href)}
              className="overflow-hidden rounded-xl border border-slate-100 bg-white"
              style={{
                width: PRODUCT_CARD_WIDTH,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View
                style={{
                  width: PRODUCT_CARD_WIDTH,
                  height: PRODUCT_CARD_WIDTH,
                }}
              >
                <Image
                  source={product.image}
                  contentFit="cover"
                  transition={200}
                  className="h-full w-full"
                />

                <Pressable className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/80">
                  <MaterialIcons
                    name="favorite-border"
                    size={20}
                    color="#0F172A"
                  />
                </Pressable>

                {product.premium ? (
                  <View className="absolute bottom-2 left-2 rounded-md bg-white/80 px-2 py-1">
                    <Text className="text-[10px] font-bold text-[#0F172A]">
                      PREMIUM
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="gap-1 p-3">
                <Text className="text-[16px] font-bold text-[#27BB97]">
                  {product.price}
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-[14px] font-semibold leading-4 text-[#161D1A]"
                >
                  {product.title}
                </Text>
                <View className="mt-1 flex-row items-center gap-1">
                  <MaterialIcons name="location-on" size={14} color="#64748B" />
                  <Text className="text-[10px] font-medium uppercase text-slate-500">
                    {product.location}
                  </Text>
                </View>
                <Text className="text-[10px] font-medium text-slate-400">
                  {product.timeAgo}
                </Text>
              </View>
            </Pressable>
          ))
          )}
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
