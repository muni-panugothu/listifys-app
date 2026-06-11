/**
 * ChatConversationScreen — user-centric marketplace chat.
 *
 * Params (from router):
 *   conversationId   — existing conversation (open from inbox)
 *   recipientId      — open conversation with a user (from profile / listing)
 *   name             — display name of the other user
 *   productId        — product the user tapped "Chat" on
 *   productType      — listing category
 *   productTitle
 *   productPrice
 *   productImage
 *   currency
 *   sellerId         — who owns the listing (may differ from recipientId)
 *
 * Layout:
 *   ┌─ Header (back, avatar, name, call buttons) ──────────────────┐
 *   │  Thread selector tabs (iPhone 15 | MacBook Pro | …)          │
 *   │  ── ProductThreadSection (banner) ────────────────────────── │
 *   │  ── Messages (FlatList) ───────────────────────────────────── │
 *   │  ── Offer card (if offerStatus !== none) ──────────────────── │
 *   └─ Input bar (disabled when thread is closed) ─────────────────┘
 */
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "@/lib/safe-router";
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import {
  ActivityIndicator, Dimensions, FlatList, Keyboard,
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  Text, TextInput, View, Modal, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_SCREEN_BG } from "@/constants/theme";
import { ListifyFonts } from "@/constants/typography";
import { resolveAbsoluteMediaUrl } from "@/features/auth/services/auth-api";
import { normalizeListingChatParams } from "@/lib/listing-chat";
import { showErrorToast } from "@/lib/toast";
import {
  getOrCreateConversation, listThreads, getThreadMessages,
  sendMessageApi, markThreadRead, markConversationRead,
  makeOffer, acceptOffer, declineOffer, closeThread,
  type ProductThread, type ChatMessage, type Conversation,
} from "@/features/messaging/services/chat-api";
import { ProductThreadSection } from "@/features/messaging/components/product-thread-section";
import { OfferCard } from "@/features/messaging/components/offer-card";
import {
  connectSocket, joinConversation, leaveConversation, joinThread, leaveThread,
  emitTypingStart, emitTypingStop, emitMessageDelivered, getSocket,
} from "@/features/messaging/services/socket-service";
import { Image } from "@/lib/nativewind-interop";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  incomingMessage, threadClosed, offerUpdated,
  setActiveConversation, setActiveThread,
  optimisticMessage, confirmMessage,
} from "@/store/slices/messaging-slice";
import { outgoingCallStarted } from "@/store/slices/call-slice";

