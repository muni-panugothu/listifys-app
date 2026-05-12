import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useState } from "react";
import {
    Dimensions,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATEGORIES } from "@/constants/categories";
import { getUnreadCount } from "@/features/auth/services/auth-api";
import {
  fetchHomeFeed,
  getRecentlyViewed,
  toggleSaveListing,
  type FeedResponse,
  type ListingItem,
  type RecentlyViewedItem,
} from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProfile } from "@/store/slices/auth-slice";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2;
const SELL_BANNER_CAMERA_IMAGE =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=500&q=80";

// Category images — real product photos for each category
const CATEGORY_IMAGES: Record<string, string> = {
  all: "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=120&h=120&fit=crop&q=80",
  electronics: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=120&h=120&fit=crop&q=80",
  jobs: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=120&h=120&fit=crop&q=80",
  vehicles: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=120&h=120&fit=crop&q=80",
  takecare: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=120&h=120&fit=crop&q=80",
  events: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=120&h=120&fit=crop&q=80",
  properties: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=120&h=120&fit=crop&q=80",
  forsale: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=120&h=120&fit=crop&q=80",
  mobiles: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=120&h=120&fit=crop&q=80",
  furniture: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=120&h=120&fit=crop&q=80",
  fashion: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=120&h=120&fit=crop&q=80",
  sports: "https://images.unsplash.com/photo-1461896836934-bd45ba48bf1d?w=120&h=120&fit=crop&q=80",
  collectibles: "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=120&h=120&fit=crop&q=80",
  pets: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=120&h=120&fit=crop&q=80",
  books: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=120&h=120&fit=crop&q=80",
  beauty: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=120&h=120&fit=crop&q=80",
  others: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=120&h=120&fit=crop&q=80",
  toys: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=120&h=120&fit=crop&q=80",
};

const CAT_ITEM_SIZE = 45;

