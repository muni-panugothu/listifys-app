import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { type Href, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveAbsoluteMediaUrl } from "@/features/auth/services/auth-api";
import {
  getConversations,
  type Conversation,
} from "@/features/messaging/services/chat-api";
import {
  connectSocket,
  getSocket,
  requestUnreadCount,
} from "@/features/messaging/services/socket-service";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { useAppSelector } from "@/store/hooks";

const filterChips = ["All", "Unread", "Buying", "Selling"] as const;
type FilterChip = (typeof filterChips)[number];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const, active: true },
  { id: "profile", label: "Profile", icon: "person" as const },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export function MessagesInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((s) => s.auth.user);
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const [activeFilter, setActiveFilter] = useState<FilterChip>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

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

  const loadConversations = useCallback(async () => {
    try {
      const res = await getConversations();
      if (res.conversations) setConversations(res.conversations);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations]),
  );

  // Socket.IO real-time updates
  useEffect(() => {
    try {
      connectSocket();
    } catch {
      // no token yet
      return;
    }
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = () => {
      loadConversations();
    };

    const handleConversationUpdated = () => {
      loadConversations();
    };

    const handleUnreadCount = () => {
      // Could update a global badge counter
    };

    socket.on("message:new", handleNewMessage);
    socket.on("conversation:updated", handleConversationUpdated);
    socket.on("chat:unreadCount", handleUnreadCount);
    requestUnreadCount();

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("conversation:updated", handleConversationUpdated);
      socket.off("chat:unreadCount", handleUnreadCount);
    };
  }, [loadConversations]);

  const { refreshing, onRefresh } = usePullToRefresh(loadConversations);

  const getOtherParticipant = useCallback(
    (conv: Conversation) => {
      return conv.participants.find((p) => {
        const pid = p.id || p._id;
        return pid !== user?.id;
      }) ?? conv.participants[0];
    },
    [user?.id],
  );

  const filtered = useMemo(() => {
    let list = conversations;

    if (activeFilter === "Unread") {
      list = list.filter((c) => (c.unreadCount ?? 0) > 0);
    }
    if (activeFilter === "Buying") {
      list = list.filter((c) => Boolean(c.listing?.listingId) && c.lastMessage?.sender !== user?.id);
    }
    if (activeFilter === "Selling") {
      list = list.filter((c) => Boolean(c.listing?.listingId) && c.lastMessage?.sender === user?.id);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => {
        const other = getOtherParticipant(c);
        return other?.name?.toLowerCase().includes(q);
      });
    }
    return list;
  }, [conversations, activeFilter, searchQuery, user?.id, getOtherParticipant]);

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
          <Text className="text-[14px] font-semibold tracking-tight text-[#161D1A]">Messages</Text>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <MaterialIcons name="settings" size={24} color="#27BB97" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#27BB97"]} tintColor="#27BB97" progressViewOffset={topBarHeight} />}
        contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 84 + bottomNavPadding }}
      >
        <View className="px-4">
          {/* Search */}
          <View className="mb-6 h-12 flex-row items-center rounded-xl border border-[#BBCAC3] bg-[#EFF5F0] px-4">
            <MaterialIcons name="search" size={22} color="#6C7A74" />
            <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search conversations..." placeholderTextColor="#94A3B8" className="ml-2 flex-1 text-[14px] text-[#161D1A]" style={{ paddingVertical: 0 }} />
          </View>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6" contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {filterChips.map((chip) => (
              <Pressable
                key={chip}
                onPress={() => setActiveFilter(chip)}
                className="rounded-full px-4 py-1.5"
                style={{ backgroundColor: chip === activeFilter ? "#27BB97" : "#FFFFFF", borderWidth: chip === activeFilter ? 0 : 1, borderColor: "#BBCAC3" }}
              >
                <Text className="text-[12px] font-medium" style={{ color: chip === activeFilter ? "#FFFFFF" : "#3C4A44" }}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Loading */}
          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator size="large" color="#27BB97" />
            </View>
          ) : filtered.length === 0 ? (
            <View className="items-center py-10">
              <MaterialIcons name="chat-bubble-outline" size={48} color="#CBD5E1" />
              <Text className="mt-2 text-[14px] text-[#6C7A74]">
                {activeFilter === "Unread" ? "No unread messages" : "No conversations yet"}
              </Text>
            </View>
          ) : (
            <View className="gap-1">
              {filtered.map((conv) => {
                const other = getOtherParticipant(conv);
                const otherName = other?.name ?? "User";
                const avatar = resolveAbsoluteMediaUrl(other?.profileImageUrl);
                const lastMsg = conv.lastMessage;
                const lastMsgText = lastMsg?.content ?? (lastMsg?.attachments?.length ? "Attachment" : "");
                const lastMsgTime = lastMsg?.createdAt ? timeAgo(lastMsg.createdAt) : "";
                const myUnread = conv.unreadCount ?? 0;
                const isFromMe = lastMsg?.sender === user?.id;
                const isUnread = myUnread > 0;
                const showOnlineDot = isUnread;

                return (
                  <Pressable
                    key={conv._id}
                    onPress={() =>
                      router.push(
                        `/chat-conversation?conversationId=${conv._id}&name=${encodeURIComponent(otherName)}&listingTitle=${encodeURIComponent(conv.listing?.listingTitle ?? "")}&listingPrice=${conv.listing?.listingPrice ?? ""}&listingImage=${encodeURIComponent(conv.listing?.listingImage ?? "")}&currency=${encodeURIComponent(conv.listing?.currency ?? "₹")}` as Href,
                      )
                    }
                    className="flex-row items-center gap-4 rounded-2xl p-4"
                    style={({ pressed }) => ({
                      backgroundColor: isUnread ? "rgba(255,255,255,0.7)" : pressed ? "rgba(255,255,255,0.5)" : "transparent",
                      borderWidth: isUnread ? 1 : 0,
                      borderColor: isUnread ? "#F3F4F6" : "transparent",
                      shadowColor: isUnread ? "#000" : "transparent",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isUnread ? 0.05 : 0,
                      shadowRadius: isUnread ? 3 : 0,
                      elevation: isUnread ? 1 : 0,
                    })}
                  >
                    {/* Avatar */}
                    <View className="relative">
                      {avatar ? (
                        <Image source={avatar} contentFit="cover" className="h-14 w-14 rounded-full" />
                      ) : (
                        <View className="h-14 w-14 items-center justify-center rounded-full bg-[#DDE4DF]">
                          <MaterialIcons name="person" size={24} color="#6C7A74" />
                        </View>
                      )}
                      {showOnlineDot && (
                        <View className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />
                      )}
                    </View>
                    {/* Content */}
                    <View className="flex-1">
                      <View className="mb-0.5 flex-row items-baseline justify-between">
                        <Text className="text-[18px] font-semibold text-[#161D1A]" numberOfLines={1}>{otherName}</Text>
                        <Text className="text-[12px] font-medium" style={{ color: isUnread ? "#27BB97" : "#6C7A74" }}>{lastMsgTime}</Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 flex-row items-center gap-1">
                          {isFromMe && <MaterialIcons name="done-all" size={16} color="#6C7A74" />}
                          <Text className="text-[14px]" style={{ color: isUnread ? "#161D1A" : "#3C4A44", fontWeight: isUnread ? "600" : "400" }} numberOfLines={1}>{lastMsgText}</Text>
                        </View>
                        {isUnread && (
                          <View className="ml-4 h-5 min-w-5 items-center justify-center rounded-full bg-[#27BB97] px-1">
                            <Text className="text-[10px] font-bold text-white">{myUnread}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
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
