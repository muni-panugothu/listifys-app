import { io, type Socket } from "socket.io-client";

import { AUTH_API_BASE_URL, getAccessToken } from "@/features/auth/services/auth-api";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const token = getAccessToken();
  if (!token) {
    throw new Error("No access token available for Socket.IO");
  }

  socket = io(AUTH_API_BASE_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  });

  socket.on("connect", () => {
    // eslint-disable-next-line no-console
    console.log("[Socket] Connected:", socket?.id);
  });

  socket.on("connect_error", (err) => {
    // eslint-disable-next-line no-console
    console.warn("[Socket] Connect error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    // eslint-disable-next-line no-console
    console.log("[Socket] Disconnected:", reason);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

// ── Conversation room management ──
export function joinConversation(conversationId: string) {
  socket?.emit("conversation:join", conversationId);
}

export function leaveConversation(conversationId: string) {
  socket?.emit("conversation:leave", conversationId);
}

// ── Typing indicators ──
export function emitTypingStart(conversationId: string) {
  socket?.emit("typing:start", { conversationId });
}

export function emitTypingStop(conversationId: string) {
  socket?.emit("typing:stop", { conversationId });
}

// ── Message delivery ──
export function emitMessageDelivered(messageId: string, conversationId: string) {
  socket?.emit("message:delivered", { messageId, conversationId });
}

// ── Unread count ──
export function requestUnreadCount() {
  socket?.emit("chat:unreadCount:request");
}

// ── User presence ──
export function requestLastSeen(targetUserId: string) {
  socket?.emit("user:lastSeen", { targetUserId });
}
