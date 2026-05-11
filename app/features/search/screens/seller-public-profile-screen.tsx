import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "@/lib/safe-router";
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
  requestJson,
  resolveAbsoluteMediaUrl,
} from "@/features/auth/services/auth-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";

// ── Types ────────────────────────────────────────────────────────────────────

type SellerProfile = {
  id: string;
  _id: string;
  name: string;
  email?: string;
  profileImageUrl: string | null;
  provider?: string;
  createdAt: string;
  isFollowedByCurrentUser: boolean;
  followersCount: number;
  followingCount: number;
  listingsCount: number;
};

type SellerListing = {
  _id: string;
  title: string;
  price?: number;
  images: string[];
  location?: string;
  condition?: string;
  category?: string;
  subcategory?: string;
  _listingType: string;
  createdAt?: string;
};

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchSellerProfile(sellerId: string): Promise<SellerProfile> {
  const res = await requestJson<{ seller: SellerProfile }>(
    `/api/auth/seller/${sellerId}`,
  );
  return res.seller;
}

async function fetchSellerListings(sellerId: string): Promise<SellerListing[]> {
  const res = await requestJson<{ listings: SellerListing[] }>(
    `/api/auth/seller/${sellerId}/listings`,
  );
  return (res.listings ?? []).map((l) => ({
    ...l,
    images: (l.images ?? []).map(
      (img) => resolveAbsoluteMediaUrl(img) ?? img,
    ),
  }));
}

async function toggleFollowSeller(
  sellerId: string,
): Promise<{ isFollowing: boolean; followersCount: number }> {
  return requestJson(`/api/auth/follow/${sellerId}`, { method: "POST" });
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_COVER =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDieOcT68a3pkiyCzXQEpMRO5s3IqzQqlMEkLxYJVcK1hDaT2R3IoV5US6JPwoRd0wuuwyTh5mTeaHfgf5jp-MO5pP69JauU2w5SoHConLSJJMRiYyFT-6B-BCITtsBR__EA_CI4vDEcSLxT40Fu2Zk6Sy55DLONg_tk-OF9ZB1nP1xIVj0xJ4mniLFtDrR-bnXnfwrMxYDxyhs_GfJrjsdEROcRr3_VKffXr-sZluQlca9hMupn70otULVsTB2RJ6OSONsl26NA0g";

const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?name=Seller&background=27BB97&color=fff&size=128";

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const, active: true },
];