const categories = [
  { id: "all", label: "All", icon: "grid-view" as const },
  ...CATEGORIES.map((c) => ({ id: c.slug, label: c.name, icon: c.icon })),
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
  const user = useAppSelector((s) => s.auth.user);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [feedData, setFeedData] = useState<FeedResponse | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Route to the correct detail screen based on category
  const SPECIAL_DETAIL_ROUTES: Record<string, string> = {
    events: "/event-detail",
    properties: "/property-detail",
    jobs: "/job-detail",
    services: "/service-detail",
  };
  const SPECIAL_LISTING_ROUTES: Record<string, string> = {
    events: "/events-listing",
    properties: "/properties-listing",
    jobs: "/jobs-listing",
    services: "/services-category-hub",
  };

  const pushToDetail = useCallback((cat: string, id: string) => {
    const specialRoute = SPECIAL_DETAIL_ROUTES[cat];
    if (specialRoute) {
      router.push(`${specialRoute}?id=${id}&category=${cat}` as Href);
    } else {
      router.push(`/listing-detail-template?category=${cat}&id=${id}` as Href);
    }
  }, [router]);

  const pushToListing = useCallback((cat: string) => {
    const specialRoute = SPECIAL_LISTING_ROUTES[cat];
    if (specialRoute) {
      router.push(specialRoute as Href);
    } else {
      router.push(`/category-listing-template?category=${cat}` as Href);
    }
  }, [router]);

  // Flatten all category listings into a single array for recommendations
  const allListings: ListingItem[] = feedData?.categories
    ? Object.values(feedData.categories).flatMap((cat) => cat.listings ?? [])
    : [];

  // Featured services = takecare + services category from feed
  const featuredServices: ListingItem[] = [
    ...(feedData?.categories?.takecare?.listings ?? []),
    ...(feedData?.categories?.services?.listings ?? []),
  ].slice(0, 6);

  const loadFeed = useCallback(async () => {
    try {
      const res = await fetchHomeFeed({ limit: 10 });
      setFeedData(res);
      // Build saved set from all listings
      const ids = new Set<string>();
      if (res.categories && user?.id) {
        for (const cat of Object.values(res.categories)) {
          for (const l of cat.listings ?? []) {
            if (l.savedBy?.includes(user.id)) ids.add(l._id);
          }
        }
      }
      setSavedIds(ids);
    } catch {
      // keep existing data on error
    }
  }, [user?.id]);

  useEffect(() => {
    loadFeed();
    getRecentlyViewed().then(setRecentlyViewed).catch(() => {});
    getUnreadCount().then((r) => setUnreadCount(r.unreadCount ?? 0)).catch(() => {});
  }, [loadFeed]);

  // Refresh recently viewed + unread count when screen is focused
  useFocusEffect(
    useCallback(() => {
      getRecentlyViewed().then(setRecentlyViewed).catch(() => {});
      getUnreadCount().then((r) => setUnreadCount(r.unreadCount ?? 0)).catch(() => {});
    }, []),
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      dispatch(fetchProfile()).unwrap().catch(() => {}),
      loadFeed(),
      getRecentlyViewed().then(setRecentlyViewed).catch(() => {}),
      getUnreadCount().then((r) => setUnreadCount(r.unreadCount ?? 0)).catch(() => {}),
    ]);
  }, [dispatch, loadFeed]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const handleBottomTabPress = useTabNavigation();

  const handleToggleSave = useCallback(async (item: ListingItem) => {
    try {
      const category = (item as any)._source ?? item.category ?? "electronics";
      const res = await toggleSaveListing(category, item._id);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (res.saved) next.add(item._id);
        else next.delete(item._id);
        return next;
      });
    } catch {
      // silently fail
    }
  }, []);

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
          onPress={() => router.push("/notifications-center")}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <MaterialIcons name="notifications-none" size={24} color="#161D1A" />
          {unreadCount > 0 && (
            <View className="absolute -top-0.5 right-0.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 py-0.5">
              <Text className="text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
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
        <Pressable
          onPress={() => router.push("/search-home")}
          className="mb-4 flex-row items-center gap-2 px-4"
        >
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
            <Text className="ml-2 flex-1 text-[14px] leading-5 text-[#94A3B8]">
              Search product, category...
            </Text>
          </View>
          <View
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
          </View>
        </Pressable>

        {/* Two-Row Category Grid */}
        <View className="mb-6">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {(() => {
              // Split categories into pairs for two rows
              const pairs: (typeof categories[0])[][] = [];
              for (let i = 0; i < categories.length; i += 2) {
                pairs.push(categories.slice(i, i + 2));
              }
              return pairs.map((pair, colIdx) => (
                <View key={colIdx} style={{ gap: 12 }}>
                  {pair.map((cat) => {
                    const isActive = selectedCategory === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => {
                          setSelectedCategory(cat.id);
                          if (cat.id === "all") return;
                          if (cat.id === "services") {
                            router.push("/services-category-hub");
                            return;
                          }
                          if (cat.id === "properties") {
                            router.push("/properties-listing");
                            return;
                          }
                          if (cat.id === "jobs") {
                            router.push("/jobs-listing");
                            return;
                          }
                          if (cat.id === "events") {
                            router.push("/events-listing");
                            return;
                          }
                          router.push(`/category-listing-template?category=${cat.id}` as Href);
                        }}
                        className="items-center"
                        style={{ width: CAT_ITEM_SIZE }}
                      >
                        <View
                          className="items-center justify-center rounded-2xl"
                          style={[
                            {
                              width: CAT_ITEM_SIZE,
                              height: CAT_ITEM_SIZE,
                              overflow: "hidden",
                            },
                            isActive
                              ? {
                                  backgroundColor: "#DFF7EE",
                                  borderWidth: 2,
                                  borderColor: "#27BB97",
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
                                },
                          ]}
                        >
                          <Image
                            source={CATEGORY_IMAGES[cat.id] ?? CATEGORY_IMAGES.all}
                            contentFit="cover"
                            transition={200}
                            style={{ width: CAT_ITEM_SIZE, height: CAT_ITEM_SIZE, borderRadius: 14 }}
                          />
                        </View>
                        <Text
                          className="mt-1 text-center text-[11px] font-medium"
                          style={{
                            color: isActive ? "#161D1A" : "#64748B",
                            letterSpacing: 0.3,
                          }}
                          numberOfLines={1}
                        >
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ));
            })()}
          </ScrollView>
        </View>

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
            <Pressable onPress={() => router.push("/search-results-entity-tabs?q=" as Href)}>
              <Text className="text-[12px] font-medium text-[#27BB97]">
                See all
              </Text>
            </Pressable>
          </View>

          {allListings.length === 0 ? (
            <View className="items-center py-10">
              <MaterialIcons name="inventory-2" size={48} color="#CBD5E1" />
              <Text className="mt-2 text-[14px] text-[#6C7A74]">No listings yet. Be the first to post!</Text>
            </View>
          ) : (
          <View className="flex-row flex-wrap justify-between" style={{ gap: 12 }}>
            {allListings.slice(0, 4).map((item) => (
              <Pressable
                key={item._id}
                onPress={() => pushToDetail((item as any)._source ?? item.category, item._id)}
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
                  {item.images?.[0] ? (
                  <Image
                    source={item.images[0]}
                    contentFit="cover"
                    transition={200}
                    className="h-full w-full"
                  />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-slate-100">
                      <MaterialIcons name="image" size={32} color="#CBD5E1" />
                    </View>
                  )}
                  {/* Trusted Badge */}
                  <View className="absolute left-2 top-2 flex-row items-center gap-1 rounded-full bg-white/90 px-2 py-0.5">
                    <MaterialIcons name="verified" size={13} color="#27BB97" />
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-[#161D1A]">
                      Trusted
                    </Text>
                  </View>
                  {/* Favorite Button */}
                  <Pressable
                    onPress={() => handleToggleSave(item)}
                    className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/70"
                  >
                    <MaterialIcons
                      name={savedIds.has(item._id) ? "favorite" : "favorite-border"}
                      size={18}
                      color={savedIds.has(item._id) ? "#EF4444" : "#161D1A"}
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
                    {item.price ? `₹${Number(item.price).toLocaleString("en-IN")}` : "Price on request"}
                  </Text>
                  {item.location ? (
                  <View className="flex-row items-center gap-1">
                    <MaterialIcons name="location-on" size={13} color="#94A3B8" />
                    <Text className="text-[10px] font-medium text-[#94A3B8]">
                      {item.location}
                    </Text>
                  </View>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
          )}
        </View>

        {/* Featured Services */}
        {featuredServices.length > 0 && (
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
                key={item._id}
                onPress={() => pushToDetail((item as any)._source ?? item.category, item._id)}
                className="w-48"
              >
                <View
                  className="mb-2 overflow-hidden rounded-xl"
                  style={{ aspectRatio: 4 / 3 }}
                >
                  {item.images?.[0] ? (
                    <Image
                      source={item.images[0]}
                      contentFit="cover"
                      transition={200}
                      className="h-full w-full"
                    />
                  ) : (
                    <View className="h-full w-full items-center justify-center rounded-xl bg-slate-100">
                      <MaterialIcons name="image" size={28} color="#CBD5E1" />
                    </View>
                  )}
                </View>
                <Text
                  className="text-[14px] leading-5 text-[#161D1A]"
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <Text className="text-[16px] font-bold text-[#27BB97]">
                  {item.price ? `₹${Number(item.price).toLocaleString("en-IN")}` : "Price on request"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        )}

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
        <View className="mb-6">
          <View className="mb-4 flex-row items-center justify-between px-4">
            <Text className="text-[20px] font-semibold tracking-tight text-[#161D1A]">
              Recently Viewed
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {recentlyViewed.slice(0, 10).map((item) => (
              <Pressable
                key={item._id}
                onPress={() => pushToDetail(item.category, item._id)}
                className="w-40"
              >
                <View
                  className="mb-2 overflow-hidden rounded-xl"
                  style={{ aspectRatio: 4 / 3 }}
                >
                  {item.images?.[0] ? (
                  <Image
                    source={item.images[0]}
                    contentFit="cover"
                    transition={200}
                    className="h-full w-full"
                  />
                  ) : (
                    <View className="h-full w-full items-center justify-center rounded-xl bg-slate-100">
                      <MaterialIcons name="image" size={28} color="#CBD5E1" />
                    </View>
                  )}
                </View>
                <Text
                  className="text-[14px] leading-5 text-[#161D1A]"
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text className="text-[16px] font-bold text-[#27BB97]">
                  {item.price ? `₹${Number(item.price).toLocaleString("en-IN")}` : "N/A"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        )}

        {/* Per-Category Sections */}
        {feedData?.categories &&
          Object.entries(feedData.categories)
            .filter(([, cat]) => cat.listings?.length > 0)
            .slice(0, 5)
            .map(([key, cat]) => {
              const config = CATEGORIES.find((c) => c.slug === key);
              if (!config) return null;
              return (
                <View key={key} className="mb-6">
                  <View className="mb-4 flex-row items-center justify-between px-4">
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name={config.icon} size={20} color="#27BB97" />
                      <Text className="text-[18px] font-semibold tracking-tight text-[#161D1A]">
                        {config.name}
                      </Text>
                      <View className="rounded-full bg-[rgba(39,187,151,0.1)] px-2 py-0.5">
                        <Text className="text-[10px] font-bold text-[#27BB97]">
                          {cat.count}
                        </Text>
                      </View>
                    </View>
                    <Pressable onPress={() => pushToListing(key)}>
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
                    {cat.listings.slice(0, 8).map((item) => (
                      <Pressable
                        key={item._id}
                        onPress={() => pushToDetail((item as any)._source ?? item.category, item._id)}
                        className="w-44 overflow-hidden rounded-xl border border-slate-100 bg-white"
                        style={{
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                        }}
                      >
                        <View style={{ width: 176, height: 132 }}>
                          {item.images?.[0] ? (
                            <Image
                              source={item.images[0]}
                              contentFit="cover"
                              transition={200}
                              className="h-full w-full"
                            />
                          ) : (
                            <View className="h-full w-full items-center justify-center bg-slate-100">
                              <MaterialIcons name="image" size={28} color="#CBD5E1" />
                            </View>
                          )}
                        </View>
                        <View className="p-2.5">
                          <Text numberOfLines={1} className="text-[13px] font-semibold text-[#161D1A]">
                            {item.title}
                          </Text>
                          <Text className="text-[15px] font-bold text-[#27BB97]">
                            {item.price ? `₹${Number(item.price).toLocaleString("en-IN")}` : "N/A"}
                          </Text>
                          {item.location ? (
                            <View className="mt-0.5 flex-row items-center gap-1">
                              <MaterialIcons name="location-on" size={11} color="#94A3B8" />
                              <Text className="text-[10px] text-[#94A3B8]" numberOfLines={1}>
                                {item.location}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              );
            })}
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
