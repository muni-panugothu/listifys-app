import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  type CellularGeneration,
  type ConnectionType,
  updateNetworkSnapshot,
} from "@/store/slices/network-slice";

type BannerKind = "offline" | "online" | "slow";

type BannerConfig = {
  kind: BannerKind;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  message: string;
  backgroundColor: string;
  borderColor: string;
  iconBackgroundColor: string;
  iconColor: string;
};

const TRANSIENT_BANNER_MS = 2600;
const HIDDEN_TRANSLATE_Y = -24;

function toConnectionType(type: NetInfoState["type"]): ConnectionType {
  switch (type) {
    case "unknown":
    case "none":
    case "wifi":
    case "cellular":
    case "bluetooth":
    case "ethernet":
    case "wimax":
    case "vpn":
      return type;
    default:
      return "other";
  }
}

function resolveCellularGeneration(state: NetInfoState): CellularGeneration {
  if (state.type !== "cellular") {
    return null;
  }

  const details = state.details as { cellularGeneration?: CellularGeneration } | null;
  return details?.cellularGeneration ?? null;
}

function resolveIsConnectionExpensive(state: NetInfoState) {
  const details = state.details as { isConnectionExpensive?: boolean } | null;
  return Boolean(details?.isConnectionExpensive);
}

function buildBanner(kind: BannerKind): BannerConfig {
  switch (kind) {
    case "offline":
      return {
        kind,
        icon: "cloud-off",
        title: "You're offline",
        message: "Showing cached content where available until the connection returns.",
        backgroundColor: "#10231D",
        borderColor: "#1E3A34",
        iconBackgroundColor: "rgba(255,255,255,0.12)",
        iconColor: "#F8FAFC",
      };
    case "slow":
      return {
        kind,
        icon: "network-check",
        title: "Weak connection",
        message: "Updates may take a little longer than usual.",
        backgroundColor: "#FFF7E8",
        borderColor: "#F3D28D",
        iconBackgroundColor: "#FDE7B5",
        iconColor: "#9A6700",
      };
    case "online":
      return {
        kind,
        icon: "wifi",
        title: "Back online",
        message: "Live updates restored.",
        backgroundColor: "#ECFDF5",
        borderColor: "#A7F3D0",
        iconBackgroundColor: "#D1FAE5",
        iconColor: "#047857",
      };
  }
}

export function NetworkStatusLayer() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { isConnected, isInternetReachable, isSlowConnection } = useAppSelector((state) => state.network);
  const [banner, setBanner] = useState<BannerConfig | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(HIDDEN_TRANSLATE_Y)).current;
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);
  const previousStateRef = useRef({
    isOffline: false,
    isSlowConnection: false,
  });

  const hideBanner = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: HIDDEN_TRANSLATE_Y,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setBanner(null);
      }
    });
  }, [opacity, translateY]);

  const showBanner = useCallback(
    (nextBanner: BannerConfig, autoHideMs?: number) => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      setBanner(nextBanner);

      opacity.stopAnimation();
      translateY.stopAnimation();

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      if (autoHideMs) {
        hideTimeoutRef.current = setTimeout(() => {
          hideBanner();
        }, autoHideMs);
      }
    },
    [hideBanner, opacity, translateY],
  );

  useEffect(() => {
    const handleNetInfoChange = (state: NetInfoState) => {
      const cellularGeneration = resolveCellularGeneration(state);
      const isConnectionExpensive = resolveIsConnectionExpensive(state);
      const transportIsSlow =
        cellularGeneration === "2g" ||
        cellularGeneration === "3g" ||
        isConnectionExpensive;

      dispatch(
        updateNetworkSnapshot({
          isConnected: Boolean(state.isConnected),
          isInternetReachable: state.isInternetReachable ?? null,
          transportIsSlow,
          connectionType: toConnectionType(state.type),
          cellularGeneration,
          isConnectionExpensive,
        }),
      );
    };

    const unsubscribe = NetInfo.addEventListener(handleNetInfoChange);
    NetInfo.fetch().then(handleNetInfoChange).catch(() => {});

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const isOffline = !isConnected || isInternetReachable === false;
    const previousState = previousStateRef.current;

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;

      if (isOffline) {
        showBanner(buildBanner("offline"));
      } else if (isSlowConnection) {
        showBanner(buildBanner("slow"), TRANSIENT_BANNER_MS);
      }

      previousStateRef.current = { isOffline, isSlowConnection };
      return;
    }

    if (isOffline) {
      showBanner(buildBanner("offline"));
    } else if (previousState.isOffline) {
      showBanner(buildBanner("online"), TRANSIENT_BANNER_MS);
    } else if (isSlowConnection && !previousState.isSlowConnection) {
      showBanner(buildBanner("slow"), TRANSIENT_BANNER_MS);
    } else if (!isSlowConnection && previousState.isSlowConnection && banner?.kind === "slow") {
      hideBanner();
    }

    previousStateRef.current = { isOffline, isSlowConnection };
  }, [banner?.kind, hideBanner, isConnected, isInternetReachable, isSlowConnection, showBanner]);

  if (!banner) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        elevation: 1000,
        alignItems: "center",
      }}
    >
      <Animated.View
        style={{
          width: "100%",
          paddingHorizontal: 16,
          marginTop: insets.top + 12,
          opacity,
          transform: [{ translateY }],
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: 460,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: banner.borderColor,
            backgroundColor: banner.backgroundColor,
            paddingHorizontal: 16,
            paddingVertical: 14,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.14,
            shadowRadius: 18,
            elevation: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: banner.iconBackgroundColor,
                marginRight: 12,
              }}
            >
              <MaterialIcons name={banner.icon} size={18} color={banner.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: banner.kind === "offline" ? "#F8FAFC" : "#0F172A",
                  marginBottom: 2,
                }}
              >
                {banner.title}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 19,
                  color: banner.kind === "offline" ? "rgba(248,250,252,0.84)" : "#475569",
                }}
              >
                {banner.message}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}