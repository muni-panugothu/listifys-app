/**
 * Call signaling via the existing Socket.IO connection.
 * All call events are routed through the shared socket from messaging/socket-service.
 */
import { getSocket, connectSocket } from '@/features/messaging/services/socket-service';
import { store } from '@/store';
import {
  incomingCallReceived,
  callConnected,
  callEnded,
  type CallType,
} from '@/store/slices/call-slice';
import { router } from 'expo-router';

function getOrConnect() {
  try {
    const s = getSocket();
    return s?.connected ? s : connectSocket();
  } catch {
    return null;
  }
}

/** Register FCM token with server so it can wake device for offline calls */
export function registerFCMToken(fcmToken: string) {
  const s = getOrConnect();
  s?.emit('call:update-fcm-token', { fcmToken });
}

/** Start an outgoing call. Returns the callId assigned by server. */
export function initiateCall(params: {
  to: string;
  callType: CallType;
  offer: object;
  callerName: string;
  callerPhoto?: string;
}) {
  const s = getOrConnect();
  s?.emit('call:initiate', params);
}

export function acceptCall(to: string, answer: object, callId: string) {
  const s = getOrConnect();
  s?.emit('call:accept', { to, answer, callId });
}

export function rejectCall(to: string, callId: string) {
  const s = getOrConnect();
  s?.emit('call:reject', { to, callId });
}

export function endCall(to: string, callId: string, duration: number, callType: CallType) {
  const s = getOrConnect();
  s?.emit('call:end', { to, callId, duration, callType });
}

export function sendIceCandidate(to: string, candidate: object) {
  const s = getOrConnect();
  s?.emit('call:ice-candidate', { to, candidate });
}

// ── Incoming call event listeners (attach once on app start) ──────────────────

let _listenersAttached = false;

export function attachCallListeners() {
  if (_listenersAttached) return;
  const s = getOrConnect();
  if (!s) {
    // Socket unavailable (no token yet) — will be retried once session hydrates.
    return;
  }

  // Mark attached only after we have a real socket reference.
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

  // Caller receives this when the receiver accepts.
  // Apply the SDP answer to complete the WebRTC handshake.
  s.on('call:accepted', async (data: { answer?: object } | void) => {
    if (data && (data as any).answer) {
      try {
        // Lazy require to avoid circular import with useWebRTC
        const { applyCallAnswer } = require('@/features/calling/hooks/useWebRTC') as
          typeof import('@/features/calling/hooks/useWebRTC');
        await applyCallAnswer((data as any).answer);
      } catch { /* ignore */ }
    }
    store.dispatch(callConnected());
    router.replace('/active-call');
  });

  // Apply ICE candidates forwarded from the remote peer
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
  if (!s) return;
  s.off('call:incoming');
  s.off('call:accepted');
  s.off('call:rejected');
  s.off('call:ended');
  _listenersAttached = false;
}
