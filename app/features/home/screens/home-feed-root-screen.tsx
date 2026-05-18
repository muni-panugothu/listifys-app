import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Dimensions,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  HomeCategoryMoreTile,
  HomeCategoryTile,
} from "@/components/home-category-tile";
import { TrendingListingCard } from "@/components/trending-listing-card";
import { CATEGORIES, type CategorySlug } from "@/constants/categories";
import { DUMMY_TRENDING_LISTINGS } from "@/constants/dummy-trending-listings";
import { ListifyFonts, ListifyTypography } from "@/constants/typography";
import { getUnreadCount as getNotificationUnreadCount } from "@/features/auth/services/auth-api";
import { getUnreadCount as getChatUnreadCount } from "@/features/messaging/services/chat-api";
import {
  fetchHomeFeed,
  getCachedHomeFeed,
  getRecentlyViewed,
  toggleSaveListing,
  type FeedResponse,
  type ListingItem,
  type RecentlyViewedItem,
} from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { getCategoryHref } from "@/lib/navigate-to-category";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProfile } from "@/store/slices/auth-slice";
import { clearSlowRequestSignal, reportSlowRequest } from "@/store/slices/network-slice";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2;
const SLOW_HOME_FEED_MS = 3500;
const SELL_BANNER_CAMERA_IMAGE =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=500&q=80";
const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?name=User&background=27BB97&color=fff&size=128";

const GRID_GAP = 10;
const GRID_H_PADDING = 16;
const HOME_GRID_COLS = 4;
const HOME_PREVIEW_COUNT = 7;
const CATEGORY_CARD_SIZE =
  (SCREEN_WIDTH - GRID_H_PADDING * 2 - GRID_GAP * (HOME_GRID_COLS - 1)) /
  HOME_GRID_COLS;

const gridCategories = CATEGORIES.map((c) => ({
  id: c.slug,
  label: c.name,
  icon: c.icon,
}));

const homePreviewCategories = gridCategories.slice(0, HOME_PREVIEW_COUNT);

function buildSavedIds(feedData: FeedResponse | null, userId?: string | null) {
  const ids = new Set<string>();

  if (!feedData?.categories || !userId) {
    return ids;
  }

  for (const category of Object.values(feedData.categories)) {
    for (const listing of category.listings ?? []) {
      if (listing.savedBy?.includes(userId)) {
        ids.add(listing._id);
      }
    }
  }

  return ids;
}

function formatFeedSyncLabel(savedAt: number | null) {
  if (!savedAt) {
    return "Synced recently";
  }

  const diffMs = Math.max(0, Date.now() - savedAt);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Synced just now";
  }

  if (diffMinutes < 60) {
    return `Synced ${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Synced ${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Synced ${diffDays}d ago`;
}

