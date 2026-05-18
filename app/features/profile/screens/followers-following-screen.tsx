import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  type FollowListUser,
  getFollowList,
  toggleFollowUser,
} from "@/features/auth/services/auth-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { useAppSelector } from "@/store/hooks";
import { FloatingBottomNav } from "@/components/floating-bottom-nav";

type FollowTab = "followers" | "following";

const defaultAvatar = "https://ui-avatars.com/api/?name=User&background=27BB97&color=fff&size=128";

const getTabParam = (value?: string | string[]): FollowTab => {
  const nextValue = typeof value === "string" ? value : value?.[0];
  return nextValue === "following" ? "following" : "followers";
};

const formatFollowMeta = (user: FollowListUser) => {
  if (user.createdAt) {
    const joinedDate = new Date(user.createdAt);
    if (!Number.isNaN(joinedDate.getTime())) {
      return `Joined ${joinedDate.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })}`;
    }
  }

  if (user.provider === "google") {
    return "Google account";
  }

  return "Listifys member";
};

export function FollowersFollowingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const currentUser = useAppSelector((s) => s.auth.user);
  const [activeTab, setActiveTab] = useState<FollowTab>(getTabParam(params.tab));
  const [searchQuery, setSearchQuery] = useState("");
  const [followers, setFollowers] = useState<FollowListUser[]>([]);
  const [followingUsers, setFollowingUsers] = useState<FollowListUser[]>([]);
  const [followState, setFollowState] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(getTabParam(params.tab));
  }, [params.tab]);

  const loadFollowData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [followersResponse, followingResponse] = await Promise.all([
        getFollowList("followers"),
        getFollowList("following"),
      ]);

      const nextFollowers = followersResponse.users ?? [];
      const nextFollowing = followingResponse.users ?? [];
      const nextFollowState = nextFollowing.reduce<Record<string, boolean>>((acc, user) => {
        acc[user.id] = true;
        return acc;
      }, {});

      setFollowers(nextFollowers);
      setFollowingUsers(nextFollowing);
      setFollowState(nextFollowState);
    } catch (error) {
      Alert.alert("Followers", error instanceof Error ? error.message : "Failed to load follow data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFollowData();
  }, [loadFollowData]);

  const { refreshing, onRefresh } = usePullToRefresh(loadFollowData);

  const visibleUsers = useMemo(() => {
    const source = activeTab === "followers" ? followers : followingUsers;
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return source;
    }

    return source.filter((user) => {
      return (
        user.name.toLowerCase().includes(normalizedQuery) ||
        formatFollowMeta(user).toLowerCase().includes(normalizedQuery)
      );
    });
  }, [activeTab, searchQuery]);

  const handleBottomTabPress = useTabNavigation();

  const openTab = (tab: FollowTab) => {
    setActiveTab(tab);
    router.replace({ pathname: "/followers-following", params: { tab } });
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/dashboard-home" as Href);
  };

  const toggleFollow = async (user: FollowListUser) => {
    if (pendingUserId) {
      return;
    }

    setPendingUserId(user.id);

    try {
      const response = await toggleFollowUser(user.id);
      const isFollowing = response.isFollowing;

      setFollowState((current) => ({
        ...current,
        [user.id]: isFollowing,
      }));

      setFollowingUsers((current) => {
        const exists = current.some((entry) => entry.id === user.id);
        if (isFollowing) {
          return exists ? current : [user, ...current];
        }

        return current.filter((entry) => entry.id !== user.id);
      });
    } catch (error) {
      Alert.alert("Follow", error instanceof Error ? error.message : "Failed to update follow status.");
    } finally {
      setPendingUserId(null);
    }
  };

  return (
    <View className="flex-1 bg-[#F6F7F8]">
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
        <View className="flex-row items-center gap-4">
          <Pressable onPress={handleBack} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="arrow-back" size={24} color="#161D1A" />
          </Pressable>
          <Text className="text-[20px] font-semibold tracking-tight text-[#161D1A]">
            {currentUser?.name || "Followers"}
          </Text>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <MaterialIcons name="more-vert" size={22} color="#161D1A" />
        </Pressable>
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
        <View className="border-b border-slate-100 bg-white">
          <View className="flex-row">
            {[
              { key: "followers" as const, count: String(followers.length), label: "Followers" },
              { key: "following" as const, count: String(followingUsers.length), label: "Following" },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => openTab(tab.key)}
                  className="flex-1 items-center border-b-2 py-4"
                  style={{ borderBottomColor: isActive ? "#27BB97" : "transparent" }}
                >
                  <Text className="text-[18px] font-semibold" style={{ color: isActive ? "#27BB97" : "#161D1A" }}>
                    {tab.count}
                  </Text>
                  <Text className="text-[11px] font-medium uppercase tracking-wider" style={{ color: isActive ? "#27BB97" : "#64748B" }}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="px-4 py-4">
          <View className="h-12 flex-row items-center rounded-xl bg-[#F3F4F6] px-4">
            <MaterialIcons name="search" size={20} color="#94A3B8" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={activeTab === "followers" ? "Search followers..." : "Search following..."}
              placeholderTextColor="#94A3B8"
              className="ml-3 flex-1 text-[14px] text-[#161D1A]"
              style={{ paddingVertical: 0 }}
            />
          </View>
        </View>

        <View className="gap-2 px-4">
          {!isLoading && visibleUsers.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10">
              <MaterialIcons name="group-off" size={30} color="#94A3B8" />
              <Text className="mt-3 text-[16px] font-semibold text-[#161D1A]">
                {activeTab === "followers" ? "No followers yet" : "Not following anyone yet"}
              </Text>
              <Text className="mt-1 text-center text-[13px] leading-5 text-slate-500">
                {searchQuery.trim()
                  ? "Try a different name search."
                  : activeTab === "followers"
                    ? "People who follow you will appear here."
                    : "Profiles you follow will appear here."}
              </Text>
            </View>
          ) : null}

          {visibleUsers.map((user) => {
            const isFollowing = !!followState[user.id];
            const buttonLabel = activeTab === "followers" && !isFollowing ? "Follow back" : isFollowing ? "Unfollow" : "Follow";
            return (
              <View
                key={user.id}
                className="flex-row items-center justify-between rounded-xl border border-transparent px-3 py-3"
                style={{ backgroundColor: "transparent" }}
              >
                <Pressable
                  onPress={() => router.push({ pathname: "/seller-public-profile", params: { userId: user.id } })}
                  className="flex-1 flex-row items-center gap-3"
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                >
                  <View className="h-12 w-12 overflow-hidden rounded-full border border-slate-100 bg-slate-200">
                    <Image source={user.profileImageUrl || defaultAvatar} contentFit="cover" className="h-full w-full" />
                  </View>
                  <View>
                    <View className="flex-row items-center gap-1">
                      <Text className="text-[18px] font-semibold text-[#161D1A]">{user.name}</Text>
                      {user.provider === "google" ? (
                        <MaterialIcons name="verified" size={18} color="#27BB97" />
                      ) : null}
                    </View>
                    <Text className="text-[12px] font-medium text-slate-500">{formatFollowMeta(user)}</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => void toggleFollow(user)}
                  className="rounded-full px-5 py-2"
                  style={({ pressed }) => ({
                    backgroundColor: isFollowing ? "#FFFFFF" : "#27BB97",
                    borderWidth: isFollowing ? 1 : 0,
                    borderColor: isFollowing ? "#E2E8F0" : "transparent",
                    opacity: pressed || pendingUserId === user.id ? 0.8 : 1,
                  })}
                >
                  <Text
                    className="text-[12px] font-semibold"
                    style={{ color: isFollowing ? "#475569" : "#FFFFFF" }}
                  >
                    {pendingUserId === user.id ? "Updating..." : buttonLabel}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <FloatingBottomNav activeTabId="profile" onTabPress={handleBottomTabPress} />
    </View>
  );
}
