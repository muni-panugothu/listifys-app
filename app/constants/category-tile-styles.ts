import type { ComponentProps } from "react";
import type { MaterialIcons } from "@expo/vector-icons";

import type { CategorySlug } from "@/constants/categories";

export type CategoryTileVisual = {
  gradient: [string, string, string];
  iconColor: string;
  accentOrb: string;
};

export const CATEGORY_TILE_VISUALS: Record<CategorySlug, CategoryTileVisual> = {
  electronics: {
    gradient: ["#F4F9FF", "#DCEEFF", "#C5E2FF"],
    iconColor: "#3B82C4",
    accentOrb: "rgba(147, 197, 253, 0.45)",
  },
  jobs: {
    gradient: ["#F5F3FF", "#E4DEFF", "#D4CCFF"],
    iconColor: "#6D5BD0",
    accentOrb: "rgba(167, 139, 250, 0.4)",
  },
  vehicles: {
    gradient: ["#F0F4FF", "#D8E4FC", "#C2D4F8"],
    iconColor: "#4B6CB7",
    accentOrb: "rgba(147, 197, 253, 0.38)",
  },
  takecare: {
    gradient: ["#FFF5F8", "#FFE4EE", "#FFD1E3"],
    iconColor: "#E85D8A",
    accentOrb: "rgba(251, 182, 206, 0.5)",
  },
  events: {
    gradient: ["#FFFAF3", "#FFEED4", "#FFE2B8"],
    iconColor: "#D97706",
    accentOrb: "rgba(253, 186, 116, 0.45)",
  },
  properties: {
    gradient: ["#F2FBF6", "#D9F2E4", "#C2EBD6"],
    iconColor: "#2D9B6F",
    accentOrb: "rgba(110, 231, 183, 0.4)",
  },
  forsale: {
    gradient: ["#FFFCF4", "#FFF0D0", "#FFE4A8"],
    iconColor: "#CA8A04",
    accentOrb: "rgba(252, 211, 77, 0.45)",
  },
  mobiles: {
    gradient: ["#F0FAFF", "#D4F0FF", "#B8E6FF"],
    iconColor: "#0EA5E9",
    accentOrb: "rgba(125, 211, 252, 0.45)",
  },
  furniture: {
    gradient: ["#FAF6F2", "#EDE2D6", "#E0D0C0"],
    iconColor: "#A67C52",
    accentOrb: "rgba(214, 180, 148, 0.45)",
  },
  fashion: {
    gradient: ["#FFF5FA", "#FFE0F0", "#FFCBE3"],
    iconColor: "#DB2777",
    accentOrb: "rgba(244, 114, 182, 0.42)",
  },
  sports: {
    gradient: ["#F0FDF6", "#D5F5E3", "#BBEFD0"],
    iconColor: "#16A34A",
    accentOrb: "rgba(134, 239, 172, 0.45)",
  },
  collectibles: {
    gradient: ["#FFFDF2", "#FFF6D1", "#FFEDAB"],
    iconColor: "#B45309",
    accentOrb: "rgba(252, 211, 77, 0.4)",
  },
  pets: {
    gradient: ["#F4FBF4", "#DCF5DC", "#C4EDC4"],
    iconColor: "#65A30D",
    accentOrb: "rgba(163, 230, 53, 0.4)",
  },
  books: {
    gradient: ["#F5F9FD", "#E0EBF5", "#CBDDF0"],
    iconColor: "#5B7C99",
    accentOrb: "rgba(148, 163, 184, 0.35)",
  },
  beauty: {
    gradient: ["#FFF6FA", "#FFE3F1", "#FFD0E8"],
    iconColor: "#EC4899",
    accentOrb: "rgba(249, 168, 212, 0.45)",
  },
  others: {
    gradient: ["#F8F9FB", "#ECEFF3", "#E0E4EA"],
    iconColor: "#64748B",
    accentOrb: "rgba(203, 213, 225, 0.5)",
  },
  toys: {
    gradient: ["#FFF8F2", "#FFE8D2", "#FFD9B5"],
    iconColor: "#EA580C",
    accentOrb: "rgba(253, 186, 140, 0.48)",
  },
  services: {
    gradient: ["#F0FBFF", "#D4F2FA", "#B8E8F4"],
    iconColor: "#0891B2",
    accentOrb: "rgba(103, 232, 249, 0.4)",
  },
};

export type CategoryTileIcon = ComponentProps<typeof MaterialIcons>["name"];