export function HomeFeedRootScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const network = useAppSelector((s) => s.network);
  const [feedData, setFeedData] = useState<FeedResponse | null>(null);
  const [lastFeedSyncAt, setLastFeedSyncAt] = useState<number | null>(null);
  const [isUsingCachedFeed, setIsUsingCachedFeed] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const isOffline = !network.isConnected || network.isInternetReachable === false;

  const applyFeedSnapshot = useCallback(
    (response: FeedResponse, options: { source: "cache" | "live"; savedAt: number }) => {
      setFeedData(response);
      setSavedIds(buildSavedIds(response, user?.id));
      setLastFeedSyncAt(options.savedAt);
      setIsUsingCachedFeed(options.source === "cache");
    },
    [user?.id],
  );

  // Route to the correct detail screen based on category
  const SPECIAL_DETAIL_ROUTES: Record<string, string> = {
    events: "/event-detail",
    properties: "/property-detail",
    jobs: "/job-detail",
    services: "/service-detail",
  };
  const pushToDetail = useCallback((cat: string, id: string) => {
    const specialRoute = SPECIAL_DETAIL_ROUTES[cat];
    if (specialRoute) {
      router.push(`${specialRoute}?id=${id}&category=${cat}` as Href);
    } else {
      router.push(`/listing-detail-template?category=${cat}&id=${id}` as Href);
    }
  }, [router]);

  const pushToListing = useCallback(
    (cat: string) => {
      router.push(getCategoryHref(cat as CategorySlug));
    },
    [router],
  );

  // Flatten all category listings into a single array for recommendations
  const allListings: ListingItem[] = feedData?.categories
    ? Object.values(feedData.categories).flatMap((cat) => cat.listings ?? [])
    : [];

  // Featured services = takecare + services category from feed
  const featuredServices: ListingItem[] = [
    ...(feedData?.categories?.takecare?.listings ?? []),
    ...(feedData?.categories?.services?.listings ?? []),
  ].slice(0, 6);

  const loadFeed = useCallback(async (options?: { allowCacheFallback?: boolean }) => {
    const startedAt = Date.now();

    try {
      const res = await fetchHomeFeed({ limit: 10 });
      const duration = Date.now() - startedAt;

      if (duration >= SLOW_HOME_FEED_MS) {
        dispatch(reportSlowRequest(duration));
      } else {
        dispatch(clearSlowRequestSignal());
      }

      applyFeedSnapshot(res, { source: "live", savedAt: Date.now() });
    } catch {
      const duration = Date.now() - startedAt;

      if (duration >= SLOW_HOME_FEED_MS) {
        dispatch(reportSlowRequest(duration));
      } else {
        dispatch(clearSlowRequestSignal());
      }

      if (options?.allowCacheFallback === false) {
        return;
      }

      const cached = await getCachedHomeFeed();
      if (cached) {
        applyFeedSnapshot(cached.data, { source: "cache", savedAt: cached.savedAt });
      }
    }
  }, [applyFeedSnapshot, dispatch]);

  useEffect(() => {
    (async () => {
      const cached = await getCachedHomeFeed().catch(() => null);
      if (cached) {
        applyFeedSnapshot(cached.data, { source: "cache", savedAt: cached.savedAt });
      }

      await loadFeed({ allowCacheFallback: !cached });
    })().catch(() => {});

    getRecentlyViewed().then(setRecentlyViewed).catch(() => {});
    getNotificationUnreadCount()
      .then((r) => setNotificationUnreadCount(r.unreadCount ?? 0))
      .catch(() => {});
    getChatUnreadCount()
      .then((r) => setChatUnreadCount(r.unreadCount ?? 0))
      .catch(() => {});
  }, [applyFeedSnapshot, loadFeed]);

  useEffect(() => {
    if (!isOffline && isUsingCachedFeed) {
      loadFeed({ allowCacheFallback: false }).catch(() => {});
    }
  }, [isOffline, isUsingCachedFeed, loadFeed]);

  // Refresh recently viewed + unread count when screen is focused
  useFocusEffect(
    useCallback(() => {
      getRecentlyViewed().then(setRecentlyViewed).catch(() => {});
      getNotificationUnreadCount()
        .then((r) => setNotificationUnreadCount(r.unreadCount ?? 0))
        .catch(() => {});
      getChatUnreadCount()
        .then((r) => setChatUnreadCount(r.unreadCount ?? 0))
        .catch(() => {});
    }, []),
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      dispatch(fetchProfile()).unwrap().catch(() => {}),
      loadFeed(),
      getRecentlyViewed().then(setRecentlyViewed).catch(() => {}),
      getNotificationUnreadCount()
        .then((r) => setNotificationUnreadCount(r.unreadCount ?? 0))
        .catch(() => {}),
      getChatUnreadCount()
        .then((r) => setChatUnreadCount(r.unreadCount ?? 0))
        .catch(() => {}),
    ]);
  }, [dispatch, loadFeed]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const handleBottomTabPress = useTabNavigation(() => setShowLoginSheet(true));

  const profileImageUri =
    user?.profileImageUrl ??
    user?.profileImage ??
    user?.googleProfileImage ??
    user?.avatar ??
    DEFAULT_AVATAR;
  const displayName = user?.name?.trim() || "Guest";
  const displayLocation =
    (user as { address?: string } | null)?.address?.trim() || "Mumbai, IN";

  const topBarHeight = insets.top + 80;

  const trendingCardWidth = SCREEN_WIDTH * 0.58;

  const trendingListings = useMemo(() => {
    const fromFeed = allListings.slice(0, 6).map((item) => ({
      id: item._id,
      title: item.title,
      price: item.price ?? null,
      image: item.images?.[0] ?? DUMMY_TRENDING_LISTINGS[0].image,
      category:
        (item as ListingItem & { _source?: string })._source ?? item.category ?? "electronics",
      isDummy: false as const,
    }));

    if (fromFeed.length >= 4) {
      return fromFeed;
    }

    return DUMMY_TRENDING_LISTINGS.map((item) => ({ ...item, isDummy: true as const }));
  }, [allListings]);

  const navigateToCategory = useCallback(
    (catId: CategorySlug) => {
      router.push(getCategoryHref(catId));
    },
    [router],
  );

  const handleToggleSave = useCallback(async (item: ListingItem) => {
    if (isOffline) {
      return;
    }

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
  }, [isOffline]);

  return (
    <View className="flex-1 bg-[#F6F7F8]">
      {/* ===== TOP APP BAR ===== */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-start justify-between bg-[#F6F7F8] px-4"
        style={{
          paddingTop: insets.top + 6,
          height: topBarHeight,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
  <View>
<View className="flex flex-row items-center justify-between w-full" >
<View className="flex flex-row items-center gap-3">
          <View className="relative">
            <Pressable
              onPress={() => handleBottomTabPress("profile")}
              className="h-15 w-15 overflow-hidden rounded-full border-2 border-white"
              style={({ pressed }) => ({
                opacity: pressed ? 0.85 : 1,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              })}
            >
              <Image source={profileImageUri} contentFit="cover" className="h-full w-full" />
            </Pressable>
          </View>

          <View className="pt-0.5 leading-tight">
            <Text className="text-[18px]" style={ListifyTypography.label}>
              Welcome
            </Text>
            <Text
              className=" text-[13px]"
              style={ListifyTypography.name}
              numberOfLines={1}
            >
              {displayName}
            </Text>
          </View>

        </View>

        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={() => router.push("/messages-inbox" as Href)}
            className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-xl"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            })}
          >
            <MaterialIcons name="chat-bubble-outline" size={24} color="#161D1A" />
            {chatUnreadCount > 0 && (
              <View className="absolute -right-0.5 -top-0.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 py-0.5">
                <Text className="text-[10px] font-bold text-white">
                  {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push("/notifications-center" as Href)}
            className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-xl"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            })}
          >
            <MaterialIcons name="notifications-none" size={24} color="#161D1A" />
            {notificationUnreadCount > 0 && (
              <View className="absolute -right-0.5 -top-0.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 py-0.5">
                <Text className="text-[10px] font-bold text-white">
                  {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
</View>

        <Pressable
              onPress={() => router.push("/profile-details-edit" as Href)}
              className="my-1 flex-row items-center gap-1"
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <MaterialIcons name="location-on" size={14} color="#27BB97" />
              <Text
                className="flex-1 text-[12px]"
                style={ListifyTypography.label}
                numberOfLines={1}
              >
                {displayLocation}
              </Text>
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
          paddingTop: topBarHeight + 12,
          paddingBottom: 80 + Math.max(insets.bottom, 16),
        }}
      >
        {(isOffline || isUsingCachedFeed) && (
          <View className="mb-4 px-4">
            <View
              className="rounded-2xl border px-4 py-4"
              style={{
                borderColor: isOffline ? "rgba(16,35,29,0.08)" : "rgba(39,187,151,0.18)",
                backgroundColor: isOffline ? "#ECEEF0" : "#F6F7F8",
              }}
            >
              <View className="flex-row items-start gap-3">
                <View
                  className="h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: isOffline ? "#10231D" : "rgba(39,187,151,0.12)" }}
                >
                  <MaterialIcons
                    name={isOffline ? "cloud-off" : "sync"}
                    size={20}
                    color={isOffline ? "#F8FAFC" : "#1D9477"}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-[#161D1A]">
                    {isOffline
                      ? feedData
                        ? "Offline mode"
                        : "No internet connection"
                      : "Refreshing saved feed"}
                  </Text>
                  <Text className="mt-1 text-[13px] leading-5 text-[#587168]">
                    {isOffline
                      ? feedData
                        ? "You’re browsing the last synced homepage. New activity will appear again once the connection is back."
                        : "Reconnect to load the latest homepage listings and activity."
                      : "Showing your saved homepage while the latest listings are being fetched."}
                  </Text>
                  {lastFeedSyncAt ? (
                    <Text className="mt-2 text-[12px] font-medium text-[#1D9477]">
                      {formatFeedSyncLabel(lastFeedSyncAt)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        )}

        <View className="mb-5 px-4">
          <Text
            className="mb-4 text-[26px] leading-8"
            style={ListifyTypography.heading}
          >
            What are you looking for?
          </Text>

          <Pressable
            onPress={() => router.push("/search-home" as Href)}
            className="mb-5 h-18 flex-row items-center rounded-full border border-[#E8E8E8] bg-white px-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            <MaterialIcons name="search" size={22} color="#B8B8B8" />
            <Text className="ml-3 flex-1 text-[15px]" style={ListifyTypography.label}>
              Search here
            </Text>
          </Pressable>

          <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
            {homePreviewCategories.map((cat) => (
              <HomeCategoryTile
                key={cat.id}
                slug={cat.id}
                label={cat.label}
                icon={cat.icon}
                size={CATEGORY_CARD_SIZE}
                onPress={() => navigateToCategory(cat.id)}
              />
            ))}
            <HomeCategoryMoreTile
              size={CATEGORY_CARD_SIZE}
              onPress={() => handleBottomTabPress("search")}
            />
          </View>
        </View>

        {/* Sell Banner */}
        {/* <View className="mx-4 mb-6">
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
        </View> */}

        {/* Trending listings */}
        <View className="mb-6 mt-5">
          <View className="mb-4 flex-row items-center justify-between px-4">
            <Text className="text-[22px]" style={ListifyTypography.sectionTitle}>
              Trending Listings
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/search-results-entity-tabs",
                  params: { q: "", title: "Trending" },
                } as Href)
              }
            >
              <Text className="text-[12px] font-medium text-[#27BB97]">See all</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
          >
            {trendingListings.map((item) => (
              <TrendingListingCard
                key={item.id}
                id={item.id}
                title={item.title}
                price={item.price}
                image={item.image}
                cardWidth={trendingCardWidth}
                isSaved={savedIds.has(item.id)}
                isOffline={isOffline}
                onPress={() => pushToDetail(item.category, item.id)}
                onToggleSave={() => {
                  if ("isDummy" in item && item.isDummy) return;
                  const listing = allListings.find((l) => l._id === item.id);
                  if (listing) void handleToggleSave(listing);
                }}
              />
            ))}
          </ScrollView>
        </View>

        {/* Featured Services */}
        {featuredServices.length > 0 && (
        <View className="mb-6">
          <View className="mb-4 flex-row items-center justify-between px-4">
            <Text className="text-[20px] tracking-tight" style={ListifyTypography.sectionTitle}>
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
                  style={{ aspectRatio: 3 / 2.5 }}
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
            <Text className="text-[20px] tracking-tight" style={ListifyTypography.sectionTitle}>
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

      {/* Login Required Bottom Sheet */}
      <Modal
        visible={showLoginSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLoginSheet(false)}
      >
        <Pressable
          className="flex-1 bg-black/40"
          onPress={() => setShowLoginSheet(false)}
        />
        <View
          className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-6 pt-6"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <View className="mb-4 self-center h-1 w-10 rounded-full bg-slate-200" />
          <View className="items-center mb-4">
            <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-[rgba(39,187,151,0.1)]">
              <MaterialIcons name="lock-outline" size={32} color="#27BB97" />
            </View>
            <Text className="text-[20px] font-bold text-[#161D1A] mb-1">
              Login Required
            </Text>
            <Text className="text-[14px] text-center text-[#6C7A74] leading-5">
              Please sign in to post your products and start selling on Listify.
            </Text>
          </View>
          <Pressable
            onPress={() => { setShowLoginSheet(false); router.push("/sign-in" as Href); }}
            className="mb-3 h-14 items-center justify-center rounded-2xl bg-[#27BB97]"
          >
            <Text className="text-[16px] font-semibold text-white">
              Sign In
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setShowLoginSheet(false); router.push("/sign-up" as Href); }}
            className="mb-2 h-14 items-center justify-center rounded-2xl border border-[#27BB97]"
          >
            <Text className="text-[16px] font-semibold text-[#27BB97]">
              Create Account
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
