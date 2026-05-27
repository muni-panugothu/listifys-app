/**
 * useWebRTC — module-level singleton WebRTC service
 *
 * RTCPeerConnection, local stream and remote stream live at MODULE scope so
 * they survive React unmount/mount cycles during navigation
 * (OutgoingCallScreen → ActiveCallScreen, etc.).
 *
 * Subscribers (React components) are notified via a Set<() => void> and
 * re-render by incrementing a local counter.
 */
import { useEffect, useState } from 'react';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { callConnected, callEnded, toggleMute, toggleCamera } from '@/store/slices/call-slice';
import { sendIceCandidate } from '@/features/calling/services/call-socket-service';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers for production (different mobile networks):
    // { urls: 'turn:your-turn.server.com', username: 'u', credential: 'p' }
  ],
};

// ── Module-level singleton (survives navigation) ───────────────────────────────
let _pc: RTCPeerConnection | null = null;
let _localStream: MediaStream | null = null;
let _remoteStream: MediaStream | null = null;
let _localStreamURL = '';
let _remoteStreamURL = '';
let _isFrontCamera = true;
let _remoteUserIdForICE: string | null = null;

const _subs = new Set<() => void>();
function _notify() { _subs.forEach((fn) => fn()); }

/** Reset singleton — stop all tracks, close PC */
export function resetWebRTC() {
  _pc?.close();
  _pc = null;
  _localStream?.getTracks().forEach((t) => t.stop());
  _localStream = null;
  _remoteStream = null;
  _localStreamURL  = '';
  _remoteStreamURL = '';
  _isFrontCamera = true;
  _remoteUserIdForICE = null;
  _notify();
}

/**
 * Apply SDP answer from receiver. Called from call-socket-service when
 * `call:accepted` is received by the caller.
 */
export async function applyCallAnswer(answer: object): Promise<void> {
  if (!_pc) return;
  await _pc.setRemoteDescription(new RTCSessionDescription(answer as any));
}

/** Add an ICE candidate from the remote peer. Called from call-socket-service. */
export async function addCallIceCandidate(candidate: object): Promise<void> {
  if (!_pc) return;
  try {
    await _pc.addIceCandidate(new RTCIceCandidate(candidate as any));
  } catch { /* ignore benign ICE errors */ }
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useWebRTC() {
  const dispatch  = useAppDispatch();
  const callState = useAppSelector((s) => s.call);

  // Re-render this component whenever singleton state changes (stream URLs etc.)
  const [, setTick] = useState(0);
  useEffect(() => {
    const trigger = () => setTick((n) => n + 1);
    _subs.add(trigger);
    return () => { _subs.delete(trigger); };
  }, []);

  // Keep remoteUserId reachable inside ICE callbacks without closures
  useEffect(() => {
    _remoteUserIdForICE = callState.remoteUserId;
  }, [callState.remoteUserId]);

  // Clean up streams when call ends
  useEffect(() => {
    if (callState.status === 'idle' || callState.status === 'ended') {
      resetWebRTC();
    }
  }, [callState.status]);

  function _buildPC(): RTCPeerConnection {
    const conn = new RTCPeerConnection(ICE_SERVERS as any) as any;

    conn.onicecandidate = (event: any) => {
      if (event.candidate && _remoteUserIdForICE) {
        sendIceCandidate(_remoteUserIdForICE, event.candidate.toJSON?.() ?? event.candidate);
      }
    };

    conn.ontrack = (event: any) => {
      const streams: MediaStream[] = event.streams;
      _remoteStream = streams[0] ?? null;
      if (streams[0]) {
        _remoteStreamURL = (streams[0] as any).toURL();
        _notify();
      }
    };

    conn.onconnectionstatechange = () => {
      const state: string | undefined = conn.connectionState;
      if (state === 'connected') {
        dispatch(callConnected());
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        dispatch(callEnded());
      }
    };

    return conn as RTCPeerConnection;
  }

  async function _startLocalStream(video: boolean) {
    const stream = await mediaDevices.getUserMedia({ audio: true, video });
    _localStream = stream;
    _localStreamURL = (stream as any).toURL();
    _notify();
    return stream;
  }

  async function createOffer(callType: 'audio' | 'video') {
    const stream = await _startLocalStream(callType === 'video');
    _pc = _buildPC();
    stream.getTracks().forEach((t) => _pc!.addTrack(t, stream));
    const offer = await _pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === 'video',
    } as any);
    await _pc.setLocalDescription(new RTCSessionDescription(offer as any));
    return offer;
  }

  async function answerCall(offer: object, callType: 'audio' | 'video') {
    const stream = await _startLocalStream(callType === 'video');
    _pc = _buildPC();
    stream.getTracks().forEach((t) => _pc!.addTrack(t, stream));
    await _pc.setRemoteDescription(new RTCSessionDescription(offer as any));
    const answer = await _pc.createAnswer();
    await _pc.setLocalDescription(new RTCSessionDescription(answer as any));
    return answer;
  }

  function muteLocalAudio(muted: boolean) {
    _localStream?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    dispatch(toggleMute());
  }

  function setLocalVideoEnabled(enabled: boolean) {
    _localStream?.getVideoTracks().forEach((t) => { t.enabled = enabled; });
    dispatch(toggleCamera());
  }

  function flipCamera() {
    const videoTrack = _localStream?.getVideoTracks()[0];
    if (videoTrack) {
      (videoTrack as any)._switchCamera();
      _isFrontCamera = !_isFrontCamera;
      _notify();
    }
  }

  function endAndCleanup() {
    resetWebRTC();
    dispatch(callEnded());
  }

  return {
    localStream:    _localStream,
    remoteStream:   _remoteStream,
    localStreamURL: _localStreamURL,
    remoteStreamURL: _remoteStreamURL,
    isFrontCamera:  _isFrontCamera,
    createOffer,
    answerCall,
    muteLocalAudio,
    setLocalVideoEnabled,
    flipCamera,
    endAndCleanup,
  };
}
