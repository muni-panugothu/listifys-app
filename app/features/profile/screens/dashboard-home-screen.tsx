import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "@/lib/safe-router";
import { useCallback, useMemo, useState } from "react";
import { BackHandler, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getUnreadCount as getNotificationUnreadCount } from "@/features/auth/services/auth-api";
import { fetchSavedListings } from "@/features/listing/services/listing-api";
import { getUnreadCount as getChatUnreadCount } from "@/features/messaging/services/chat-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProfile } from "@/store/slices/auth-slice";

const defaultAvatar = "https://ui-avatars.com/api/?name=User&background=27BB97&color=fff&size=128";

type MenuItem = {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  route: string;
  badge?: string;
};

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const, active: true },
];

export function DashboardHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [menuCounts, setMenuCounts] = useState({
    savedItems: 0,
    unreadMessages: 0,
    unreadNotifications: 0,
  });

  const loadDashboardData = useCallback(async () => {
    const [savedResult, chatResult, notificationResult] = await Promise.allSettled([
      fetchSavedListings(),
      getChatUnreadCount(),
      getNotificationUnreadCount(),
    ]);

    await dispatch(fetchProfile()).unwrap().catch(() => {});

    setMenuCounts({
      savedItems: savedResult.status === "fulfilled" ? savedResult.value.listings.length : 0,
      unreadMessages: chatResult.status === "fulfilled" ? chatResult.value.unreadCount ?? 0 : 0,
      unreadNotifications: notificationResult.status === "fulfilled" ? notificationResult.value.unreadCount ?? 0 : 0,
    });
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboardData();
    }, [loadDashboardData]),
  );

  const handleRefresh = useCallback(async () => {
    await loadDashboardData();
  }, [loadDashboardData]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const profileImageUri =
    user?.profileImageUrl ?? user?.profileImage ?? user?.googleProfileImage ?? user?.avatar ?? defaultAvatar;

  const displayName = user?.name || "User";
  const displayEmail = user?.email || "";
  const isVerified = user?.isVerified ?? false;

  const stats = [
    { value: String(user?.listingsCount ?? 0), label: "Listings", onPress: () => router.push("/my-listings-active") },
    {
      value: String(user?.followersCount ?? 0),
      label: "Followers",
      onPress: () =>
        router.push({ pathname: "/followers-following", params: { tab: "followers" } }),
    },
    {
      value: String(user?.followingCount ?? 0),
      label: "Following",
      onPress: () =>
        router.push({ pathname: "/followers-following", params: { tab: "following" } }),
    },
  ];

  const accountMenuItems: MenuItem[] = [
    { icon: "person", label: "My Profile", route: "/profile-details-edit" },
    {
      icon: "list-alt",
      label: "My Listings",
      route: "/my-listings-active",
      badge: user?.listingsCount ? String(user.listingsCount) : undefined,
    },
    {
      icon: "favorite",
      label: "Saved Items",
      route: "/saved-items",
      badge: menuCounts.savedItems ? String(menuCounts.savedItems) : undefined,
    },
    {
      icon: "chat",
      label: "Messages",
      route: "/messages-inbox",
      badge: menuCounts.unreadMessages ? String(menuCounts.unreadMessages) : undefined,
    },
  ];

  const settingsMenuItems: MenuItem[] = [
    { icon: "devices", label: "Devices", route: "/devices" },
    { icon: "history", label: "Activity Log", route: "/activity-log" },
    {
      icon: "notifications",
      label: "Notifications",
      route: "/notifications-center",
      badge: menuCounts.unreadNotifications ? String(menuCounts.unreadNotifications) : undefined,
    },
    { icon: "settings", label: "Settings", route: "/app-settings" },
    { icon: "security", label: "Security", route: "/security" },
  ];

  const handleBottomTabPress = useTabNavigation();

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        handleBottomTabPress("home");
        return true;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
      return () => sub.remove();
    }, [handleBottomTabPress]),
  );

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => handleBottomTabPress("home")} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="arrow-back" size={24} color="#27BB97" />
          </Pressable>
          <Text className="text-[14px] font-semibold tracking-tight text-[#27BB97]">Profile</Text>
        </View>
        <Pressable onPress={() => router.push("/app-settings")} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <MaterialIcons name="settings" size={24} color="#27BB97" />
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
        contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 84 + bottomNavPadding }}
      >
        <View className="px-4">
          {/* Profile Identity */}
          <View className="mb-6 items-center">
            <View className="relative mb-4">
              <View className="h-24 w-24 overflow-hidden rounded-full border-2 border-[#006B55]" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }}>
                <Image source={profileImageUri} contentFit="cover" className="h-full w-full" />
              </View>
              <View className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-white bg-green-500" />
            </View>
            <View className="items-center">
              <View className="flex-row items-center gap-1 mb-1">
                <Text className="text-[24px] font-bold tracking-tight text-[#161D1A]">{displayName}</Text>
                {isVerified && <MaterialIcons name="verified" size={20} color="#006B55" />}
              </View>
              <Text className="text-[14px] text-[#3C4A44]">{displayEmail}</Text>
            </View>
          </View>

          {/* Stats Grid */}
          <View className="mb-6 flex-row gap-3">
            {stats.map((stat) => (
              <Pressable
                key={stat.label}
                onPress={stat.onPress}
                className="flex-1 items-center rounded-xl border border-[#BBCAC3]/30 bg-white p-4"
                style={({ pressed }) => ({
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <Text className="text-[20px] font-bold text-[#006B55]">{stat.value}</Text>
                <Text className="text-[12px] font-medium text-[#3C4A44]">{stat.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Account Menu */}
          <View className="mb-4">
            <Text className="mb-2 px-2 text-[12px] font-medium tracking-wider text-[#3C4A44]">Account</Text>
            <View className="overflow-hidden rounded-2xl border border-[#BBCAC3]/20 bg-white">
              {accountMenuItems.map((item, index) => (
                <Pressable
                  key={item.label}
                  onPress={() => router.push(item.route as any)}
                  className="flex-row items-center justify-between px-4 py-4"
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? "#EFF5F0" : "transparent",
                    borderBottomWidth: index < accountMenuItems.length - 1 ? 1 : 0,
                    borderBottomColor: "rgba(187,202,195,0.1)",
                  })}
                >
                  <View className="flex-row items-center gap-3">
                    <MaterialIcons name={item.icon} size={22} color="#3C4A44" />
                    <Text className="text-[14px] font-medium text-[#161D1A]">{item.label}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    {item.badge && (
                      <View className="rounded-full bg-[rgba(39,187,151,0.1)] px-2 py-0.5">
                        <Text className="text-[10px] font-bold text-[#006B55]">{item.badge}</Text>
                      </View>
                    )}
                    <MaterialIcons name="chevron-right" size={22} color="#BBCAC3" />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Settings Menu */}
          <View className="mb-4">
            <Text className="mb-2 px-2 text-[12px] font-medium tracking-wider text-[#3C4A44]">Settings & Security</Text>
            <View className="overflow-hidden rounded-2xl border border-[#BBCAC3]/20 bg-white">
              {settingsMenuItems.map((item, index) => (
                <Pressable
                  key={item.label}
                  onPress={() => router.push(item.route as any)}
                  className="flex-row items-center justify-between px-4 py-4"
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? "#EFF5F0" : "transparent",
                    borderBottomWidth: index < settingsMenuItems.length - 1 ? 1 : 0,
                    borderBottomColor: "rgba(187,202,195,0.1)",
                  })}
                >
                  <View className="flex-row items-center gap-3">
                    <MaterialIcons name={item.icon} size={22} color="#3C4A44" />
                    <Text className="text-[14px] font-medium text-[#161D1A]">{item.label}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    {item.badge && (
                      <View className="rounded-full bg-[rgba(39,187,151,0.1)] px-2 py-0.5">
                        <Text className="text-[10px] font-bold text-[#006B55]">{item.badge}</Text>
                      </View>
                    )}
                    <MaterialIcons name="chevron-right" size={22} color="#BBCAC3" />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Logout Button */}
          <Pressable
            onPress={() => router.push("/logout-modal")}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white px-4 py-4"
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 })}
          >
            <MaterialIcons name="logout" size={22} color="#BA1A1A" />
            <Text className="text-[14px] font-bold text-[#BA1A1A]">Logout</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-100 bg-white" style={{ paddingTop: 12, paddingBottom: bottomNavPadding, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 8 }}>
        <View className="flex-row items-end justify-around px-2">
          {bottomTabs.map((tab) => {
            if (tab.highlight) {
              return (
                <Pressable key={tab.id} onPress={() => handleBottomTabPress(tab.id)} className="items-center justify-center" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <View className="-mt-7 rounded-full border-4 border-[#F4FBF6] bg-[#27BB97] p-2.5" style={{ shadowColor: "#27BB97", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}>
                    <MaterialIcons name={tab.icon} size={24} color="#FFFFFF" />
                  </View>
                  <Text className="mt-1 text-[11px] font-medium tracking-wide text-slate-400">{tab.label}</Text>
                </Pressable>
              );
            }
            return (
              <Pressable key={tab.id} onPress={() => handleBottomTabPress(tab.id)} className="items-center py-1" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <MaterialIcons name={tab.icon} size={24} color={tab.active ? "#27BB97" : "#94A3B8"} />
                <Text className="text-[11px] font-medium tracking-wide" style={{ color: tab.active ? "#27BB97" : "#94A3B8" }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