function HalfCard({
  item,
  width,
  onPress,
}: {
  item: SellerListing;
  width: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
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
            {item.price
              ? `₹${Number(item.price).toLocaleString("en-IN")}`
              : "Price on request"}
          </Text>
          {item.condition ? (
            <Text className="text-[10px] font-medium text-[#6c7a74]">
              {item.condition}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function SellerPublicProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ sellerId?: string; userId?: string }>();
  const sellerId = params.sellerId ?? params.userId ?? "";

  const topBarHeight = insets.top + 64;
  const halfCardWidth = useMemo(
    () => (screenWidth - 16 * 2 - 12) / 2,
    [screenWidth],
  );

  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    try {
      const [profileRes, listingsRes] = await Promise.all([
        fetchSellerProfile(sellerId),
        fetchSellerListings(sellerId),
      ]);
      setSeller(profileRes);
      setListings(listingsRes);
      setFollowing(profileRes.isFollowedByCurrentUser);
      setFollowersCount(profileRes.followersCount);
    } catch {
      // keep existing data
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const handleToggleFollow = useCallback(async () => {
    if (!sellerId) return;
    try {
      const res = await toggleFollowSeller(sellerId);
      setFollowing(res.isFollowing);
      setFollowersCount(res.followersCount);
    } catch {
      // silently fail
    }
  }, [sellerId]);

  const handleBottomTabPress = useTabNavigation();

  const navigateToListing = useCallback(
    (item: SellerListing) => {
      const cat = item._listingType ?? item.category ?? "electronics";
      router.push(
        `/listing-detail-template?category=${cat}&id=${item._id}` as Href,
      );
    },
    [router],
  );

  // Split listings into layout groups
  const featured = listings.length > 2 ? listings[2] : null;
  const firstRow = listings.slice(0, 2);
  const remainingAfterFeatured = listings.slice(3);

  const avatarUri =
    (seller?.profileImageUrl
      ? resolveAbsoluteMediaUrl(seller.profileImageUrl) ?? seller.profileImageUrl
      : null) ?? DEFAULT_AVATAR;

  const displayName = seller?.name ?? "Seller";
  const memberSince = seller?.createdAt
    ? new Date(seller.createdAt).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : "";

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
        {loading ? (
          <View className="items-center py-32">
            <ActivityIndicator size="large" color="#27BB97" />
            <Text className="mt-3 text-[14px] text-[#6C7A74]">
              Loading seller profile...
            </Text>
          </View>
        ) : (
          <>
        <View>
          <View className="h-40 w-full overflow-hidden">
            <Image
              source={DEFAULT_COVER}
              contentFit="cover"
              transition={200}
              className="h-full w-full"
            />
          </View>

          <View className="-mt-12 px-4">
            <View className="h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-white">
              <Image
                source={avatarUri}
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
                {displayName}
              </Text>
              {seller?.email ? (
                <Text className="mt-1 text-[13px] font-medium text-[#6c7a74]">
                  {seller.email}
                </Text>
              ) : null}
              {memberSince ? (
                <Text className="mt-0.5 text-[12px] font-medium text-[#6c7a74]">
                  Member since {memberSince}
                </Text>
              ) : null}
            </View>

            <View className="mt-4 flex-row gap-6 border-y border-[#dde4df]/70 py-2">
              <View>
                <Text className="text-[18px] font-semibold text-[#161D1A]">
                  {seller?.listingsCount ?? 0}
                </Text>
                <Text className="text-[12px] font-medium text-[#6c7a74]">
                  Listings
                </Text>
              </View>
              <View>
                <Text className="text-[18px] font-semibold text-[#161D1A]">
                  {followersCount}
                </Text>
                <Text className="text-[12px] font-medium text-[#6c7a74]">
                  Followers
                </Text>
              </View>
              <View>
                <Text className="text-[18px] font-semibold text-[#161D1A]">
                  {seller?.followingCount ?? 0}
                </Text>
                <Text className="text-[12px] font-medium text-[#6c7a74]">
                  Following
                </Text>
              </View>
            </View>

            <View className="mt-4 flex-row gap-4">
              <Pressable
                onPress={handleToggleFollow}
                className="flex-1 items-center rounded-xl py-3"
                style={({ pressed }) => ({
                  backgroundColor: following ? "#DFF7EE" : "#27BB97",
                  borderWidth: following ? 2 : 0,
                  borderColor: following ? "#27BB97" : "transparent",
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Text
                  className="text-[18px] font-semibold"
                  style={{ color: following ? "#27BB97" : "#FFFFFF" }}
                >
                  {following ? "Following" : "Follow"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (!sellerId) return;
                  router.push({
                    pathname: "/chat-conversation",
                    params: { recipientId: sellerId, name: displayName },
                  } as Href);
                }}
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
            {listings.length === 0 ? (
              <View className="items-center py-16">
                <MaterialIcons name="inventory-2" size={48} color="#CBD5E1" />
                <Text className="mt-2 text-[14px] text-[#6C7A74]">
                  No active listings yet.
                </Text>
              </View>
            ) : (
              <>
            <View className="flex-row justify-between">
              {firstRow.map((item) => (
                <HalfCard key={item._id} item={item} width={halfCardWidth} onPress={() => navigateToListing(item)} />
              ))}
            </View>

            {featured ? (
              <Pressable
                onPress={() => navigateToListing(featured)}
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
                  {featured.images?.[0] ? (
                  <Image
                    source={featured.images[0]}
                    contentFit="cover"
                    transition={200}
                    className="h-full w-full"
                  />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-slate-100">
                      <MaterialIcons name="image" size={40} color="#CBD5E1" />
                    </View>
                  )}
                </View>
                <View className="p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-[18px] font-semibold text-[#161D1A]">
                        {featured.title}
                      </Text>
                      {featured.location ? (
                        <View className="mt-1 flex-row items-center gap-1">
                          <MaterialIcons name="location-on" size={13} color="#94A3B8" />
                          <Text className="text-[12px] text-[#6c7a74]">
                            {featured.location}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="text-[20px] font-bold text-[#006b55]">
                      {featured.price ? `₹${Number(featured.price).toLocaleString("en-IN")}` : "N/A"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : null}

            {remainingAfterFeatured.length > 0 && (
            <View className="mt-3 flex-row flex-wrap justify-between" style={{ gap: 12 }}>
              {remainingAfterFeatured.map((item) => (
                <HalfCard key={item._id} item={item} width={halfCardWidth} onPress={() => navigateToListing(item)} />
              ))}
            </View>
            )}
              </>
            )}
          </View>
        </View>
          </>
        )}
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
