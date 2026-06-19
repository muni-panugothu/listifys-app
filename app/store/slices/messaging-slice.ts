import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  getConversations,
  getMessages,
  getThreadMessages,
  listThreads,
  type Conversation,
  type ProductThread,
  type ChatMessage,
} from "@/features/messaging/services/chat-api";

// ── State ─────────────────────────────────────────────────────────────────────
type MessagingState = {
  // Inbox
  conversations: Conversation[];
  conversationsLoading: boolean;
  conversationsError: string | null;

  // Active conversation
  activeConversationId: string | null;
  threads: Record<string, ProductThread[]>; // conversationId → threads[]
  threadsLoading: boolean;

  // Active thread + messages
  activeThreadId: string | null;
  messages: Record<string, ChatMessage[]>;  // threadId → messages[]
  messagesLoading: boolean;
  hasMoreMessages: Record<string, boolean>; // threadId → bool

  // Unread
  totalUnread: number;

  // Offer UI
  offerModalThreadId: string | null;
};

const initialState: MessagingState = {
  conversations:       [],
  conversationsLoading: false,
  conversationsError:  null,

  activeConversationId: null,
  threads:             {},
  threadsLoading:      false,

  activeThreadId:  null,
  messages:        {},
  messagesLoading: false,
  hasMoreMessages: {},

  totalUnread: 0,

  offerModalThreadId: null,
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchConversations = createAsyncThunk(
  "messaging/fetchConversations",
  async (_, { rejectWithValue }) => {
    try {
      const res = await getConversations();
      return res.conversations;
    } catch (e: any) {
      return rejectWithValue(e?.message ?? "Failed to load conversations");
    }
  },
);

export const fetchThreads = createAsyncThunk(
  "messaging/fetchThreads",
  async (
    { conversationId, status }: { conversationId: string; status?: "active" | "sold" | "all" },
    { rejectWithValue },
  ) => {
    try {
      const res = await listThreads(conversationId, status || "all");
      return { conversationId, threads: res.threads };
    } catch (e: any) {
      return rejectWithValue(e?.message ?? "Failed to load threads");
    }
  },
);

export const fetchThreadMessages = createAsyncThunk(
  "messaging/fetchThreadMessages",
  async (
    { threadId, page }: { threadId: string; page?: number },
    { rejectWithValue },
  ) => {
    try {
      const res = await getThreadMessages(threadId, page || 1);
      return { threadId, messages: res.messages, hasMore: res.pagination.hasMore, page: page || 1 };
    } catch (e: any) {
      return rejectWithValue(e?.message ?? "Failed to load messages");
    }
  },
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const messagingSlice = createSlice({
  name: "messaging",
  initialState,
  reducers: {
    setActiveConversation(state, action: PayloadAction<string | null>) {
      state.activeConversationId = action.payload;
    },

    setActiveThread(state, action: PayloadAction<string | null>) {
      state.activeThreadId = action.payload;
    },

    // Called when a new socket message arrives
    incomingMessage(
      state,
      action: PayloadAction<{ threadId: string; message: ChatMessage; conversationId: string }>,
    ) {
      const { threadId, message, conversationId } = action.payload;

      // Prepend to messages map. Three dedup paths:
      //  1. Same server _id           → ignore (already in list).
      //  2. Same clientMessageId      → reconcile the optimistic bubble in place.
      //  3. Neither                   → append at the bottom.
      const existing = state.messages[threadId] ?? [];
      const byId = existing.findIndex((m) => m._id === message._id);
      if (byId >= 0) {
        state.messages[threadId][byId] = { ...existing[byId], ...message };
      } else if (message.clientMessageId) {
        const byCmid = existing.findIndex((m) => m.clientMessageId && m.clientMessageId === message.clientMessageId);
        if (byCmid >= 0) {
          state.messages[threadId][byCmid] = { ...existing[byCmid], ...message };
        } else {
          state.messages[threadId] = [...existing, message];
        }
      } else {
        state.messages[threadId] = [...existing, message];
      }

      // Update conversation lastMessage in inbox list
      const convIdx = state.conversations.findIndex((c) => c._id === conversationId);
      if (convIdx >= 0) {
        state.conversations[convIdx] = {
          ...state.conversations[convIdx],
          lastMessage: {
            _id:          message._id,
            content:      typeof message.content === "string" ? message.content.slice(0, 80) : "",
            sender:       typeof message.sender === "string" ? message.sender : (message.sender as any).id ?? "",
            productThread: threadId,
            createdAt:    message.createdAt,
          },
          updatedAt: message.createdAt,
          unreadCount:
            state.activeThreadId === threadId
              ? 0
              : (state.conversations[convIdx].unreadCount ?? 0) + 1,
        };
        // Bubble conversation to top
        const [conv] = state.conversations.splice(convIdx, 1);
        state.conversations.unshift(conv);
      }

      // Increment total unread if not viewing this thread
      if (state.activeThreadId !== threadId) {
        state.totalUnread = Math.max(0, state.totalUnread + 1);
      }
    },

    // Thread closed by seller
    threadClosed(
      state,
      action: PayloadAction<{ threadId: string; conversationId: string; status: string; closedReason: string }>,
    ) {
      const { threadId, conversationId, status, closedReason } = action.payload;
      const threads = state.threads[conversationId] ?? [];
      const idx = threads.findIndex((t) => t._id === threadId);
      if (idx >= 0) {
        state.threads[conversationId][idx] = {
          ...state.threads[conversationId][idx],
          status: status as ProductThread["status"],
          closedReason,
        };
      }
    },

    // Offer update from socket
    offerUpdated(
      state,
      action: PayloadAction<{ threadId: string; conversationId: string; offerStatus: string; accepted?: boolean; message: ChatMessage }>,
    ) {
      const { threadId, conversationId, offerStatus, message } = action.payload;
      // Update thread offer status
      const threads = state.threads[conversationId] ?? [];
      const idx = threads.findIndex((t) => t._id === threadId);
      if (idx >= 0) {
        state.threads[conversationId][idx] = {
          ...state.threads[conversationId][idx],
          offerStatus: offerStatus as ProductThread["offerStatus"],
        };
      }
      // Append offer message
      const existing = state.messages[threadId] ?? [];
      if (!existing.some((m) => m._id === message._id)) {
        state.messages[threadId] = [...existing, message];
      }
    },

    setTotalUnread(state, action: PayloadAction<number>) {
      state.totalUnread = Math.max(0, action.payload);
    },

    clearThreadMessages(state, action: PayloadAction<string>) {
      delete state.messages[action.payload];
    },

    setOfferModalThread(state, action: PayloadAction<string | null>) {
      state.offerModalThreadId = action.payload;
    },

    // Optimistically append a sent message (before server response)
    optimisticMessage(
      state,
      action: PayloadAction<{ threadId: string; message: ChatMessage }>,
    ) {
      const { threadId, message } = action.payload;
      const existing = state.messages[threadId] ?? [];
      if (!existing.some((m) => m._id === message._id)) {
        state.messages[threadId] = [...existing, message];
      }
    },

    // Replace optimistic message with confirmed server message. We look up by
    // `tempId` first (legacy callers), then by `clientMessageId` (preferred —
    // survives socket echoes arriving before the HTTP response).
    confirmMessage(
      state,
      action: PayloadAction<{ threadId: string; tempId: string; message: ChatMessage }>,
    ) {
      const { threadId, tempId, message } = action.payload;
      const msgs = state.messages[threadId] ?? [];

      let idx = msgs.findIndex((m) => m._id === tempId);
      if (idx < 0 && message.clientMessageId) {
        idx = msgs.findIndex((m) => m.clientMessageId === message.clientMessageId);
      }
      if (idx < 0) {
        idx = msgs.findIndex((m) => m._id === message._id);
      }

      if (idx >= 0) {
        // Preserve any locally-known fields the server doesn't echo (none today,
        // but this protects future additions like upload progress).
        state.messages[threadId][idx] = { ...msgs[idx], ...message };
      } else {
        state.messages[threadId] = [...msgs, message];
      }
    },

    // Apply a delivery/read status update from a single `message:status` event.
    // Status only ever moves forward: sent → delivered → read.
    updateMessageStatus(
      state,
      action: PayloadAction<{
        threadId: string;
        messageId: string;
        status: ChatMessage["status"];
        deliveredAt?: string | null;
        readAt?: string | null;
      }>,
    ) {
      const { threadId, messageId, status, deliveredAt, readAt } = action.payload;
      const msgs = state.messages[threadId];
      if (!msgs) return;
      const idx = msgs.findIndex((m) => m._id === messageId);
      if (idx < 0) return;
      const current = msgs[idx];
      const rank: Record<string, number> = { sending: 0, sent: 1, delivered: 2, read: 3 };
      if (rank[status] >= rank[current.status]) {
        state.messages[threadId][idx] = {
          ...current,
          status,
          ...(deliveredAt ? { deliveredAt } : {}),
          ...(readAt ? { readAt } : {}),
        };
      }
    },

    // Apply a batched `message:status:batch` event. Cheaper than dispatching N
    // updateMessageStatus actions when WhatsApp-style "delivered when opening
    // app" fires for a long thread.
    updateMessageStatusBatch(
      state,
      action: PayloadAction<{
        threadId: string | null;
        status: ChatMessage["status"];
        messageIds: string[];
        at?: string | null;
      }>,
    ) {
      const { threadId, status, messageIds, at } = action.payload;
      const rank: Record<string, number> = { sending: 0, sent: 1, delivered: 2, read: 3 };
      const ids = new Set(messageIds);

      const targets = threadId
        ? [threadId]
        : Object.keys(state.messages);

      for (const tId of targets) {
        const msgs = state.messages[tId];
        if (!msgs) continue;
        for (let i = 0; i < msgs.length; i += 1) {
          if (!ids.has(msgs[i]._id)) continue;
          if (rank[status] < rank[msgs[i].status]) continue;
          msgs[i] = {
            ...msgs[i],
            status,
            ...(status === "delivered" && at ? { deliveredAt: at } : {}),
            ...(status === "read" && at ? { readAt: at, deliveredAt: msgs[i].deliveredAt || at } : {}),
          };
        }
      }
    },

    // ── Deletes ────────────────────────────────────────────────────────────
    // "Delete for everyone" — message stays in the array but is tomb-stoned
    // so existing pagination / counts don't shift. Bubble re-renders as the
    // "This message was deleted" placeholder.
    messageDeletedForEveryone(
      state,
      action: PayloadAction<{ threadId: string; messageId: string }>,
    ) {
      const { threadId, messageId } = action.payload;
      const msgs = state.messages[threadId];
      if (!msgs) return;
      const idx = msgs.findIndex((m) => m._id === messageId);
      if (idx < 0) return;
      msgs[idx] = {
        ...msgs[idx],
        deletedForEveryone: true,
        content: "",
        attachments: [],
        messageType: msgs[idx].messageType === "offer" ? "offer" : "text",
      };
    },

    // "Delete for me" — drop the message from the visible list for this user.
    // Other participants still see it.
    messageDeletedForMe(
      state,
      action: PayloadAction<{ threadId: string; messageId: string }>,
    ) {
      const { threadId, messageId } = action.payload;
      const msgs = state.messages[threadId];
      if (!msgs) return;
      state.messages[threadId] = msgs.filter((m) => m._id !== messageId);
    },

    // Catch-up: apply a list of (messageId, status, timestamps) entries that
    // came back from `message:catchup:request`.
    applyStatusCatchup(
      state,
      action: PayloadAction<{
        threadId: string;
        updates: Array<{
          messageId: string;
          status: ChatMessage["status"];
          deliveredAt: string | null;
          readAt: string | null;
        }>;
      }>,
    ) {
      const { threadId, updates } = action.payload;
      const msgs = state.messages[threadId];
      if (!msgs || updates.length === 0) return;
      const rank: Record<string, number> = { sending: 0, sent: 1, delivered: 2, read: 3 };
      const byId = new Map(updates.map((u) => [u.messageId, u]));
      for (let i = 0; i < msgs.length; i += 1) {
        const u = byId.get(msgs[i]._id);
        if (!u) continue;
        if (rank[u.status] < rank[msgs[i].status]) continue;
        msgs[i] = {
          ...msgs[i],
          status: u.status,
          ...(u.deliveredAt ? { deliveredAt: u.deliveredAt } : {}),
          ...(u.readAt ? { readAt: u.readAt } : {}),
        };
      }
    },

    resetMessaging() {
      return initialState;
    },
  },

  extraReducers: (builder) => {
    builder
      // Conversations
      .addCase(fetchConversations.pending, (state) => {
        state.conversationsLoading = true;
        state.conversationsError   = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversationsLoading = false;
        state.conversations        = action.payload;
        state.totalUnread          = action.payload.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.conversationsLoading = false;
        state.conversationsError   = action.payload as string;
      })

      // Threads
      .addCase(fetchThreads.pending, (state) => {
        state.threadsLoading = true;
      })
      .addCase(fetchThreads.fulfilled, (state, action) => {
        state.threadsLoading = false;
        state.threads[action.payload.conversationId] = action.payload.threads;
      })
      .addCase(fetchThreads.rejected, (state) => {
        state.threadsLoading = false;
      })

      // Thread messages
      .addCase(fetchThreadMessages.pending, (state) => {
        state.messagesLoading = true;
      })
      .addCase(fetchThreadMessages.fulfilled, (state, action) => {
        state.messagesLoading = false;
        const { threadId, messages, hasMore, page } = action.payload;
        if (page === 1) {
          state.messages[threadId] = messages;
        } else {
          // Prepend older messages (pagination goes backwards)
          const existing = state.messages[threadId] ?? [];
          const merged   = [...messages, ...existing];
          const seen     = new Set<string>();
          state.messages[threadId] = merged.filter((m) => {
            if (seen.has(m._id)) return false;
            seen.add(m._id);
            return true;
          });
        }
        state.hasMoreMessages[threadId] = hasMore;
      })
      .addCase(fetchThreadMessages.rejected, (state) => {
        state.messagesLoading = false;
      });
  },
});

export const {
  setActiveConversation,
  setActiveThread,
  incomingMessage,
  threadClosed,
  offerUpdated,
  setTotalUnread,
  clearThreadMessages,
  setOfferModalThread,
  optimisticMessage,
  confirmMessage,
  updateMessageStatus,
  updateMessageStatusBatch,
  applyStatusCatchup,
  messageDeletedForEveryone,
  messageDeletedForMe,
  resetMessaging,
} = messagingSlice.actions;

export default messagingSlice.reducer;
