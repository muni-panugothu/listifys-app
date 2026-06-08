import { io, type Socket } from "socket.io-client";

import {
  AUTH_API_BASE_URL,
  getAccessToken,
  refreshAccessToken,
  restoreTokens,
} from "@/features/auth/services/auth-api";

let socket: Socket | null = null;
let connectPromise: Promise<Socket> | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    if (!getAccessToken()) {
      await restoreTokens();
    }
    let token = getAccessToken();
    if (!token) {
      await refreshAccessToken();
      token = getAccessToken();
    }
    if (!token) {
      throw new Error("No access token available for Socket.IO");
    }

    if (socket) {
      socket.auth = { token };
      if (!socket.connected) {
        socket.connect();
      }
      return socket;
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
  })().finally(() => {
    connectPromise = null;
  });

  return connectPromise;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  // Allow call listeners to be re-attached on next connect.
  import('@/features/calling/services/call-socket-service')
    .then(({ detachCallListeners }) => detachCallListeners())
    .catch(() => {});
}

// ── Conversation room management ──
export function joinConversation(conversationId: string) {
  socket?.emit("conversation:join", conversationId);
}

export function leaveConversation(conversationId: string) {
  socket?.emit("conversation:leave", conversationId);
}

// ── Product thread room ──
export function joinThread(threadId: string) {
  socket?.emit("thread:join", threadId);
}

export function leaveThread(threadId: string) {
  socket?.emit("thread:leave", threadId);
}

// ── Thread-scoped typing indicators ──
export function emitThreadTypingStart(conversationId: string, threadId: string) {
  socket?.emit("thread:typing:start", { conversationId, threadId });
}

export function emitThreadTypingStop(conversationId: string, threadId: string) {
  socket?.emit("thread:typing:stop", { conversationId, threadId });
}

// ── Typing indicators (conversation-level, kept for compat) ──
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

// ── Message reactions ──
export function emitReact(messageId: string, conversationId: string, emoji: string) {
  socket?.emit("message:react", { messageId, conversationId, emoji });
}

export function emitUnreact(messageId: string, conversationId: string) {
  socket?.emit("message:unreact", { messageId, conversationId });
}

// ── Unread count ──
export function requestUnreadCount() {
  socket?.emit("chat:unreadCount:request");
}

// ── User presence ──
export function requestLastSeen(targetUserId: string) {
  socket?.emit("user:lastSeen", { targetUserId });
}
