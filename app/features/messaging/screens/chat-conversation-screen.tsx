import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_SCREEN_BG } from "@/constants/theme";
import { ListifyFonts } from "@/constants/typography";
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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { outgoingCallStarted } from "@/store/slices/call-slice";

const BRAND = "#27BB97";
const CHAT_BG = APP_SCREEN_BG;
const BAR_BG = APP_SCREEN_BG;
const INCOMING_BUBBLE = "#E8E8E8";
const DATE_PILL = "#E5E5E5";
const TEXT_MUTED = "#9CA3AF";
const TEXT_DARK = "#1A1A1A";

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dedup(msgs: ChatMessage[]): ChatMessage[] {
  const seen = new Map<string, ChatMessage>();
  for (const m of msgs) seen.set(m._id, m);
  return Array.from(seen.values());
}

/** Oldest first — matches API order (server already returns chronological). */
function sortMessagesChronological(msgs: ChatMessage[]): ChatMessage[] {
  return dedup(msgs).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function isFromMe(
  item: ChatMessage,
  userId: string | undefined,
): boolean {
  const senderId =
    typeof item.sender === "string"
      ? item.sender
      : (item.sender as { id?: string; _id?: string })?.id ||
        (item.sender as { id?: string; _id?: string })?._id;
  return senderId === userId;
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

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  const dispatch = useAppDispatch();

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contactName =
    typeof params.name === "string"
      ? params.name
      : params.name?.[0] ?? "Alex Thompson";

  const footerPadding = Math.max(insets.bottom, 10);
  const canSend = messageText.trim().length > 0;
  const [androidKeyboardPad, setAndroidKeyboardPad] = useState(0);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const showSub = Keyboard.addListener(showEvent, scrollToBottom);
    return () => showSub.remove();
  }, [scrollToBottom]);

  /** Android: sit flush on keyboard without double-counting window resize. */
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      const windowHeight = Dimensions.get("window").height;
      const gap = Math.max(0, windowHeight - event.endCoordinates.screenY);
      setAndroidKeyboardPad(gap);
      scrollToBottom();
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setAndroidKeyboardPad(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottom]);

  const inputBottomPadding =
    Platform.OS === "android"
      ? androidKeyboardPad > 0
        ? androidKeyboardPad
        : footerPadding
      : footerPadding;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (params.conversationId) {
          const res = await getMessages(params.conversationId);
          if (res.messages) {
            setMessages(sortMessagesChronological(res.messages));
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
            listingImage:
              typeof params.listingImage === "string"
                ? params.listingImage
                : undefined,
            currency:
              typeof params.currency === "string" ? params.currency : undefined,
          });
          if (res.conversation) {
            setConversation(res.conversation);
            const msgRes = await getMessages(res.conversation._id);
            if (msgRes.messages) {
              setMessages(sortMessagesChronological(msgRes.messages));
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
  }, [
    params.conversationId,
    params.recipientId,
    params.listingId,
    params.listingType,
    params.listingTitle,
    params.listingPrice,
    params.listingImage,
    params.currency,
  ]);

  const displayMessages = useMemo(
    () => sortMessagesChronological(messages),
    [messages],
  );

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

    if (params.recipientId) {
      requestLastSeen(params.recipientId);
    }

    const handleNewMessage = (data: {
      conversationId?: string;
      conversation?: string;
      _id?: string;
      messageId?: string;
      sender?: string;
      content?: string;
      attachments?: ChatMessage["attachments"];
      createdAt?: string;
    }) => {
      if (data.conversationId === convId || data.conversation === convId) {
        const newMsg: ChatMessage = {
          _id: data._id || data.messageId || `msg-${Date.now()}`,
          conversation: convId,
          sender: data.sender ?? "",
          content: data.content || "",
          attachments: data.attachments,
          status: "delivered",
          createdAt: data.createdAt || new Date().toISOString(),
        };

        setMessages((prev) => sortMessagesChronological([...prev, newMsg]));

        if (typeof data.sender === "string" && data.sender !== user?.id) {
          emitMessageDelivered(newMsg._id, convId);
          markConversationRead(convId).catch(() => {});
        }
      }
    };

    const handleTypingStart = (data: { conversationId?: string; userId?: string; userName?: string }) => {
      if (data.conversationId === convId && data.userId !== user?.id) {
        setTypingUser(data.userName || "");
      }
    };

    const handleTypingStop = (data: { conversationId?: string; userId?: string }) => {
      if (data.conversationId === convId && data.userId !== user?.id) {
        setTypingUser(null);
      }
    };

    const handleUserOnline = (data: { userId?: string }) => {
      if (data.userId === params.recipientId) setIsOnline(true);
    };

    const handleUserOffline = (data: { userId?: string }) => {
      if (data.userId === params.recipientId) setIsOnline(false);
    };

    const handleLastSeen = (data: { userId?: string; isOnline?: boolean }) => {
      if (data.userId === params.recipientId) {
        setIsOnline(Boolean(data.isOnline));
      }
    };

    const handleMessageStatus = (data: {
      conversationId?: string;
      messageId?: string;
      status?: ChatMessage["status"];
    }) => {
      if (data.conversationId === convId && data.messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId ? { ...m, status: data.status ?? m.status } : m,
          ),
        );
      }
    };

    const handleMessagesRead = (data: { conversationId?: string }) => {
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

  const handleSend = useCallback(async () => {
    const text = messageText.trim();
    if (!text || sending) return;

    setSending(true);
    setMessageText("");

    if (isTyping && conversation?._id) {
      setIsTyping(false);
      emitTypingStop(conversation._id);
    }

    if (!conversation?._id) {
      setSending(false);
      return;
    }

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
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    } finally {
      setSending(false);
    }
  }, [conversation?._id, isTyping, messageText, sending, user?.id]);

  useEffect(() => {
    if (displayMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [displayMessages.length]);

  const otherAvatar = useMemo(() => {
    if (!conversation?.participants) return null;
    const other = conversation.participants.find((p) => {
      const pid = p.id || p._id;
      return pid !== user?.id;
    });
    return resolveAbsoluteMediaUrl(other?.profileImageUrl);
  }, [conversation?.participants, user?.id]);

  const handleAudioCall = useCallback(() => {
    const recipientId = typeof params.recipientId === 'string' ? params.recipientId : params.recipientId?.[0];
    if (!recipientId || !user?.id) return;
    const callId = `${user.id}-${recipientId}-${Date.now()}`;
    dispatch(outgoingCallStarted({
      callId,
      remoteUserId: recipientId,
      remoteUserName: contactName,
      remoteUserPhoto: otherAvatar ?? '',
      callType: 'audio',
    }));
    router.push('/outgoing-call' as never);
  }, [params.recipientId, user?.id, contactName, otherAvatar, dispatch, router]);

  const handleVideoCall = useCallback(() => {
    const recipientId = typeof params.recipientId === 'string' ? params.recipientId : params.recipientId?.[0];
    if (!recipientId || !user?.id) return;
    const callId = `${user.id}-${recipientId}-${Date.now()}`;
    dispatch(outgoingCallStarted({
      callId,
      remoteUserId: recipientId,
      remoteUserName: contactName,
      remoteUserPhoto: otherAvatar ?? '',
      callType: 'video',
    }));
    router.push('/outgoing-call' as never);
  }, [params.recipientId, user?.id, contactName, otherAvatar, dispatch, router]);

  const statusLabel = typingUser
    ? "typing..."
    : isOnline
      ? "Online"
      : "Offline";

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const fromMe = isFromMe(item, user?.id);
      const prevMsg = index > 0 ? displayMessages[index - 1] : null;
      const showDateHeader =
        !prevMsg ||
        formatDateHeader(item.createdAt) !== formatDateHeader(prevMsg.createdAt);

      return (
        <View>
          {showDateHeader ? (
            <View className="my-5 items-center">
              <View
                className="rounded-full px-4 py-1.5"
                style={{ backgroundColor: DATE_PILL }}
              >
                <Text
                  className="text-[13px] text-[#6B7280]"
                  style={{ fontFamily: ListifyFonts.medium }}
                >
                  {formatDateHeader(item.createdAt)}
                </Text>
              </View>
            </View>
          ) : null}

          <View
            style={{
              alignSelf: fromMe ? "flex-end" : "flex-start",
              maxWidth: "78%",
              marginBottom: 6,
            }}
          >
            <View
              style={{
                backgroundColor: fromMe ? BRAND : INCOMING_BUBBLE,
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: ListifyFonts.regular,
                  fontSize: 15,
                  lineHeight: 21,
                  color: fromMe ? "#FFFFFF" : TEXT_DARK,
                }}
              >
                {item.content}
              </Text>
            </View>
            <Text
              style={{
                marginTop: 4,
                marginLeft: fromMe ? 0 : 4,
                marginRight: fromMe ? 4 : 0,
                alignSelf: fromMe ? "flex-end" : "flex-start",
                fontFamily: ListifyFonts.regular,
                fontSize: 12,
                color: TEXT_MUTED,
              }}
            >
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    },
    [displayMessages, user?.id],
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: CHAT_BG }}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: CHAT_BG }}>
      {/* Header — reference style */}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: BAR_BG,
          borderBottomWidth: 1,
          borderBottomColor: "#EBEBEB",
        }}
      >
        <View className="h-[60px] flex-row items-center px-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <MaterialIcons name="arrow-back-ios" size={20} color={TEXT_DARK} />
          </Pressable>

          {otherAvatar ? (
            <Image
              source={otherAvatar}
              contentFit="cover"
              className="ml-1 h-11 w-11 rounded-full"
            />
          ) : (
            <View className="ml-1 h-11 w-11 items-center justify-center rounded-full bg-[#D1D5DB]">
              <MaterialIcons name="person" size={22} color="#6B7280" />
            </View>
          )}

          <View className="ml-3 flex-1">
            <Text
              className="text-[17px] text-[#1A1A1A]"
              style={{ fontFamily: ListifyFonts.semiBold }}
              numberOfLines={1}
            >
              {contactName}
            </Text>
            <Text
              className="text-[13px]"
              style={{
                fontFamily: ListifyFonts.regular,
                color: typingUser ? BRAND : isOnline ? "#22C55E" : TEXT_MUTED,
              }}
            >
              {statusLabel}
            </Text>
          </View>

          <Pressable
            onPress={handleAudioCall}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <MaterialIcons name="call" size={24} color={TEXT_DARK} />
          </Pressable>
          <Pressable
            onPress={handleVideoCall}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <MaterialIcons name="videocam" size={24} color={TEXT_DARK} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 12,
            flexGrow: 1,
          }}
          style={{ flex: 1, backgroundColor: CHAT_BG }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />

        <View
          style={{
            backgroundColor: BAR_BG,
            paddingTop: 10,
            paddingHorizontal: 12,
            borderTopWidth: 1,
            borderTopColor: "#EBEBEB",
          }}
        >
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Pressable
              className="h-11 w-11 items-center justify-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <MaterialIcons name="add" size={28} color={TEXT_DARK} />
            </Pressable>

            <View
              className="min-h-[44px] flex-1 flex-row items-center rounded-full bg-white px-4"
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <TextInput
                value={messageText}
                onChangeText={handleTextChange}
                placeholder="Message"
                placeholderTextColor={TEXT_MUTED}
                multiline
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={handleSend}
                onFocus={scrollToBottom}
                className="max-h-24 flex-1 py-2.5 text-[16px] text-[#1A1A1A]"
                style={{ fontFamily: ListifyFonts.regular }}
              />
              <Pressable
                onPress={canSend ? handleSend : undefined}
                disabled={sending}
                className="ml-1 h-8 w-8 items-center justify-center"
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : canSend ? 1 : 0.85,
                })}
              >
                <MaterialIcons
                  name={canSend ? "send" : "mic"}
                  size={canSend ? 20 : 22}
                  color={canSend ? BRAND : TEXT_DARK}
                />
              </Pressable>
            </View>

            <Pressable
              className="h-11 w-11 items-center justify-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <MaterialIcons name="photo-camera" size={26} color={TEXT_DARK} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
