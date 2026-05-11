import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchCategoryListings,
  toggleSaveListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { useAppSelector } from "@/store/hooks";

const CONTAINER_PADDING = 16;
const GRID_GAP = 12;
const CATEGORY_SLUG = "properties" as const;

const filterChips = ["BHK", "Budget", "Furnishing", "Amenities"];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

function formatPrice(price?: number): string {
  if (!price) return "";
  if (price >= 10000000) return `\u20B9${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `\u20B9${(price / 100000).toFixed(2)} L`;
  return `\u20B9${price.toLocaleString("en-IN")}`;
}

export function PropertiesListingScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((s) => s.auth.user);
  const [listingType, setListingType] = useState<"buy" | "rent">("buy");
  const [properties, setProperties] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const columns = screenWidth >= 768 ? 2 : 1;
  const regularCardWidth = useMemo(() => {
    if (columns === 1) return screenWidth - CONTAINER_PADDING * 2;
    return (screenWidth - CONTAINER_PADDING * 2 - GRID_GAP) / 2;
  }, [columns, screenWidth]);

  const loadListings = useCallback(async () => {
    try {
      const subcategory = listingType === "rent" ? "Rentals" : "Properties";
      const res = await fetchCategoryListings(CATEGORY_SLUG, {
        limit: 20,
        subcategory,
      });
      if (res.listings) setProperties(res.listings);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [listingType]);

  useEffect(() => {
    setLoading(true);
    loadListings();
  }, [loadListings]);

  const { refreshing, onRefresh } = usePullToRefresh(loadListings);

  const handleToggleSave = useCallback(
    async (item: ListingItem) => {
      try {
        const res = await toggleSaveListing(CATEGORY_SLUG, item._id);
        setProperties((prev) =>
          prev.map((p) =>
            p._id === item._id
              ? {
                  ...p,
                  savedBy: res.saved
                    ? [...(p.savedBy ?? []), user?.id ?? ""]
                    : (p.savedBy ?? []).filter((id) => id !== user?.id),
                }
              : p,
          ),
        );
      } catch {}
    },
    [user?.id],
  );

  // First listing is featured
  const featured = properties.length > 0 ? properties[0] : null;
  const regular = properties.slice(1);

  const handleBottomTabPress = useTabNavigation();

  const isSaved = (item: ListingItem) =>
    user?.id ? (item.savedBy ?? []).includes(user.id) : false;

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
              backgroundColor: listingType === "buy" ? "#FFFFFF" : "transparent",
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
              backgroundColor: listingType === "rent" ? "#FFFFFF" : "transparent",
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

        {loading ? (
          <View className="items-center py-20">
            <ActivityIndicator size="large" color="#27BB97" />
          </View>
        ) : properties.length === 0 ? (
          <View className="items-center py-20">
            <MaterialIcons name="apartment" size={48} color="#CBD5E1" />
            <Text className="mt-2 text-[14px] text-[#6C7A74]">No properties found</Text>
          </View>
        ) : (
          <View
            className="flex-row flex-wrap"
            style={{ rowGap: GRID_GAP, columnGap: GRID_GAP }}
          >
            {featured ? (
              <Pressable
                onPress={() =>
                  router.push(
                    `/property-detail?id=${featured._id}&category=properties` as Href,
                  )
                }
                className="overflow-hidden rounded-xl border border-slate-100 bg-white"
                style={{ width: screenWidth - CONTAINER_PADDING * 2 }}
              >
                <View
                  style={{ height: columns === 1 ? 240 : 320 }}
                  className="relative w-full"
                >
                  {featured.images?.[0] ? (
                    <Image
                      source={featured.images[0]}
                      contentFit="cover"
                      transition={200}
                      className="h-full w-full"
                    />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-[#E9EFEB]">
                      <MaterialIcons name="apartment" size={48} color="#CBD5E1" />
                    </View>
                  )}

                  <View className="absolute right-4 top-4">
                    <Pressable
                      onPress={() => handleToggleSave(featured)}
                      className="rounded-full bg-white/70 p-2"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <MaterialIcons
                        name={isSaved(featured) ? "favorite" : "favorite-border"}
                        size={20}
                        color={isSaved(featured) ? "#EF4444" : "#161D1A"}
                      />
                    </Pressable>
                  </View>

                  {featured.status === "premium" ? (
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
                        <MaterialIcons name="location-on" size={16} color="#6C7A74" />
                        <Text className="text-[14px] text-[#6C7A74]">
                          {featured.location}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text className="text-[20px] font-bold text-[#006B55]">
                        {formatPrice(featured.price)}
                      </Text>
                      {(featured as any).squareFeet && featured.price ? (
                        <Text className="text-[12px] text-[#6C7A74]">
                          {`\u20B9${Math.round(featured.price / (featured as any).squareFeet).toLocaleString("en-IN")}/sq.ft`}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View className="mt-2 flex-row gap-4 border-t border-slate-100 pt-3">
                    <View className="flex-row items-center gap-1">
                      <MaterialIcons name="bed" size={20} color="#6C7A74" />
                      <Text className="text-[12px] text-[#6C7A74]">
                        {featured.bedrooms ?? 0} BHK
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-1">
                      <MaterialIcons name="square-foot" size={20} color="#6C7A74" />
                      <Text className="text-[12px] text-[#6C7A74]">
                        {(featured as any).squareFeet
                          ? `${Number((featured as any).squareFeet).toLocaleString()} sq.ft`
                          : "\u2014"}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-1">
                      <MaterialIcons name="bathtub" size={20} color="#6C7A74" />
                      <Text className="text-[12px] text-[#6C7A74]">
                        {featured.bathrooms ?? 0} Bath
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ) : null}

            {regular.map((item) => (
              <Pressable
                key={item._id}
                onPress={() =>
                  router.push(
                    `/property-detail?id=${item._id}&category=properties` as Href,
                  )
                }
                className="overflow-hidden rounded-xl border border-slate-100 bg-white"
                style={{ width: regularCardWidth }}
              >
                <View className="relative h-45 w-full">
                  {item.images?.[0] ? (
                    <Image
                      source={item.images[0]}
                      contentFit="cover"
                      transition={200}
                      className="h-full w-full"
                    />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-[#E9EFEB]">
                      <MaterialIcons name="apartment" size={32} color="#CBD5E1" />
                    </View>
                  )}

                  <Pressable
                    onPress={() => handleToggleSave(item)}
                    className="absolute right-3 top-3 rounded-full bg-white/70 p-1.5"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <MaterialIcons
                      name={isSaved(item) ? "favorite" : "favorite-border"}
                      size={18}
                      color={isSaved(item) ? "#EF4444" : "#161D1A"}
                    />
                  </Pressable>
                </View>

                <View className="p-4">
                  <Text className="mb-1 text-[16px] font-bold text-[#006B55]">
                    {formatPrice(item.price)}
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
                        {item.bedrooms ?? 0} BHK
                      </Text>
                      <Text className="text-[12px] text-slate-300">{"\u2022"}</Text>
                      <Text className="text-[12px] text-[#6C7A74]">
                        {(item as any).squareFeet
                          ? `${Number((item as any).squareFeet).toLocaleString()} sq.ft`
                          : "\u2014"}
                      </Text>
                    </View>
                    <MaterialIcons name="verified" size={18} color="#6C7A74" />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
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
