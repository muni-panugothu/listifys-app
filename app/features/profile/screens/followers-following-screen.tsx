import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

type FollowTab = "followers" | "following";

type FollowUser = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  verified?: boolean;
  following: boolean;
};

const followers: FollowUser[] = [
  {
    id: "alex-rivers",
    name: "Alex Rivers",
    handle: "@arivers_tech",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuATSfOZy2LxowK-ihM1zArGUBLK5_3ZUD0Bzma6im8yb3YtrbNgqlfjt7Zp60bYDOc5bOONtWw_uap03KoATMC6iVrAEKE9ogjwsPc9FgMWt-W7r6E8KJ0y64iOC_Wqd9yyvDkqHscCXPBHHOVOtVrAYbLK85k_Z9bhEVzG3mv0VCjbxPIY4VP2ga0xdVNyLu4IjLqepT_udUqiW_hjSkt9o8kroUTaUD-Yzy6ydJjaBD_qVdtVC9FkYtH4cBENVORJ5TMhgVRIIIU",
    verified: true,
    following: false,
  },
  {
    id: "sarah-chen",
    name: "Sarah Chen",
    handle: "@sarah_designs",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDvwuQjR5HTm_osKBP8C-ypNMgY2pBHZEwULOAHDmaxdrzsCOYuLH8nj-iTxfOfE-6CZrkoD0BFiHuPCOu93BusK24nfFs2pC079Hwwe5q8cGksG8_W-bNikUSo5QmmMT1u-_OgvR_a5C590KMCUf7p5cnxzXUbgk6_KdTr7rYthzHZ3qDCk6rv0nUxJ_NF3UHkC6GUaQ4xSP_jDiGcB02Ya3vwspdPQVnhxLu8ALe55qNTq7cPvllWzNS1L3Rc35AtrP75OnMu6Fw",
    following: true,
  },
  {
    id: "marcus-thorne",
    name: "Marcus Thorne",
    handle: "@mthorne_photo",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCIkhks3zHlbxBgsTsRaJsubuQU_GoboQYhz4xvqwgvfoJJHKA6djuYyi-ma_9VLhZpLVKLkRedyusBQyQron7OzdZuBFN8Gt1JpZs7JNUtJ-QgOimLraASWQW5lhKdHjnbpDgqap1hRxdpjiBvAt6ljFhIRLs3BUUwaEgO5DTcKnR-iqB_TwMX0a1mjQqblumrB9T67YxjtuwXaDR2sV2c6bPFcwyB6nc2tLQ1UGkGiy5Pm2DlZLP0iXoEYpqdv9FO765M5nX6RzE",
    verified: true,
    following: false,
  },
  {
    id: "elena-rodriguez",
    name: "Elena Rodriguez",
    handle: "@elena_rod",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBsAg-RhZv-STWhVQGijTErxsUiIwQmjv8V1kjarTYuDwgVD11szxXtH5i7ZMczF_V8wm1_9B8cSb4gt_aaQHqv9SQBLqlzczw_mB8TElXWTJwP4S86tBjepRQbxEiCQXsVTF9_vc2hLa_wIB2D6YQqxGAyUUEKDHNFOXcc3mDeaK-oQf9GPBIIWyPcYP7_dPL61vk1Vt5qlm_rMNzNh5VQbUxOw1VzX1h4Vm3UZ16lAUuTYNnKI80OJ8OeiVq2qtmYrFiMLiPZ6ck",
    following: false,
  },
  {
    id: "david-kim",
    name: "David Kim",
    handle: "@dkim_art",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDgok-iEj0XLM2TM5jCiON9zk16aA8oI-YFdZJ1iPiHMIpvMrHZBDcYyCzOWrs6XLpxc0YbawvH6uN7q7f8i36WdPa3DaxxYneG4J3EqOF7eqxkqUjW0pnFaTFxVGsMBLeXH5Q3wnNlo1JJhsPHwS9ZTYI6fGPjBbm9TzNjeDjM8ij8dUCyhj5lY0_hjuJUjs5V_SkzeRK_AWnB8H1vjNecXaVgeeNPVHmDUgpBxW7yLeWJ-gPKU6skDH2UbXpgWyafbjN6Yd1xmg0",
    following: true,
  },
  {
    id: "zoe-baker",
    name: "Zoe Baker",
    handle: "@zoebaker_off",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBZ0NHBEkXWNqBNpvHFeI0QWA_TE5eD1W862pbI54UWF05AW0uQXtAjuXO53St1prkFcqlKV3oJdGCrq_JTmMspz33TC_0haN6EsLT7xCqHwkHyl6Fnt6ew8DH6IE0zatwmrTN0seQRIXd9iRF6BwOGrVOrB4HCH08g4VDRr0yK1-pRp-4xDbF76Gx1Nqpg5bmWnwYpCznUmInsor7lpfInGtkObJCQ3SJt7MynTw1TM73M6zqXjSZDiPVMGTrg6exw_hw0thWenUU",
    verified: true,
    following: false,
  },
];

