import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { FloatingBottomNav } from "@/components/floating-bottom-nav";
import type { BottomNavTabId } from "@/constants/bottom-nav-tabs";

const ROUTE_TO_TAB: Record<string, BottomNavTabId> = {
  "home-feed-root": "home",
  "search-home": "search",
  "sell-entry": "sell",
  "dashboard-home": "profile",
};

const TAB_TO_ROUTE: Record<BottomNavTabId, string> = {
  home: "home-feed-root",
  search: "search-home",
  sell: "sell-entry",
  profile: "dashboard-home",
};

export function MainTabBar({ state, navigation }: BottomTabBarProps) {
  const activeRouteName = state.routes[state.index]?.name ?? "home-feed-root";
  const activeTabId = ROUTE_TO_TAB[activeRouteName] ?? "home";

  const handleTabPress = (tabId: string) => {
    const routeName = TAB_TO_ROUTE[tabId as BottomNavTabId];
    if (!routeName) return;

    if (ROUTE_TO_TAB[activeRouteName] === tabId) return;

    const route = state.routes.find((r) => r.name === routeName);
    const event = navigation.emit({
      type: "tabPress",
      target: route?.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented && route) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      navigation.navigate(routeName);
    }
  };

  return <FloatingBottomNav activeTabId={activeTabId} onTabPress={handleTabPress} />;
}
