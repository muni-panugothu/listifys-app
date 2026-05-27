/**
 * Outgoing Call Screen — WhatsApp-style
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from '@/lib/safe-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { callEnded } from '@/store/slices/call-slice';
import { useWebRTC } from '@/features/calling/hooks/useWebRTC';
import { initiateCall, endCall, attachCallListeners } from '@/features/calling/services/call-socket-service';
import { MaterialIcons } from '@expo/vector-icons';

const AVATAR_SIZE = 130;

export default function OutgoingCallScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const callState = useAppSelector((s) => s.call);
  const { createOffer, endAndCleanup } = useWebRTC();

  const r1 = useRef(new Animated.Value(1)).current;
  const r2 = useRef(new Animated.Value(1)).current;
  const r1o = useRef(new Animated.Value(0.5)).current;
  const r2o = useRef(new Animated.Value(0.3)).current;
  const [dotCount, setDotCount] = useState(1);
  const initialized = useRef(false);

  useEffect(() => {
    const rings = Animated.loop(
      Animated.stagger(500, [
        Animated.parallel([
          Animated.timing(r1, { toValue: 1.7, duration: 1500, useNativeDriver: true }),
          Animated.timing(r1o, { toValue: 0,   duration: 1500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(r2, { toValue: 1.7, duration: 1500, useNativeDriver: true }),
          Animated.timing(r2o, { toValue: 0,   duration: 1500, useNativeDriver: true }),
        ]),
      ]),
    );
    rings.start();

    const dotsTimer = setInterval(() => setDotCount((d) => (d % 3) + 1), 550);
    return () => { rings.stop(); clearInterval(dotsTimer); };
  }, [r1, r2, r1o, r2o]);

  // Create offer once on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    attachCallListeners();

    (async () => {
      try {
        const offer = await createOffer(callState.callType);
        if (callState.remoteUserId) {
          initiateCall({
            to:          callState.remoteUserId,
            callType:    callState.callType,
            offer,
            callerName:  '',
            callerPhoto: '',
          });
        }
      } catch {
        dispatch(callEnded());
        router.back();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleHangUp() {
    if (callState.remoteUserId && callState.callId) {
      endCall(callState.remoteUserId, callState.callId, 0, callState.callType);
    }
    endAndCleanup();
    router.back();
  }

  const initial = (callState.remoteUserName ?? '?')[0]?.toUpperCase() ?? '?';
  const dots = '.'.repeat(dotCount);

  return (
    <LinearGradient
      colors={['#0B1E35', '#1C3A4A', '#0B1E35']}
      style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }]}
    >
      {/* Top */}
      <View style={styles.topSection}>
        <Text style={styles.callTypeText}>
          {callState.callType === 'video' ? 'Video call' : 'Voice call'}
        </Text>
        <Text style={styles.ringingText}>Ringing{dots}</Text>
      </View>

      {/* Center */}
      <View style={styles.centerSection}>
        <Animated.View style={[styles.ring, { transform: [{ scale: r1 }], opacity: r1o }]} />
        <Animated.View style={[styles.ring, { transform: [{ scale: r2 }], opacity: r2o }]} />

        {callState.remoteUserPhoto ? (
          <Image source={{ uri: callState.remoteUserPhoto }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}

        <Text style={styles.callerName}>{callState.remoteUserName ?? 'Unknown'}</Text>
      </View>

      {/* Bottom: Hang up */}
      <View style={styles.bottomSection}>
        <Pressable style={styles.hangUpBtn} onPress={handleHangUp}>
          <MaterialIcons name="call-end" size={32} color="#fff" />
        </Pressable>
        <Text style={styles.hangUpLabel}>Hang up</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    gap: 6,
  },
  callTypeText: {
    color: '#9CA3AF',
    fontSize: 15,
  },
  ringingText: {
    color: '#E5E7EB',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.3,
    minWidth: 120,
    textAlign: 'center',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: AVATAR_SIZE * 3.5,
    height: AVATAR_SIZE * 3.5,
  },
  ring: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(37,211,102,0.5)',
    backgroundColor: 'rgba(37,211,102,0.04)',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    zIndex: 1,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#27BB97',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 52,
    fontWeight: '700',
  },
  callerName: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginTop: 18,
    letterSpacing: 0.3,
  },
  bottomSection: {
    alignItems: 'center',
    gap: 10,
  },
  hangUpBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangUpLabel: {
    color: '#9CA3AF',
    fontSize: 13,
  },
});
