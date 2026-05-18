import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  mergeNotificationsWithDummy,
} from "@/constants/dummy-notifications";
import { APP_SCREEN_BG } from "@/constants/theme";
import { ListifyFonts } from "@/constants/typography";
import {
  type NotificationItem,
  getNotifications,
  markNotificationRead,
} from "@/features/auth/services/auth-api";
import {
  connectSocket,
  getSocket,
} from "@/features/messaging/services/socket-service";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useAppSelector } from "@/store/hooks";

const HOME_BG = APP_SCREEN_BG;
const TEXT_PRIMARY = "#1A1A1A";
const TEXT_MUTED = "#9CA3AF";
const UNREAD_DOT = "#EF4444";

type NotifVisual = {
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
};

function getNotificationVisual(type: string): NotifVisual {
  switch (type) {
    case "like":
    case "favorite":
      return { icon: "favorite", color: "#F472B6" };
    case "category":
    case "alert":
      return { icon: "apps", color: "#27BB97" };
    case "welcome":
    case "verified":
      return { icon: "verified", color: "#60A5FA" };
    case "location":
    case "nearby":
      return { icon: "place", color: "#27BB97" };
    default:
      return { icon: "notifications", color: "#27BB97" };
  }
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function isThisWeek(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return d >= weekAgo && !isToday(dateStr);
}

function groupNotifications(items: NotificationItem[]) {
  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const today: NotificationItem[] = [];
  const thisWeek: NotificationItem[] = [];
  const earlier: NotificationItem[] = [];

  for (const item of sorted) {
    if (isToday(item.createdAt)) today.push(item);
    else if (isThisWeek(item.createdAt)) thisWeek.push(item);
    else earlier.push(item);
  }

  return { today, thisWeek, earlier };
}

function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const visual = getNotificationVisual(item.type);
  const body =
    item.message?.trim() ||
    item.title?.trim() ||
    "You have a new notification on Listify.";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start py-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: "#1A1A1A" }}
      >
        <MaterialIcons name={visual.icon} size={24} color={visual.color} />
      </View>

      <Text
        className="ml-3.5 min-w-0 flex-1 text-[15px] leading-[22px]"
        style={{ fontFamily: ListifyFonts.regular, color: TEXT_PRIMARY }}
      >
        {body}
      </Text>

      {!item.read ? (
        <View
          className="ml-2 mt-1.5 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: UNREAD_DOT }}
        />
      ) : (
        <View className="ml-2 w-2.5" />
      )}
    </Pressable>
  );
}

function Section({
  title,
  items,
  onItemPress,
}: {
  title: string;
  items: NotificationItem[];
  onItemPress: (item: NotificationItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <View className="mb-2">
      <Text
        className="mb-1 text-[14px]"
        style={{ fontFamily: ListifyFonts.medium, color: TEXT_MUTED }}
      >
        {title}
      </Text>
      {items.map((item) => (
        <NotificationRow
          key={item._id}
          item={item}
          onPress={() => onItemPress(item)}
        />
      ))}
    </View>
  );
}

export function NotificationsCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((s) => s.auth.user);

  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    mergeNotificationsWithDummy([]),
  );

  const loadNotifications = useCallback(async () => {
    try {
      const res = await getNotifications();
      setNotifications(mergeNotificationsWithDummy(res.notifications ?? []));
    } catch {
      setNotifications((prev) =>
        prev.length > 0 ? prev : mergeNotificationsWithDummy([]),
      );
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user) return;
    try {
      connectSocket();
    } catch {
      return;
    }
    const socket = getSocket();
    if (!socket) return;

    const handleNewNotification = (data: {
      _id?: string;
      type?: string;
      title?: string;
      message?: string;
      createdAt?: string;
      data?: Record<string, unknown>;
    }) => {
      const notif: NotificationItem = {
        _id: data._id || `notif_${Date.now()}`,
        type: data.type || "general",
        title: data.title || "",
        message: data.message || "You have a new notification.",
        read: false,
        createdAt: data.createdAt || new Date().toISOString(),
        data: data.data,
      };
      setNotifications((prev) => [notif, ...prev]);
    };

    socket.on("notification:new", handleNewNotification);
    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [user]);

  const { refreshing, onRefresh } = usePullToRefresh(loadNotifications);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const { today, thisWeek, earlier } = useMemo(
    () => groupNotifications(notifications),
    [notifications],
  );

  const handleItemPress = useCallback(async (item: NotificationItem) => {
    if (!item.read && !item._id.startsWith("dummy-")) {
      await markNotificationRead(item._id).catch(() => {});
    }
    setNotifications((prev) =>
      prev.map((x) => (x._id === item._id ? { ...x, read: true } : x)),
    );
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: HOME_BG }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20 }}>
        <View className="mb-6 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="mr-3 h-10 w-10 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="chevron-left" size={32} color={TEXT_PRIMARY} />
          </Pressable>

          <View className="flex-row items-center gap-2">
            <Text
              className="text-[22px]"
              style={{ fontFamily: ListifyFonts.bold, color: TEXT_PRIMARY }}
            >
              Notifications
            </Text>
            {/* {unreadCount > 0 ? (
              <View
                className="min-h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5"
                style={{ backgroundColor: UNREAD_DOT }}
              >
                <Text
                  className="text-[12px] text-white"
                  style={{ fontFamily: ListifyFonts.bold }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            ) : null} */}
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#27BB97"]}
            tintColor="#27BB97"
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
      >
        <Section title="Today" items={today} onItemPress={handleItemPress} />
        <Section
          title="This week"
          items={thisWeek}
          onItemPress={handleItemPress}
        />
        {earlier.length > 0 ? (
          <Section title="Earlier" items={earlier} onItemPress={handleItemPress} />
        ) : null}

        {notifications.length === 0 ? (
          <View className="items-center py-16">
            <MaterialIcons
              name="notifications-none"
              size={48}
              color="#D1D5DB"
            />
            <Text
              className="mt-3 text-[15px]"
              style={{ fontFamily: ListifyFonts.regular, color: TEXT_MUTED }}
            >
              No notifications yet
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
