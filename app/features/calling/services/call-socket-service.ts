/**
 * Call signaling via the existing Socket.IO connection.
 * All call events are routed through the shared socket from messaging/socket-service.
 */
import type { Socket } from 'socket.io-client';
import { getSocket, connectSocket } from '@/features/messaging/services/socket-service';
import { store } from '@/store';
import {
  incomingCallReceived,
  callConnected,
  callEnded,
  type CallType,
} from '@/store/slices/call-slice';
import { router } from 'expo-router';

async function getOrConnectAsync(): Promise<Socket | null> {
  try {
    const existing = getSocket();
    if (existing?.connected) return existing;
    return await connectSocket();
  } catch {
    return null;
  }
}

/** Fire-and-forget connect for emits when socket may still be connecting. */
function getConnectedOrConnecting(): Socket | null {
  const s = getSocket();
  if (s?.connected) return s;
  void connectSocket().catch(() => {});
  return s;
}

/** Register FCM token with server so it can wake device for offline calls */
export async function registerFCMToken(_fcmToken: string) {
  const { syncFcmTokenWithServer } = await import("@/lib/notifications/sync-fcm-token");
  await syncFcmTokenWithServer({ force: true });
}

/** Start an outgoing call. Returns the callId assigned by server. */
export function initiateCall(params: {
  to: string;
  callType: CallType;
  offer: object;
  callerName: string;
  callerPhoto?: string;
}) {
  const s = getConnectedOrConnecting();
  s?.emit('call:initiate', params);
}

export function acceptCall(to: string, answer: object, callId: string) {
  const s = getConnectedOrConnecting();
  s?.emit('call:accept', { to, answer, callId });
}

export function rejectCall(to: string, callId: string) {
  const s = getConnectedOrConnecting();
  s?.emit('call:reject', { to, callId });
}

export function endCall(to: string, callId: string, duration: number, callType: CallType) {
  const s = getConnectedOrConnecting();
  s?.emit('call:end', { to, callId, duration, callType });
}

export function sendIceCandidate(to: string, candidate: object) {
  const s = getConnectedOrConnecting();
  s?.emit('call:ice-candidate', { to, candidate });
}

// ── Incoming call event listeners (attach once on app start) ──────────────────

let _listenersAttached = false;

function isSocketClient(s: unknown): s is Socket {
  return s != null && typeof (s as Socket).on === 'function';
}

export async function attachCallListeners() {
  if (_listenersAttached) return;

  const s = await getOrConnectAsync();
  if (!isSocketClient(s)) {
    return;
  }

  _listenersAttached = true;

  s.on('call:incoming', (data: {
    callId: string;
    from: string;
    callerName: string;
    callerPhoto: string;
    callType: CallType;
    offer: object;
  }) => {
    store.dispatch(incomingCallReceived({
      callId:          data.callId,
      remoteUserId:    data.from,
      remoteUserName:  data.callerName,
      remoteUserPhoto: data.callerPhoto,
      callType:        data.callType,
      offer:           data.offer,
    }));
    router.push('/incoming-call');
  });

  s.on('call:accepted', async (data: { answer?: object } | void) => {
    if (data && (data as { answer?: object }).answer) {
      try {
        const { applyCallAnswer } = require('@/features/calling/hooks/useWebRTC') as
          typeof import('@/features/calling/hooks/useWebRTC');
        await applyCallAnswer((data as { answer: object }).answer);
      } catch { /* ignore */ }
    }
    store.dispatch(callConnected());
    router.replace('/active-call');
  });

  s.on('call:ice-candidate', async (data: { candidate: object }) => {
    try {
      const { addCallIceCandidate } = require('@/features/calling/hooks/useWebRTC') as
        typeof import('@/features/calling/hooks/useWebRTC');
      await addCallIceCandidate(data.candidate);
    } catch { /* ignore */ }
  });

  s.on('call:rejected', () => {
    store.dispatch(callEnded());
    router.back();
  });

  s.on('call:ended', () => {
    store.dispatch(callEnded());
    router.back();
  });
}

export function detachCallListeners() {
  const s = getSocket();
  if (!isSocketClient(s)) return;
  s.off('call:incoming');
  s.off('call:accepted');
  s.off('call:ice-candidate');
  s.off('call:rejected');
  s.off('call:ended');
  _listenersAttached = false;
}