const followingUsers: FollowUser[] = [
  {
    id: "priya-sharma",
    name: "Priya Sharma",
    handle: "@priya_market",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAKB4fqc9xbdNy-01QszLtRtNDj0GmIoizp83AO6hQtuiyOQ8CtfbRIHOugU1k7CctviY0ZpBrjX_zgVJV5QZEmWi9xjPlNQgxs97wWC2AIfZL-QwvAw6z81Ps5ducgUMWd9fooGp2ofPtjGH0clxPT9MzzGGlS1HpeeL_LFUylfO8qfvGLLEgoj33DUZrHiqXRXoswrMe9o_URnrfpQD7StgOgCnCPDqf0N4RQUDvlmCh8QLFzTySzamJ3JlUs2wH8qCc3DKks8WA",
    verified: true,
    following: true,
  },
  {
    id: "sarah-chen",
    name: "Sarah Chen",
    handle: "@sarah_designs",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDvwuQjR5HTm_osKBP8C-ypNMgY2pBHZEwULOAHDmaxdrzsCOYuLH8nj-iTxfOfE-6CZrkoD0BFiHuPCOu93BusK24nfFs2pC079Hwwe5q8cGksG8_W-bNikUSo5QmmMT1u-_OgvR_a5C590KMCUf7p5cnxzXUbgk6_KdTr7rYthzHZ3qDCk6rv0nUxJ_NF3UHkC6GUaQ4xSP_jDiGcB02Ya3vwspdPQVnhxLu8ALe55qNTq7cPvllWzNS1L3Rc35AtrP75OnMu6Fw",
    following: true,
  },
  {
    id: "david-kim",
    name: "David Kim",
    handle: "@dkim_art",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDgok-iEj0XLM2TM5jCiON9zk16aA8oI-YFdZJ1iPiHMIpvMrHZBDcYyCzOWrs6XLpxc0YbawvH6uN7q7f8i36WdPa3DaxxYneG4J3EqOF7eqxkqUjW0pnFaTFxVGsMBLeXH5Q3wnNlo1JJhsPHwS9ZTYI6fGPjBbm9TzNjeDjM8ij8dUCyhj5lY0_hjuJUjs5V_SkzeRK_AWnB8H1vjNecXaVgeeNPVHmDUgpBxW7yLeWJ-gPKU6skDH2UbXpgWyafbjN6Yd1xmg0",
    following: true,
  },
  {
    id: "zoe-baker",
    name: "Zoe Baker",
    handle: "@zoebaker_off",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBZ0NHBEkXWNqBNpvHFeI0QWA_TE5eD1W862pbI54UWF05AW0uQXtAjuXO53St1prkFcqlKV3oJdGCrq_JTmMspz33TC_0haN6EsLT7xCqHwkHyl6Fnt6ew8DH6IE0zatwmrTN0seQRIXd9iRF6BwOGrVOrB4HCH08g4VDRr0yK1-pRp-4xDbF76Gx1Nqpg5bmWnwYpCznUmInsor7lpfInGtkObJCQ3SJt7MynTw1TM73M6zqXjSZDiPVMGTrg6exw_hw0thWenUU",
    verified: true,
    following: true,
  },
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const, active: true },
];

