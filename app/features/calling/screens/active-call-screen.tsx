/**
 * Active Call Screen — WhatsApp-style
 *
 * Video call: remote video fills screen, local PiP in corner, gradient overlays.
 * Audio call: dark gradient bg, centered avatar, mute + speaker + end.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { RTCView } from 'react-native-webrtc';
import { useRouter } from '@/lib/safe-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleSpeaker } from '@/store/slices/call-slice';
import { useWebRTC } from '@/features/calling/hooks/useWebRTC';
import { endCall } from '@/features/calling/services/call-socket-service';
import { setSpeakerphoneOn } from '@/lib/audio-router';
import { MaterialIcons } from '@expo/vector-icons';

// ── Reusable control button ───────────────────────────────────────────────────
function CtrlBtn({
  icon, label, active, onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.ctrlBtn, active && styles.ctrlBtnActive]} onPress={onPress}>
      <MaterialIcons name={icon} size={26} color="#fff" />
      <Text style={styles.ctrlLabel}>{label}</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ActiveCallScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const callState = useAppSelector((s) => s.call);
  const {
    localStreamURL,
    remoteStreamURL,
    isFrontCamera,
    muteLocalAudio,
    setLocalVideoEnabled,
    flipCamera,
    endAndCleanup,
  } = useWebRTC();

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function fmt(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  }

  function handleHangUp() {
    if (timerRef.current) clearInterval(timerRef.current);
    setSpeakerphoneOn(false);
    if (callState.remoteUserId && callState.callId) {
      endCall(callState.remoteUserId, callState.callId, elapsed, callState.callType);
    }
    endAndCleanup();
    router.back();
  }

  function handleSpeaker() {
    const next = !callState.isSpeaker;
    setSpeakerphoneOn(next);
    dispatch(toggleSpeaker());
  }

  const isVideo = callState.callType === 'video';
  const initial = (callState.remoteUserName ?? '?')[0]?.toUpperCase() ?? '?';

  // ── VIDEO CALL ──────────────────────────────────────────────────────────────
  if (isVideo) {
    return (
      <View style={styles.videoRoot}>
        {/* Remote video fills screen */}
        {remoteStreamURL ? (
          <RTCView streamURL={remoteStreamURL} style={StyleSheet.absoluteFill} objectFit="cover" />
        ) : (
          // Waiting for remote stream
          <LinearGradient colors={['#0B1E35', '#1C3A4A']} style={[StyleSheet.absoluteFill, styles.videoWait]}>
            {callState.remoteUserPhoto ? (
              <Image source={{ uri: callState.remoteUserPhoto }} style={styles.waitAvatar} contentFit="cover" />
            ) : (
              <View style={styles.waitAvatarFallback}>
                <Text style={styles.waitInitial}>{initial}</Text>
              </View>
            )}
            <Text style={styles.connectingText}>Connecting…</Text>
          </LinearGradient>
        )}

        {/* Top gradient: name + timer */}
        <LinearGradient
          colors={['rgba(0,0,0,0.72)', 'transparent']}
          style={[styles.topOverlay, { paddingTop: insets.top + 14 }]}
        >
          <Text style={styles.overlayName}>{callState.remoteUserName}</Text>
          <Text style={styles.overlayTimer}>{fmt(elapsed)}</Text>
        </LinearGradient>

        {/* Local PiP — top-right corner */}
        {localStreamURL ? (
          <View style={[styles.pip, { top: insets.top + 72 }]}>
            <RTCView
              streamURL={localStreamURL}
              style={StyleSheet.absoluteFill}
              objectFit="cover"
              mirror={isFrontCamera}
            />
          </View>
        ) : null}

        {/* Bottom gradient: controls */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 20 }]}
        >
          <View style={styles.ctrlRow}>
            <CtrlBtn
              icon={callState.isMuted ? 'mic-off' : 'mic'}
              label={callState.isMuted ? 'Unmute' : 'Mute'}
              active={callState.isMuted}
              onPress={() => muteLocalAudio(!callState.isMuted)}
            />
            <CtrlBtn
              icon={callState.isCameraOff ? 'videocam-off' : 'videocam'}
              label={callState.isCameraOff ? 'Cam on' : 'Cam off'}
              active={callState.isCameraOff}
              onPress={() => setLocalVideoEnabled(callState.isCameraOff)}
            />
            <CtrlBtn
              icon="flip-camera-android"
              label="Flip"
              onPress={flipCamera}
            />
            <CtrlBtn
              icon={callState.isSpeaker ? 'volume-up' : 'volume-down'}
              label={callState.isSpeaker ? 'Speaker' : 'Earpiece'}
              active={callState.isSpeaker}
              onPress={handleSpeaker}
            />
          </View>
          <Pressable style={styles.endBtn} onPress={handleHangUp}>
            <MaterialIcons name="call-end" size={30} color="#fff" />
          </Pressable>
        </LinearGradient>
      </View>
    );
  }

  // ── AUDIO CALL ──────────────────────────────────────────────────────────────
  return (
    <LinearGradient
      colors={['#0B1E35', '#1C3A4A', '#0B1E35']}
      style={[styles.audioRoot, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }]}
    >
      {/* Top */}
      <Text style={styles.audioCallType}>Audio call</Text>

      {/* Center */}
      <View style={styles.audioCenter}>
        {callState.remoteUserPhoto ? (
          <Image source={{ uri: callState.remoteUserPhoto }} style={styles.audioAvatar} contentFit="cover" />
        ) : (
          <View style={styles.audioAvatarFallback}>
            <Text style={styles.audioInitial}>{initial}</Text>
          </View>
        )}
        <Text style={styles.audioName}>{callState.remoteUserName}</Text>
        <Text style={styles.audioTimer}>{fmt(elapsed)}</Text>
      </View>

      {/* Bottom controls */}
      <View style={styles.audioControls}>
        <View style={styles.ctrlRow}>
          <CtrlBtn
            icon={callState.isMuted ? 'mic-off' : 'mic'}
            label={callState.isMuted ? 'Unmute' : 'Mute'}
            active={callState.isMuted}
            onPress={() => muteLocalAudio(!callState.isMuted)}
          />
          <CtrlBtn
            icon={callState.isSpeaker ? 'volume-up' : 'volume-down'}
            label={callState.isSpeaker ? 'Speaker' : 'Earpiece'}
            active={callState.isSpeaker}
            onPress={handleSpeaker}
          />
        </View>
        <Pressable style={styles.endBtn} onPress={handleHangUp}>
          <MaterialIcons name="call-end" size={30} color="#fff" />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // ── Video ────────────────────────────────────────────────────────────────────
  videoRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoWait: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  waitAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  waitAvatarFallback: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#27BB97',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitInitial: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '700',
  },
  connectingText: {
    color: '#9CA3AF',
    fontSize: 15,
  },
  topOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 120,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 14,
    zIndex: 2,
  },
  overlayName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  overlayTimer: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 2,
  },
  pip: {
    position: 'absolute',
    right: 16,
    width: 90,
    height: 128,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    zIndex: 3,
    elevation: 6,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingTop: 32,
    zIndex: 2,
  },
  // ── Audio ────────────────────────────────────────────────────────────────────
  audioRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audioCallType: {
    color: '#9CA3AF',
    fontSize: 15,
  },
  audioCenter: {
    alignItems: 'center',
    gap: 12,
  },
  audioAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  audioAvatarFallback: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#27BB97',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioInitial: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '700',
  },
  audioName: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  audioTimer: {
    color: '#9CA3AF',
    fontSize: 18,
  },
  audioControls: {
    alignItems: 'center',
    gap: 20,
  },
  // ── Shared ───────────────────────────────────────────────────────────────────
  ctrlRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  ctrlBtn: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    minWidth: 64,
  },
  ctrlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  ctrlLabel: {
    color: '#D1D5DB',
    fontSize: 11,
  },
  endBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
});
