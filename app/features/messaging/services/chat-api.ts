import { requestJson } from "@/features/auth/services/auth-api";

// ── Types ──
export type ChatParticipant = {
  id: string;
  _id?: string;
  name: string;
  profileImageUrl?: string | null;
  provider?: string;
};

export type ChatListing = {
  listingId?: string | null;
  listingType?: string | null;
  listingTitle?: string | null;
  listingPrice?: number | null;
  listingImage?: string | null;
  currency?: string | null;
};

export type ChatMessage = {
  _id: string;
  conversation: string;
  sender: string | ChatParticipant;
  content: string;
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
    attachments?: Array<{
      name: string;
      url: string;
      mimeType: string;
      size: number;
      type: string;
    }>;
    createdAt?: string;
  } | string | null;
  reactions?: Array<{
    user: string;
    emoji: string;
  }>;
  deletedFor?: string[];
  createdAt: string;
  updatedAt?: string;
};

export type Conversation = {
  _id: string;
  participants: ChatParticipant[];
  listing?: ChatListing;
  lastMessage?: {
    _id: string;
    content: string;
    sender: string;
    attachments?: Array<{ type: string }>;
    createdAt: string;
  } | null;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
};

// ── API Calls ──

/** Create or get an existing conversation */
export function getOrCreateConversation(data: {
  recipientId: string;
  listingId?: string;
  listingType?: string;
  listingTitle?: string;
  listingPrice?: number;
  listingImage?: string;
  currency?: string;
}) {
  return requestJson<{
    success: boolean;
    conversation: Conversation;
    created: boolean;
  }>("/api/chat/conversations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Get all conversations for current user */
export function getConversations() {
  return requestJson<{
    success: boolean;
    conversations: Conversation[];
  }>("/api/chat/conversations", {
    method: "GET",
  });
}

/** Get messages for a conversation */
export function getMessages(conversationId: string, page = 1, limit = 50) {
  return requestJson<{
    success: boolean;
    messages: ChatMessage[];
    pagination: { page: number; limit: number; totalPages: number; total: number };
  }>(`/api/chat/conversations/${conversationId}/messages?page=${page}&limit=${limit}`, {
    method: "GET",
  });
}

/** Send a message */
export function sendMessageApi(conversationId: string, content: string, replyTo?: string) {
  return requestJson<{
    success: boolean;
    message: ChatMessage;
  }>(`/api/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, ...(replyTo ? { replyTo } : {}) }),
  });
}

/** Mark conversation as read */
export function markConversationRead(conversationId: string) {
  return requestJson<{ success: boolean }>(`/api/chat/conversations/${conversationId}/read`, {
    method: "PUT",
  });
}

/** Get total unread count */
export function getUnreadCount() {
  return requestJson<{ success: boolean; unreadCount: number }>("/api/chat/unread-count", {
    method: "GET",
  });
}