const getTabParam = (value?: string | string[]): FollowTab => {
  const nextValue = typeof value === "string" ? value : value?.[0];
  return nextValue === "following" ? "following" : "followers";
};

export function FollowersFollowingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const [activeTab, setActiveTab] = useState<FollowTab>(getTabParam(params.tab));
  const [searchQuery, setSearchQuery] = useState("");
  const [followState, setFollowState] = useState<Record<string, boolean>>(() => {
    const allUsers = [...followers, ...followingUsers];
    return allUsers.reduce<Record<string, boolean>>((acc, user) => {
      acc[user.id] = user.following;
      return acc;
    }, {});
  });

  useEffect(() => {
    setActiveTab(getTabParam(params.tab));
  }, [params.tab]);

  const visibleUsers = useMemo(() => {
    const source = activeTab === "followers" ? followers : followingUsers;
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return source;
    }

    return source.filter((user) => {
      return (
        user.name.toLowerCase().includes(normalizedQuery) ||
        user.handle.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [activeTab, searchQuery]);

  const handleBottomTabPress = (tabId: string) => {
    if (tabId === "home") { router.push("/home-feed-root"); return; }
    if (tabId === "sell") { router.push("/sell-entry"); return; }
    if (tabId === "search") { router.push("/search-home"); return; }
    if (tabId === "messages") { router.push("/messages-inbox"); return; }
    if (tabId === "profile") { router.push("/dashboard-home"); return; }
  };

  const openTab = (tab: FollowTab) => {
    setActiveTab(tab);
    router.replace({ pathname: "/followers-following", params: { tab } });
  };

  const toggleFollow = (userId: string) => {
    setFollowState((current) => ({
      ...current,
      [userId]: !current[userId],
    }));
  };

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
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="arrow-back" size={24} color="#161D1A" />
          </Pressable>
          <Text className="text-[20px] font-semibold tracking-tight text-[#161D1A]">
            John Doe
          </Text>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <MaterialIcons name="more-vert" size={22} color="#161D1A" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topBarHeight,
          paddingBottom: 84 + bottomNavPadding,
        }}
      >
        <View className="border-b border-slate-100 bg-white">
          <View className="flex-row">
            {[
              { key: "followers" as const, count: "450", label: "Followers" },
              { key: "following" as const, count: "89", label: "Following" },
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
          <View className="h-12 flex-row items-center rounded-xl bg-[#EFF5F0] px-4">
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
          {visibleUsers.map((user) => {
            const isFollowing = followState[user.id];
            return (
              <View
                key={user.id}
                className="flex-row items-center justify-between rounded-xl border border-transparent px-3 py-3"
                style={{ backgroundColor: "transparent" }}
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 overflow-hidden rounded-full border border-slate-100 bg-slate-200">
                    <Image source={user.avatar} contentFit="cover" className="h-full w-full" />
                  </View>
                  <View>
                    <View className="flex-row items-center gap-1">
                      <Text className="text-[18px] font-semibold text-[#161D1A]">{user.name}</Text>
                      {user.verified ? (
                        <MaterialIcons name="verified" size={18} color="#27BB97" />
                      ) : null}
                    </View>
                    <Text className="text-[12px] font-medium text-slate-500">{user.handle}</Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => toggleFollow(user.id)}
                  className="rounded-full px-5 py-2"
                  style={({ pressed }) => ({
                    backgroundColor: isFollowing ? "#FFFFFF" : "#27BB97",
                    borderWidth: isFollowing ? 1 : 0,
                    borderColor: isFollowing ? "#E2E8F0" : "transparent",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    className="text-[12px] font-semibold"
                    style={{ color: isFollowing ? "#475569" : "#FFFFFF" }}
                  >
                    {isFollowing ? "Unfollow" : "Follow"}
                  </Text>
                </Pressable>
              </View>
            );
          })}
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