const BRAND         = "#27BB97";
const CHAT_BG       = APP_SCREEN_BG;
const BAR_BG        = APP_SCREEN_BG;
const INCOMING_BG   = "#E8E8E8";
const OFFER_BG      = "#EFF6FF";
const SYSTEM_BG     = "#F3F4F6";
const TEXT_MUTED    = "#9CA3AF";
const TEXT_DARK     = "#1A1A1A";

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
function formatDateHeader(dateStr: string) {
  const d    = new Date(dateStr);
  const now  = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString())  return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function dedup(msgs: ChatMessage[]) {
  const m = new Map<string, ChatMessage>();
  for (const msg of msgs) m.set(msg._id, msg);
  return Array.from(m.values());
}
function sortChron(msgs: ChatMessage[]) {
  return dedup(msgs).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
function senderId(m: ChatMessage) {
  return typeof m.sender === "string" ? m.sender : (m.sender as any)?.id ?? (m.sender as any)?._id ?? "";
}
function isFromMe(m: ChatMessage, uid?: string) { return senderId(m) === uid; }

export function ChatConversationScreen() {
  const router  = useRouter();
  const rawParams = useLocalSearchParams<Record<string, string | string[] | undefined>>();
  const chatParams = useMemo(() => normalizeListingChatParams(rawParams), [rawParams]);
  const params = chatParams;
  const insets  = useSafeAreaInsets();
  const user    = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [conversation, setConversation]  = useState<Conversation | null>(null);
  const [threads,      setThreads]       = useState<ProductThread[]>([]);
  const [activeThread, setActiveThreadSt] = useState<ProductThread | null>(null);
  const [messages,     setMessages]      = useState<ChatMessage[]>([]);
  const [loading,      setLoading]       = useState(true);

  const [messageText, setMessageText]    = useState("");
  const [sending,     setSending]        = useState(false);
  const [isTyping,    setIsTyping]       = useState(false);
  const [typingUser,  setTypingUser]     = useState<string | null>(null);

  const [offerInput,  setOfferInput]     = useState("");
  const [offerModal,  setOfferModal]     = useState(false);

  const flatRef    = useRef<FlatList>(null);
  const typingRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const footerPad  = Math.max(insets.bottom, 10);
  const canSend    = messageText.trim().length > 0 && !!activeThread && activeThread.status === "active";
  const isSeller   = activeThread ? String((activeThread.seller as any)?.id ?? activeThread.seller) === user?.id : false;

  const [androidKbPad, setAndroidKbPad] = useState(0);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  useEffect(() => {
    const sub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", scrollToBottom);
    return () => sub.remove();
  }, [scrollToBottom]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setAndroidKbPad(Math.max(0, Dimensions.get("window").height - e.endCoordinates.screenY));
      scrollToBottom();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setAndroidKbPad(0));
    return () => { show.remove(); hide.remove(); };
  }, [scrollToBottom]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 1. Get or create conversation
        let convId = params.conversationId;
        let bootstrapThread: ProductThread | null = null;

        if (!convId && params.recipientId) {
          const res = await getOrCreateConversation({
            recipientId:   params.recipientId,
            productId:     params.productId,
            productType:   params.productType,
            productTitle:  params.productTitle,
            productPrice:  params.productPrice ? Number(params.productPrice) : undefined,
            productImage:  params.productImage,
            currency:      params.currency,
          });
          if (cancelled) return;
          convId           = res.conversation._id;
          bootstrapThread  = res.thread;
          setConversation(res.conversation);
        }

        if (!convId) return;

        if (!conversation) {
          setConversation({
            _id: convId,
            participants: [],
            listing: params.productId ? {
              listingId: params.productId,
              listingType: params.productType || undefined,
              listingTitle: params.productTitle || undefined,
              listingPrice: params.productPrice ? Number(params.productPrice) : undefined,
              listingImage: params.productImage ?? undefined,
              currency: params.currency || "₹",
            } : null,
            threadCount: 0,
            activeThreadCount: 0,
            lastMessage: null,
            unreadCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Conversation);
        }

        // 2. Load all threads
        const threadsRes = await listThreads(convId, "all");
        if (cancelled) return;
        const allThreads = threadsRes.threads;
        setThreads(allThreads);
        dispatch(setActiveConversation(convId));

        // 3. Determine which thread to open
        let initialThread: ProductThread | null = null;
        if (bootstrapThread) {
          initialThread = bootstrapThread;
        } else if (params.productId) {
          initialThread = allThreads.find((t) => String(t.product.productId) === params.productId) ?? allThreads[0] ?? null;
        } else {
          // Open most-recently-active thread
          initialThread = allThreads.sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
          )[0] ?? null;
        }

        if (initialThread) {
          await openThread(initialThread, convId, false);
        }

        // 4. Socket
        await connectSocket().catch((err) => {
          console.warn("[Chat] Socket connect failed", err);
        });
        joinConversation(convId);
      } catch (e) {
        console.warn("[Chat] Bootstrap error", e);
        showErrorToast(
          "Chat Error",
          e instanceof Error ? e.message : "Could not open this conversation.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Open a thread (load its messages) ─────────────────────────────────────
  const openThread = useCallback(async (thread: ProductThread, convId?: string, animate = true) => {
    setActiveThreadSt(thread);
    dispatch(setActiveThread(thread._id));
    try {
      await connectSocket().catch(() => {});
      const activeConvId = convId ?? conversation?._id;
      if (activeConvId) {
        joinConversation(activeConvId);
      }
      joinThread(thread._id);
      const res = await getThreadMessages(thread._id, 1, 50);
      setMessages(sortChron(res.messages));
      if (animate) scrollToBottom();
      markThreadRead(thread._id).catch(() => {});
    } catch (e) {
      showErrorToast(
        "Chat Error",
        e instanceof Error ? e.message : "Could not load messages for this product.",
      );
    }
  }, [conversation?._id, dispatch, scrollToBottom]);

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMsg = (data: ChatMessage & { threadId?: string }) => {
      if (!conversation) return;
      if (data.productThread === activeThread?._id || data.threadId === activeThread?._id) {
        setMessages((prev) => {
          const all = dedup([...prev, data]);
          return sortChron(all);
        });
        scrollToBottom();
        emitMessageDelivered(data._id, conversation._id);
      }
      dispatch(incomingMessage({ threadId: data.threadId ?? data.productThread ?? "", message: data, conversationId: conversation._id }));
    };

    const onTypingStart = (d: { threadId?: string; userId: string; userName: string }) => {
      if (d.threadId === activeThread?._id || !d.threadId) {
        setTypingUser(d.userName);
        setIsTyping(true);
      }
    };
    const onTypingStop = (d: { threadId?: string }) => {
      if (d.threadId === activeThread?._id || !d.threadId) {
        setIsTyping(false);
        setTypingUser(null);
      }
    };
    const onThreadClosed = (d: { threadId: string; status: string; closedReason: string }) => {
      setThreads((prev) => prev.map((t) => t._id === d.threadId ? { ...t, status: d.status as any, closedReason: d.closedReason } : t));
      if (activeThread?._id === d.threadId) {
        setActiveThreadSt((prev) => prev ? { ...prev, status: d.status as any, closedReason: d.closedReason } : prev);
      }
      dispatch(threadClosed({ threadId: d.threadId, conversationId: conversation?._id ?? "", status: d.status, closedReason: d.closedReason }));
    };
    const onOfferUpdate = (d: { threadId: string; message: ChatMessage; offerStatus: string; accepted: boolean }) => {
      if (d.threadId === activeThread?._id) {
        setMessages((prev) => {
          const all = dedup([...prev, d.message]);
          return sortChron(all);
        });
        setActiveThreadSt((prev) => prev ? { ...prev, offerStatus: d.offerStatus as any } : prev);
        scrollToBottom();
      }
      dispatch(offerUpdated({ threadId: d.threadId, conversationId: conversation?._id ?? "", offerStatus: d.offerStatus, accepted: d.accepted, message: d.message }));
    };

    socket.on("chat:message",      onMsg);
    socket.on("chat:offer",        (d) => { onOfferUpdate({ ...d, accepted: false }); });
    socket.on("chat:offer_update", onOfferUpdate);
    socket.on("thread:closed",     onThreadClosed);
    socket.on("thread:typing:start", onTypingStart);
    socket.on("thread:typing:stop",  onTypingStop);
    socket.on("typing:start",      onTypingStart);
    socket.on("typing:stop",       onTypingStop);

    return () => {
      socket.off("chat:message",      onMsg);
      socket.off("chat:offer",        onOfferUpdate as any);
      socket.off("chat:offer_update", onOfferUpdate);
      socket.off("thread:closed",     onThreadClosed);
      socket.off("thread:typing:start", onTypingStart);
      socket.off("thread:typing:stop",  onTypingStop);
      socket.off("typing:start",      onTypingStart);
      socket.off("typing:stop",       onTypingStop);
    };
  }, [conversation, activeThread, dispatch, scrollToBottom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const convId = conversation?._id ?? params.conversationId;
      if (convId) {
        leaveConversation(convId);
        markConversationRead(convId).catch(() => {});
      }
      if (activeThread) leaveThread(activeThread._id);
      dispatch(setActiveConversation(null));
      dispatch(setActiveThread(null));
    };
  }, [activeThread, conversation, dispatch, params.conversationId]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const convId = conversation?._id ?? params.conversationId;
    if (!canSend || !activeThread || !convId) return;
    const text = messageText.trim();
    setMessageText("");
    setSending(true);

    const tempId  = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      _id: tempId, conversation: convId, productThread: activeThread._id,
      sender: user?.id ?? "", content: text, messageType: "text",
      status: "sent", createdAt: new Date().toISOString(),
    };
    setMessages((prev) => sortChron([...prev, tempMsg]));
    scrollToBottom();

    try {
      const res = await sendMessageApi(convId, { content: text, threadId: activeThread._id });
      setMessages((prev) => {
        const filtered = prev.filter((m) => m._id !== tempId);
        return sortChron([...filtered, res.message]);
      });
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setMessageText(text);
      showErrorToast(
        "Message Failed",
        e instanceof Error ? e.message : "Could not send your message.",
      );
    } finally {
      setSending(false);
    }
  }, [canSend, activeThread, conversation, messageText, params.conversationId, user, scrollToBottom]);

  // ── Typing ─────────────────────────────────────────────────────────────────
  const handleTextChange = useCallback((t: string) => {
    setMessageText(t);
    if (!conversation || !activeThread) return;
    emitTypingStart(conversation._id);
    if (typingRef.current) clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => {
      emitTypingStop(conversation._id);
    }, 2000);
  }, [conversation, activeThread]);

  // ── Offer actions ──────────────────────────────────────────────────────────
  const handleMakeOffer = useCallback(async () => {
    if (!activeThread || !conversation) return;
    const amount = parseFloat(offerInput.replace(/[^\d.]/g, ""));
    if (!amount || amount <= 0) { Alert.alert("Invalid Amount", "Enter a valid offer amount."); return; }
    setOfferModal(false);
    try {
      const res = await makeOffer(activeThread._id, amount);
      setMessages((prev) => sortChron([...prev, res.message]));
      setActiveThreadSt(res.thread);
      scrollToBottom();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to make offer");
    }
  }, [activeThread, conversation, offerInput, scrollToBottom]);

  const handleAcceptOffer = useCallback(async (threadId: string) => {
    try {
      const res = await acceptOffer(threadId);
      setMessages((prev) => sortChron([...prev, res.message]));
      setActiveThreadSt(res.thread);
      setThreads((prev) => prev.map((t) => t._id === threadId ? res.thread : t));
      scrollToBottom();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to accept offer");
    }
  }, [scrollToBottom]);

  const handleDeclineOffer = useCallback(async (threadId: string) => {
    try {
      const res = await declineOffer(threadId);
      setMessages((prev) => sortChron([...prev, res.message]));
      setActiveThreadSt(res.thread);
      setThreads((prev) => prev.map((t) => t._id === threadId ? res.thread : t));
      scrollToBottom();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to decline offer");
    }
  }, [scrollToBottom]);

  // ── Render message item ────────────────────────────────────────────────────
  const renderMessage = useCallback(({ item: msg, index }: { item: ChatMessage; index: number }) => {
    const fromMe = isFromMe(msg, user?.id);
    const showDate =
      index === 0 ||
      formatDateHeader(messages[index - 1]?.createdAt ?? "") !== formatDateHeader(msg.createdAt);

    if (msg.messageType === "system") {
      return (
        <>
          {showDate && (
            <View style={{ alignItems: "center", marginVertical: 8 }}>
              <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 11, color: TEXT_MUTED, backgroundColor: "#E5E7EB", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                {formatDateHeader(msg.createdAt)}
              </Text>
            </View>
          )}
          <View style={{ alignItems: "center", marginVertical: 6 }}>
            <View style={{ backgroundColor: SYSTEM_BG, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 12, color: "#6B7280", textAlign: "center" }}>
                {msg.content}
              </Text>
            </View>
          </View>
        </>
      );
    }

    if (msg.messageType === "offer" && activeThread) {
      return (
        <>
          {showDate && (
            <View style={{ alignItems: "center", marginVertical: 8 }}>
              <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 11, color: TEXT_MUTED, backgroundColor: "#E5E7EB", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                {formatDateHeader(msg.createdAt)}
              </Text>
            </View>
          )}
          <View style={{ alignItems: fromMe ? "flex-end" : "flex-start", marginHorizontal: 12, marginVertical: 4 }}>
            <OfferCard
              message={msg}
              thread={activeThread}
              isSeller={isSeller}
              onAccept={() => handleAcceptOffer(activeThread._id)}
              onDecline={() => handleDeclineOffer(activeThread._id)}
            />
            <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
              {formatTime(msg.createdAt)}
            </Text>
          </View>
        </>
      );
    }

    return (
      <>
        {showDate && (
          <View style={{ alignItems: "center", marginVertical: 8 }}>
            <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 11, color: TEXT_MUTED, backgroundColor: "#E5E7EB", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
              {formatDateHeader(msg.createdAt)}
            </Text>
          </View>
        )}
        <View
          style={{
            alignItems: fromMe ? "flex-end" : "flex-start",
            marginHorizontal: 12,
            marginVertical: 2,
          }}
        >
          <View
            style={{
              backgroundColor: fromMe ? BRAND : INCOMING_BG,
              borderRadius: 16,
              borderBottomRightRadius: fromMe ? 4 : 16,
              borderBottomLeftRadius:  fromMe ? 16 : 4,
              paddingHorizontal: 12,
              paddingVertical:    8,
              maxWidth: "78%",
            }}
          >
            <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 14, color: fromMe ? "#fff" : TEXT_DARK, lineHeight: 20 }}>
              {msg.deletedForEveryone ? (
                <Text style={{ fontStyle: "italic", color: fromMe ? "rgba(255,255,255,0.7)" : TEXT_MUTED }}>This message was deleted</Text>
              ) : msg.content}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, gap: 4 }}>
            <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 10, color: TEXT_MUTED }}>
              {formatTime(msg.createdAt)}
            </Text>
            {fromMe && (
              <Text style={{ fontSize: 10, color: msg.status === "read" ? BRAND : TEXT_MUTED }}>
                {msg.status === "read" ? "✓✓" : msg.status === "delivered" ? "✓✓" : "✓"}
              </Text>
            )}
          </View>
        </View>
      </>
    );
  }, [messages, user, activeThread, isSeller, handleAcceptOffer, handleDeclineOffer]);

  const isClosed = activeThread?.status !== "active";

  // ── Contact name ───────────────────────────────────────────────────────────
  const contactName = useMemo(() => {
    if (typeof params.name === "string") return params.name;
    if (!conversation) return "Chat";
    const other = conversation.participants.find((p) => p.id !== user?.id);
    return other?.name ?? "Chat";
  }, [params.name, conversation, user]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CHAT_BG, alignItems: "center", justifyContent: "center", paddingTop: insets.top }}>
        <ActivityIndicator color={BRAND} />
      </View>
    );
  }

  const inputBottomPad = Platform.OS === "android"
    ? androidKbPad > 0 ? androidKbPad : footerPad
    : footerPad;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: CHAT_BG }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 10,
          paddingHorizontal: 16,
          backgroundColor: BAR_BG,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={TEXT_DARK} />
        </Pressable>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND + "22", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: ListifyFonts.semibold, fontSize: 16, color: BRAND }}>
            {contactName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: ListifyFonts.semibold, fontSize: 15, color: TEXT_DARK }} numberOfLines={1}>{contactName}</Text>
          {isTyping && typingUser && (
            <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 11, color: BRAND }}>typing…</Text>
          )}
        </View>
        <Pressable
          onPress={() => {
            if (!conversation) return;
            const other = conversation.participants.find((p) => p.id !== user?.id);
            if (other) dispatch(outgoingCallStarted({ remoteUserId: other.id, remoteUserName: other.name, callType: "audio" }));
          }}
          hitSlop={10}
          style={{ padding: 6 }}
        >
          <MaterialIcons name="call" size={22} color={BRAND} />
        </Pressable>
      </View>

      {/* ── Thread tabs ────────────────────────────────────────────────────── */}
      {threads.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 44, backgroundColor: BAR_BG, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}
          contentContainerStyle={{ paddingHorizontal: 12, alignItems: "center", gap: 8 }}
        >
          {threads.map((t) => {
            const isActive = t._id === activeThread?._id;
            const isSold   = t.status !== "active";
            return (
              <Pressable
                key={t._id}
                onPress={() => openThread(t, conversation?._id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical:   6,
                  borderRadius:      20,
                  backgroundColor:   isActive ? BRAND : "#F3F4F6",
                  borderWidth:       1,
                  borderColor:       isActive ? BRAND : "#E5E7EB",
                  flexDirection:     "row",
                  alignItems:        "center",
                  gap:               4,
                }}
              >
                {isSold && <Text style={{ fontSize: 10 }}>🔒</Text>}
                <Text
                  style={{
                    fontFamily: ListifyFonts.semibold,
                    fontSize:   12,
                    color:      isActive ? "#fff" : isSold ? "#9CA3AF" : TEXT_DARK,
                  }}
                  numberOfLines={1}
                >
                  {t.product?.title?.slice(0, 18) ?? "Product"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Thread section banner ───────────────────────────────────────────── */}
      {activeThread && (
        <ProductThreadSection
          thread={activeThread}
          isExpanded={true}
          onToggle={() => {}}
        />
      )}

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m._id}
        renderItem={renderMessage}
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 4 }}
        onContentSizeChange={scrollToBottom}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 14, color: TEXT_MUTED }}>
              {activeThread ? "Send the first message!" : "Select a product thread above"}
            </Text>
          </View>
        }
        ListFooterComponent={
          isTyping ? (
            <View style={{ alignItems: "flex-start", marginHorizontal: 12, marginBottom: 6 }}>
              <View style={{ backgroundColor: INCOMING_BG, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 14, color: TEXT_MUTED, letterSpacing: 4 }}>•••</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* ── Closed banner ───────────────────────────────────────────────────── */}
      {isClosed && (
        <View style={{ backgroundColor: "#FEF2F2", paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" }}>
          <Text style={{ fontFamily: ListifyFonts.semibold, fontSize: 13, color: "#EF4444" }}>
            🔒 Conversation Closed{activeThread?.closedReason === "sold" ? " — Product Sold" : ""}
          </Text>
          <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
            Message history is preserved
          </Text>
        </View>
      )}

      {/* ── Input bar ────────────────────────────────────────────────────────── */}
      {!isClosed && (
        <View
          style={{
            flexDirection:    "row",
            alignItems:       "flex-end",
            paddingHorizontal: 12,
            paddingTop:        8,
            paddingBottom:     inputBottomPad,
            backgroundColor:  BAR_BG,
            borderTopWidth:   1,
            borderTopColor:   "#E5E7EB",
            gap:              8,
          }}
        >
          {/* Offer button (buyer only) */}
          {!isSeller && activeThread?.status === "active" && activeThread.offerStatus === "none" && (
            <Pressable
              onPress={() => setOfferModal(true)}
              style={{ padding: 8, borderRadius: 8, backgroundColor: BRAND + "15" }}
            >
              <Text style={{ fontSize: 18 }}>💰</Text>
            </Pressable>
          )}

          {/* Text input */}
          <TextInput
            style={{
              flex:              1,
              minHeight:         40,
              maxHeight:         120,
              backgroundColor:   "#F3F4F6",
              borderRadius:      20,
              paddingHorizontal: 16,
              paddingVertical:   10,
              fontFamily:        ListifyFonts.regular,
              fontSize:          14,
              color:             TEXT_DARK,
            }}
            placeholder="Type a message…"
            placeholderTextColor={TEXT_MUTED}
            value={messageText}
            onChangeText={handleTextChange}
            multiline
            returnKeyType="default"
          />

          {/* Send */}
          <Pressable
            onPress={handleSend}
            disabled={!canSend || sending}
            style={{
              width:           40,
              height:          40,
              borderRadius:    20,
              backgroundColor: canSend ? BRAND : "#E5E7EB",
              alignItems:      "center",
              justifyContent:  "center",
            }}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <MaterialIcons name="send" size={20} color={canSend ? "#fff" : "#9CA3AF"} />
            }
          </Pressable>
        </View>
      )}

      {/* ── Offer modal ──────────────────────────────────────────────────────── */}
      <Modal visible={offerModal} transparent animationType="slide" onRequestClose={() => setOfferModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setOfferModal(false)} />
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius:  20,
            borderTopRightRadius: 20,
            padding:              24,
            paddingBottom:        insets.bottom + 24,
          }}
        >
          <Text style={{ fontFamily: ListifyFonts.bold, fontSize: 18, color: TEXT_DARK, marginBottom: 4 }}>Make an Offer</Text>
          {activeThread?.product?.title && (
            <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 13, color: TEXT_MUTED, marginBottom: 16 }}>
              for {activeThread.product.title}
              {activeThread.product.price != null
                ? ` (Listed: ${activeThread.product.currency}${activeThread.product.price.toLocaleString("en-IN")})`
                : ""}
            </Text>
          )}
          <TextInput
            style={{
              borderWidth:       1,
              borderColor:       "#D1D5DB",
              borderRadius:      12,
              paddingHorizontal: 16,
              paddingVertical:   12,
              fontFamily:        ListifyFonts.semibold,
              fontSize:          18,
              color:             TEXT_DARK,
              marginBottom:      16,
            }}
            placeholder={`₹ Your offer amount`}
            placeholderTextColor={TEXT_MUTED}
            keyboardType="numeric"
            value={offerInput}
            onChangeText={setOfferInput}
            autoFocus
          />
          <Pressable
            onPress={handleMakeOffer}
            style={({ pressed }) => ({
              backgroundColor: pressed ? "#059669" : BRAND,
              borderRadius:    12,
              paddingVertical: 14,
              alignItems:      "center",
            })}
          >
            <Text style={{ fontFamily: ListifyFonts.bold, fontSize: 16, color: "#fff" }}>Send Offer</Text>
          </Pressable>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
