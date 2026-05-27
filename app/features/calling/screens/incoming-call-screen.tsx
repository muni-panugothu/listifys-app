/**
 * Incoming Call Screen — WhatsApp-style
 */
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from '@/lib/safe-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { callConnected } from '@/store/slices/call-slice';
import { useWebRTC } from '@/features/calling/hooks/useWebRTC';
import { acceptCall, rejectCall } from '@/features/calling/services/call-socket-service';
import { MaterialIcons } from '@expo/vector-icons';

const AVATAR_SIZE = 130;

export default function IncomingCallScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const callState = useAppSelector((s) => s.call);
  const { answerCall, endAndCleanup } = useWebRTC();

  // Three expanding rings + accept-button pulse
  const r1 = useRef(new Animated.Value(1)).current;
  const r2 = useRef(new Animated.Value(1)).current;
  const r3 = useRef(new Animated.Value(1)).current;
  const r1o = useRef(new Animated.Value(0.5)).current;
  const r2o = useRef(new Animated.Value(0.35)).current;
  const r3o = useRef(new Animated.Value(0.2)).current;
  const acceptPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const rings = Animated.loop(
      Animated.stagger(450, [
        Animated.parallel([
          Animated.timing(r1, { toValue: 1.7, duration: 1300, useNativeDriver: true }),
          Animated.timing(r1o, { toValue: 0,   duration: 1300, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(r2, { toValue: 1.7, duration: 1300, useNativeDriver: true }),
          Animated.timing(r2o, { toValue: 0,   duration: 1300, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(r3, { toValue: 1.7, duration: 1300, useNativeDriver: true }),
          Animated.timing(r3o, { toValue: 0,   duration: 1300, useNativeDriver: true }),
        ]),
      ]),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(acceptPulse, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        Animated.timing(acceptPulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ]),
    );
    rings.start();
    pulse.start();
    return () => { rings.stop(); pulse.stop(); };
  }, [r1, r2, r3, r1o, r2o, r3o, acceptPulse]);

  async function handleAccept() {
    if (!callState.pendingOffer || !callState.remoteUserId || !callState.callId) return;
    try {
      const answer = await answerCall(callState.pendingOffer, callState.callType);
      acceptCall(callState.remoteUserId, answer, callState.callId);
      dispatch(callConnected());
      router.replace('/active-call');
    } catch {
      handleReject();
    }
  }

  function handleReject() {
    if (callState.remoteUserId && callState.callId) {
      rejectCall(callState.remoteUserId, callState.callId);
    }
    endAndCleanup();
    router.back();
  }

  const initial = (callState.remoteUserName ?? '?')[0]?.toUpperCase() ?? '?';

  return (
    <LinearGradient
      colors={['#0B1E35', '#1C3A4A', '#0B1E35']}
      style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }]}
    >
      {/* Top label */}
      <View style={styles.topSection}>
        <Text style={styles.callTypeText}>
          {callState.callType === 'video' ? 'Incoming video call' : 'Incoming voice call'}
        </Text>
        <Text style={styles.appTag}>LISTIFY</Text>
      </View>

      {/* Center: rings + avatar + name */}
      <View style={styles.centerSection}>
        <Animated.View style={[styles.ring, { transform: [{ scale: r1 }], opacity: r1o }]} />
        <Animated.View style={[styles.ring, { transform: [{ scale: r2 }], opacity: r2o }]} />
        <Animated.View style={[styles.ring, { transform: [{ scale: r3 }], opacity: r3o }]} />

        {callState.remoteUserPhoto ? (
          <Image source={{ uri: callState.remoteUserPhoto }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}

        <Text style={styles.callerName}>{callState.remoteUserName ?? 'Unknown'}</Text>
        <Text style={styles.callerSub}>Mobile</Text>
      </View>

      {/* Bottom: Decline / Accept */}
      <View style={styles.actionsRow}>
        <View style={styles.actionItem}>
          <Pressable style={styles.declineBtn} onPress={handleReject}>
            <MaterialIcons name="call-end" size={32} color="#fff" />
          </Pressable>
          <Text style={styles.actionLabel}>Decline</Text>
        </View>

        <View style={styles.actionItem}>
          <Animated.View style={{ transform: [{ scale: acceptPulse }] }}>
            <Pressable style={styles.acceptBtn} onPress={handleAccept}>
              <MaterialIcons
                name={callState.callType === 'video' ? 'videocam' : 'call'}
                size={32}
                color="#fff"
              />
            </Pressable>
          </Animated.View>
          <Text style={styles.actionLabel}>Accept</Text>
        </View>
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
  appTag: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    letterSpacing: 2,
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
    borderColor: 'rgba(37,211,102,0.55)',
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
  callerSub: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '75%',
  },
  actionItem: {
    alignItems: 'center',
    gap: 10,
  },
  declineBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#D1D5DB',
    fontSize: 13,
  },
});
