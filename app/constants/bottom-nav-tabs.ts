import type { ComponentProps } from "react";
import { MaterialIcons } from "@expo/vector-icons";

export type BottomNavTabId = "home" | "search" | "sell" | "profile";

export type BottomNavTab = {
  id: BottomNavTabId;
  label: string;
  icon: ComponentProps<typeof MaterialIcons>["name"];
};

export const BOTTOM_NAV_TABS: BottomNavTab[] = [
  { id: "home", label: "Home", icon: "explore" },
  { id: "search", label: "Search", icon: "search" },
  { id: "sell", label: "Sell", icon: "add-circle" },
  { id: "profile", label: "Profile", icon: "person-outline" },
];

/** Approximate vertical space reserved above screen bottom (pill + margin, excluding safe area). */
export const FLOATING_BOTTOM_NAV_OFFSET = 76;
