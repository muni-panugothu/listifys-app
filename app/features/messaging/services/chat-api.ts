import { requestJson } from "@/features/auth/services/auth-api";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ChatParticipant = {
  id: string;
  _id?: string;
  name: string;
  profileImageUrl?: string | null;
  provider?: string;
};

export type ProductThread = {
  _id: string;
  conversation: string;
  product: {
    productId: string;
    productType: string;
    title: string | null;
    price: number | null;
    image: string | null;
    currency: string;
  };
  seller: ChatParticipant | string;
  buyer: ChatParticipant | string;
  status: "active" | "closed" | "sold" | "expired";
  closedReason?: string | null;
  startedAt: string;
  closedAt?: string | null;
  lastMessageAt: string;
  offerStatus: "none" | "pending" | "accepted" | "declined" | "countered";
  activeOffer?: {
    amount: number | null;
    currency: string;
    offeredBy: string | null;
    offeredAt: string | null;
  };
  unreadCounts?: Record<string, number>;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  _id: string;
  conversation: string;
  productThread: string | null;
  sender: string | ChatParticipant;
  content: string;
  messageType: "text" | "image" | "video" | "audio" | "document" | "offer" | "system";
  offerData?: {
    amount: number | null;
    currency: string;
    status: "pending" | "accepted" | "declined" | "countered" | null;
  } | null;
  attachments?: Array<{
    name: string;
    url: string;
    mimeType: string;
    size: number;
    type: string;
  }>;
  status: "sent" | "delivered" | "read";
  replyTo?: {
    _id: string;
    sender?: ChatParticipant;
    content?: string;
    attachments?: Array<{ name: string; url: string; mimeType: string; size: number; type: string }>;
    createdAt?: string;
  } | string | null;
  reactions?: Array<{ user: string; emoji: string }>;
  deletedFor?: string[];
  deletedForEveryone?: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type Conversation = {
  _id: string;
  participants: ChatParticipant[];
  listing?: {
    listingId?: string | null;
    listingType?: string | null;
    listingTitle?: string | null;
    listingPrice?: number | null;
    listingImage?: string | null;
    currency?: string | null;
  };
  threadCount?: number;
  activeThreadCount?: number;
  lastMessage?: {
    _id: string;
    content: string;
    sender: string;
    attachments?: Array<{ type: string }>;
    productThread?: string | null;
    messageType?: string;
    createdAt: string;
  } | null;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type MessagesPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

// ── Conversation API ───────────────────────────────────────────────────────────

/** Get or create the conversation for a user pair. Optionally bootstraps a product thread. */
export function getOrCreateConversation(data: {
  recipientId: string;
  productId?: string;
  productType?: string;
  productTitle?: string;
  productPrice?: number;
  productImage?: string;
  currency?: string;
}) {
  return requestJson<{
    success: boolean;
    conversation: Conversation;
    thread: ProductThread | null;
  }>("/api/chat/conversations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Get all conversations for the current user */
export function getConversations(page = 1, limit = 20) {
  return requestJson<{
    success: boolean;
    conversations: Conversation[];
    pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
  }>(`/api/chat/conversations?page=${page}&limit=${limit}`, { method: "GET" });
}

// ── Product Thread API ─────────────────────────────────────────────────────────

/** Get or create a product thread within a conversation */
export function getOrCreateThread(conversationId: string, data: {
  productId: string;
  productType: string;
  productTitle?: string;
  productPrice?: number;
  productImage?: string;
  currency?: string;
  sellerId: string;
}) {
  return requestJson<{ success: boolean; thread: ProductThread }>(
    `/api/chat/conversations/${conversationId}/threads`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

/** List all product threads in a conversation */
export function listThreads(conversationId: string, status: "active" | "sold" | "all" = "all") {
  return requestJson<{ success: boolean; threads: ProductThread[] }>(
    `/api/chat/conversations/${conversationId}/threads?status=${status}`,
    { method: "GET" },
  );
}

/** Close a thread (product sold) */
export function closeThread(threadId: string, reason: "sold" | "user_closed" = "sold") {
  return requestJson<{ success: boolean; thread: ProductThread }>(
    `/api/chat/threads/${threadId}/close`,
    { method: "PUT", body: JSON.stringify({ reason }) },
  );
}

// ── Message API ────────────────────────────────────────────────────────────────

/** Get messages for a conversation (optionally filtered to a thread) */
export function getMessages(conversationId: string, page = 1, limit = 50, threadId?: string) {
  const qs = `page=${page}&limit=${limit}${threadId ? `&threadId=${threadId}` : ""}`;
  return requestJson<{
    success: boolean;
    messages: ChatMessage[];
    pagination: MessagesPagination;
  }>(`/api/chat/conversations/${conversationId}/messages?${qs}`, { method: "GET" });
}

/** Get messages for a specific thread */
export function getThreadMessages(threadId: string, page = 1, limit = 50) {
  return requestJson<{
    success: boolean;
    messages: ChatMessage[];
    pagination: MessagesPagination;
  }>(`/api/chat/threads/${threadId}/messages?page=${page}&limit=${limit}`, { method: "GET" });
}

/** Send a message inside a product thread */
export function sendMessageApi(
  conversationId: string,
  data: { content: string; threadId: string; replyTo?: string; attachments?: Array<{ name: string; url: string; key: string; mimeType: string; size: number; type: string }> },
) {
  return requestJson<{ success: boolean; message: ChatMessage }>(
    `/api/chat/conversations/${conversationId}/messages`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

/** Mark conversation as read */
export function markConversationRead(conversationId: string) {
  return requestJson<{ success: boolean }>(`/api/chat/conversations/${conversationId}/read`, { method: "PUT" });
}

/** Mark a single thread as read */
export function markThreadRead(threadId: string) {
  return requestJson<{ success: boolean }>(`/api/chat/threads/${threadId}/read`, { method: "PUT" });
}

/** Search messages in a conversation */
export function searchMessages(conversationId: string, query: string, threadId?: string, page = 1) {
  const qs = `q=${encodeURIComponent(query)}&page=${page}${threadId ? `&threadId=${threadId}` : ""}`;
  return requestJson<{ success: boolean; messages: ChatMessage[] }>(
    `/api/chat/conversations/${conversationId}/search?${qs}`,
    { method: "GET" },
  );
}

/** Get total unread count */
export function getUnreadCount() {
  return requestJson<{ success: boolean; unreadCount: number }>("/api/chat/unread-count", { method: "GET" });
}

// ── Offer API ──────────────────────────────────────────────────────────────────

/** Make an offer on a product thread */
export function makeOffer(threadId: string, amount: number, currency = "₹") {
  return requestJson<{ success: boolean; thread: ProductThread; message: ChatMessage }>(
    `/api/chat/threads/${threadId}/offer`,
    { method: "POST", body: JSON.stringify({ amount, currency }) },
  );
}

/** Accept an offer */
export function acceptOffer(threadId: string) {
  return requestJson<{ success: boolean; thread: ProductThread; message: ChatMessage }>(
    `/api/chat/threads/${threadId}/offer/accept`,
    { method: "PUT" },
  );
}

/** Decline an offer */
export function declineOffer(threadId: string) {
  return requestJson<{ success: boolean; thread: ProductThread; message: ChatMessage }>(
    `/api/chat/threads/${threadId}/offer/decline`,
    { method: "PUT" },
  );
}
