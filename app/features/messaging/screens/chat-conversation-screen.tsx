import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveAbsoluteMediaUrl } from "@/features/auth/services/auth-api";
import {
  getMessages,
  getOrCreateConversation,
  markConversationRead,
  sendMessageApi,
  type ChatMessage,
  type Conversation,
} from "@/features/messaging/services/chat-api";
import {
  connectSocket,
  emitMessageDelivered,
  emitTypingStart,
  emitTypingStop,
  getSocket,
  joinConversation,
  leaveConversation,
  requestLastSeen,
} from "@/features/messaging/services/socket-service";
import { Image } from "@/lib/nativewind-interop";
import { useAppSelector } from "@/store/hooks";

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatMoney(value?: number | string | null, currency = "₹") {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return `${currency}${num.toLocaleString("en-IN")}`;
}

/** Deduplicate messages by _id, keeping the last occurrence */
function dedup(msgs: ChatMessage[]): ChatMessage[] {
  const seen = new Map<string, ChatMessage>();
  for (const m of msgs) seen.set(m._id, m);
  return Array.from(seen.values());
}

export function ChatConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    conversationId?: string;
    recipientId?: string;
    name?: string;
    listingId?: string;
    listingType?: string;
    listingTitle?: string;
    listingPrice?: string;
    listingImage?: string;
    currency?: string;
  }>();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((s) => s.auth.user);
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contactName = typeof params.name === "string" ? params.name : params.name?.[0] ?? "User";

  // Get or create conversation
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (params.conversationId) {
          // Load messages directly
          const res = await getMessages(params.conversationId);
          if (res.messages) {
            setMessages(dedup(res.messages.reverse()));
          }
          setConversation({ _id: params.conversationId } as Conversation);
          markConversationRead(params.conversationId).catch(() => {});
        } else if (params.recipientId) {
          const res = await getOrCreateConversation({
            recipientId: params.recipientId,
            listingId: params.listingId,
            listingType: params.listingType,
            listingTitle: params.listingTitle,
            listingPrice:
              typeof params.listingPrice === "string" && params.listingPrice
                ? Number(params.listingPrice)
                : undefined,
            listingImage: typeof params.listingImage === "string" ? params.listingImage : undefined,
            currency: typeof params.currency === "string" ? params.currency : undefined,
          });
          if (res.conversation) {
            setConversation(res.conversation);
            const msgRes = await getMessages(res.conversation._id);
            if (msgRes.messages) {
              setMessages(dedup(msgRes.messages.reverse()));
            }
            markConversationRead(res.conversation._id).catch(() => {});
          }
        }
      } catch {
        // keep empty
      } finally {
        setLoading(false);
      }
    })();
  }, [params.conversationId, params.recipientId, params.listingId, params.listingType, params.listingTitle]);

  // Socket.IO setup
  useEffect(() => {
    const convId = conversation?._id;
    if (!convId) return;

    try {
      connectSocket();
    } catch {
      return;
    }
    const socket = getSocket();
    if (!socket) return;

    joinConversation(convId);

    // Request recipient online status
    if (params.recipientId) {
      requestLastSeen(params.recipientId);
    }

    const handleNewMessage = (data: any) => {
      if (data.conversationId === convId || data.conversation === convId) {
        const newMsg: ChatMessage = {
          _id: data._id || data.messageId,
          conversation: convId,
          sender: data.sender,
          content: data.content || "",
          attachments: data.attachments,
          status: "delivered",
          createdAt: data.createdAt || new Date().toISOString(),
        };

        setMessages((prev) => dedup([...prev, newMsg]));

        // Acknowledge delivery
        if (typeof data.sender === "string" && data.sender !== user?.id) {
          emitMessageDelivered(newMsg._id, convId);
          markConversationRead(convId).catch(() => {});
        }
      }
    };

    const handleTypingStart = (data: any) => {
      if (data.conversationId === convId && data.userId !== user?.id) {
        setTypingUser(data.userName || "");
      }
    };

    const handleTypingStop = (data: any) => {
      if (data.conversationId === convId && data.userId !== user?.id) {
        setTypingUser(null);
      }
    };

    const handleUserOnline = (data: any) => {
      if (data.userId === params.recipientId) setIsOnline(true);
    };

    const handleUserOffline = (data: any) => {
      if (data.userId === params.recipientId) setIsOnline(false);
    };

    const handleLastSeen = (data: any) => {
      if (data.userId === params.recipientId) {
        setIsOnline(data.isOnline);
      }
    };

    const handleMessageStatus = (data: any) => {
      if (data.conversationId === convId) {
        setMessages((prev) =>
          prev.map((m) => (m._id === data.messageId ? { ...m, status: data.status } : m)),
        );
      }
    };

    const handleMessagesRead = (data: any) => {
      if (data.conversationId === convId) {
        setMessages((prev) => prev.map((m) => ({ ...m, status: "read" })));
      }
    };

    socket.on("message:new", handleNewMessage);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
    socket.on("user:online", handleUserOnline);
    socket.on("user:offline", handleUserOffline);
    socket.on("user:lastSeen", handleLastSeen);
    socket.on("message:status", handleMessageStatus);
    socket.on("messages:read", handleMessagesRead);

    return () => {
      leaveConversation(convId);
      socket.off("message:new", handleNewMessage);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      socket.off("user:online", handleUserOnline);
      socket.off("user:offline", handleUserOffline);
      socket.off("user:lastSeen", handleLastSeen);
      socket.off("message:status", handleMessageStatus);
      socket.off("messages:read", handleMessagesRead);
    };
  }, [conversation?._id, user?.id, params.recipientId]);

  // Typing handler
  const handleTextChange = useCallback(
    (text: string) => {
      setMessageText(text);
      const convId = conversation?._id;
      if (!convId) return;

      if (!isTyping) {
        setIsTyping(true);
        emitTypingStart(convId);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        emitTypingStop(convId);
      }, 2000);
    },
    [conversation?._id, isTyping],
  );

  // Send message
  const handleSend = useCallback(async () => {
    const text = messageText.trim();
    if (!text || !conversation?._id || sending) return;

    setSending(true);
    setMessageText("");

    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      emitTypingStop(conversation._id);
    }

    // Optimistic local message
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      _id: tempId,
      conversation: conversation._id,
      sender: user?.id ?? "",
      content: text,
      status: "sent",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await sendMessageApi(conversation._id, text);
      if (res.message) {
        setMessages((prev) =>
          prev.map((m) => (m._id === tempId ? { ...res.message, status: "sent" } : m)),
        );
      }
    } catch {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    } finally {
      setSending(false);
    }
  }, [messageText, conversation?._id, sending, user?.id, isTyping]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Get avatar for the other participant
  const otherAvatar = useMemo(() => {
    if (!conversation?.participants) return null;
    const other = conversation.participants.find((p) => {
      const pid = p.id || p._id;
      return pid !== user?.id;
    });
    return resolveAbsoluteMediaUrl(other?.profileImageUrl);
  }, [conversation?.participants, user?.id]);

  const listingTitle =
    (typeof params.listingTitle === "string" && params.listingTitle) ||
    conversation?.listing?.listingTitle ||
    "";
  const listingImage =
    (typeof params.listingImage === "string" && params.listingImage) ||
    conversation?.listing?.listingImage ||
    "";
  const listingCurrency =
    (typeof params.currency === "string" && params.currency) ||
    conversation?.listing?.currency ||
    "₹";
  const listingPriceLabel = formatMoney(
    typeof params.listingPrice === "string" && params.listingPrice
      ? Number(params.listingPrice)
      : conversation?.listing?.listingPrice,
    listingCurrency,
  );

  // Group messages by date for headers
  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const senderId = typeof item.sender === "string" ? item.sender : (item.sender as any)?.id || (item.sender as any)?._id;
      const fromMe = senderId === user?.id;
      const prevMsg = index > 0 ? messages[index - 1] : null;
      const showDateHeader =
        !prevMsg || formatDateHeader(item.createdAt) !== formatDateHeader(prevMsg.createdAt);

      return (
        <View>
          {showDateHeader && (
            <View className="my-4 items-center">
              <View className="rounded-full bg-[#E3EAE5] px-3 py-1">
                <Text className="text-[10px] font-medium uppercase tracking-wider text-[#3C4A44]">
                  {formatDateHeader(item.createdAt)}
                </Text>
              </View>
            </View>
          )}
          <View
            style={{
              alignItems: fromMe ? "flex-end" : "flex-start",
              alignSelf: fromMe ? "flex-end" : "flex-start",
              maxWidth: "85%",
              marginBottom: 8,
            }}
          >
            <View
              className="rounded-2xl p-4"
              style={{
                backgroundColor: fromMe ? "#27BB97" : "#FFFFFF",
                borderWidth: fromMe ? 0 : 1,
                borderColor: "#F3F4F6",
                borderBottomRightRadius: fromMe ? 4 : 16,
                borderBottomLeftRadius: fromMe ? 16 : 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: fromMe ? 0.1 : 0.05,
                shadowRadius: fromMe ? 4 : 2,
                elevation: fromMe ? 2 : 1,
              }}
            >
              <Text
                className="text-[14px] leading-5"
                style={{ color: fromMe ? "#FFFFFF" : "#161D1A" }}
              >
                {item.content}
              </Text>
            </View>
            <View
              className="mt-1 flex-row items-center gap-1"
              style={{ marginLeft: fromMe ? 0 : 4, marginRight: fromMe ? 4 : 0 }}
            >
              <Text className="text-[10px] text-[#94A3B8]">{formatTime(item.createdAt)}</Text>
              {fromMe && (
                <MaterialIcons
                  name={item.status === "read" ? "done-all" : item.status === "delivered" ? "done-all" : "done"}
                  size={12}
                  color={item.status === "read" ? "#27BB97" : "#94A3B8"}
                />
              )}
            </View>
          </View>
        </View>
      );
    },
    [user?.id, messages],
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#27BB97" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#FFFFFF]">
      {/* Top Bar */}
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
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={24} color="#27BB97" />
          </Pressable>
          <View className="relative">
            {otherAvatar ? (
              <Image
                source={otherAvatar}
                contentFit="cover"
                className="h-10 w-10 rounded-full"
                style={{ borderWidth: 2, borderColor: "rgba(39,187,151,0.2)" }}
              />
            ) : (
              <View className="h-10 w-10 items-center justify-center rounded-full bg-[#DDE4DF]">
                <MaterialIcons name="person" size={20} color="#6C7A74" />
              </View>
            )}
            {isOnline && (
              <View className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#27BB97]" />
            )}
          </View>
          <View>
            <Text className="text-[14px] font-semibold tracking-tight text-[#161D1A]">
              {contactName}
            </Text>
            <Text className="text-[10px] font-medium" style={{ color: isOnline ? "#27BB97" : "#94A3B8" }}>
              {typingUser ? "typing..." : isOnline ? "Online" : "Offline"}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="videocam" size={22} color="#6B7280" />
          </Pressable>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="call" size={21} color="#6B7280" />
          </Pressable>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="settings" size={21} color="#6B7280" />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => `${item._id}_${index}`}
          renderItem={renderItem}
          ListHeaderComponent={
            listingTitle ? (
              <View
                className="mb-4 flex-row items-center gap-3 rounded-xl border px-3 py-3"
                style={{ borderColor: "rgba(187,202,195,0.35)", backgroundColor: "#EFF5F0" }}
              >
                {listingImage ? (
                  <Image source={listingImage} contentFit="cover" className="h-12 w-12 rounded-lg" />
                ) : (
                  <View className="h-12 w-12 items-center justify-center rounded-lg bg-[#DDE4DF]">
                    <MaterialIcons name="inventory-2" size={18} color="#6C7A74" />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-[10px] font-medium text-[#6C7A74]">Inquired about</Text>
                  <Text className="text-[13px] font-semibold text-[#161D1A]" numberOfLines={1}>
                    {listingTitle}
                  </Text>
                  {listingPriceLabel ? (
                    <Text className="text-[12px] font-semibold text-[#27BB97]">{listingPriceLabel}</Text>
                  ) : null}
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
              </View>
            ) : null
          }
          contentContainerStyle={{
            paddingTop: topBarHeight + 16,
            paddingBottom: 10,
            paddingHorizontal: 16,
          }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input Area */}
        <View className="border-t border-slate-100 bg-white px-4 py-3" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
          <View className="flex-row items-end gap-3">
            <View className="mb-1 flex-row items-center gap-1">
              <Pressable className="h-10 w-10 items-center justify-center" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <MaterialIcons name="add-circle" size={23} color="#9CA3AF" />
              </Pressable>
              <Pressable className="h-10 w-10 items-center justify-center" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <MaterialIcons name="photo-camera" size={22} color="#9CA3AF" />
              </Pressable>
            </View>
            <View className="relative flex-1">
              <TextInput
                value={messageText}
                onChangeText={handleTextChange}
                placeholder="Type a message..."
                placeholderTextColor="#94A3B8"
                multiline
                className="max-h-32 rounded-2xl bg-slate-50 px-4 py-3 pr-12 text-[14px] text-[#161D1A]"
              />
              <Pressable
                onPress={handleSend}
                disabled={!messageText.trim() || sending}
                className="absolute bottom-1.5 right-2 h-9 w-9 items-center justify-center rounded-xl bg-[#27BB97]"
                style={{
                  opacity: messageText.trim() ? 1 : 0.5,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <MaterialIcons name="send" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
