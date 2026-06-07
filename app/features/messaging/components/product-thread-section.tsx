/**
 * ProductThreadSection — renders the header banner for a product thread.
 * Shows the product image, title, price, status, and offer badge.
 * Appears as a sticky section header inside the chat FlatList.
 */
import { Image } from "@/lib/nativewind-interop";
import { resolveAbsoluteMediaUrl } from "@/features/auth/services/auth-api";
import type { ProductThread } from "@/features/messaging/services/chat-api";
import { ListifyFonts } from "@/constants/typography";
import { Text, View, Pressable } from "react-native";

const BRAND  = "#27BB97";
const SOLD   = "#EF4444";
const ACTIVE = "#10B981";

type Props = {
  thread:      ProductThread;
  isExpanded:  boolean;
  onToggle:    () => void;
};

const OFFER_BADGES: Record<string, { label: string; color: string }> = {
  pending:   { label: "Offer Pending",   color: "#F59E0B" },
  accepted:  { label: "Offer Accepted",  color: BRAND },
  declined:  { label: "Offer Declined",  color: SOLD },
  countered: { label: "Counter Offer",   color: "#3B82F6" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ProductThreadSection({ thread, isExpanded, onToggle }: Props) {
  const product    = thread.product;
  const isSold     = thread.status === "sold" || thread.status === "closed";
  const statusColor = isSold ? SOLD : ACTIVE;
  const statusLabel = isSold
    ? (thread.closedReason === "sold" ? "SOLD" : "CLOSED")
    : "ACTIVE";

  const offerBadge = thread.offerStatus !== "none" ? OFFER_BADGES[thread.offerStatus] : null;

  const imageUrl = product.image
    ? resolveAbsoluteMediaUrl(product.image) ?? undefined
    : undefined;

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection:    "row",
        alignItems:       "center",
        backgroundColor:  pressed ? "#F0FDF9" : "#F9FAFB",
        borderRadius:     12,
        marginHorizontal: 12,
        marginVertical:   6,
        padding:          10,
        borderWidth:      1,
        borderColor:      isSold ? "#FECACA" : "#D1FAE5",
        gap:              10,
      })}
    >
      {/* Product image */}
      <View
        style={{
          width:        52,
          height:       52,
          borderRadius: 8,
          overflow:     "hidden",
          backgroundColor: "#E5E7EB",
        }}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: 52, height: 52 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 52, height: 52,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22 }}>📦</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        {/* Title row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text
            style={{ fontFamily: ListifyFonts.semibold, fontSize: 14, color: "#111827", flexShrink: 1 }}
            numberOfLines={1}
          >
            {product.title || "Product"}
          </Text>
          <View
            style={{
              backgroundColor: statusColor + "20",
              borderRadius:    4,
              paddingHorizontal: 6,
              paddingVertical:   1,
            }}
          >
            <Text
              style={{ fontFamily: ListifyFonts.bold, fontSize: 10, color: statusColor, letterSpacing: 0.5 }}
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* Price + date */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, gap: 8 }}>
          {product.price != null && (
            <Text style={{ fontFamily: ListifyFonts.semibold, fontSize: 13, color: "#374151" }}>
              {product.currency}{product.price.toLocaleString("en-IN")}
            </Text>
          )}
          <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 11, color: "#9CA3AF" }}>
            Started {formatDate(thread.startedAt)}
          </Text>
        </View>

        {/* Offer badge */}
        {offerBadge && (
          <View
            style={{
              marginTop:       4,
              backgroundColor: offerBadge.color + "15",
              borderRadius:    4,
              paddingHorizontal: 6,
              paddingVertical:   2,
              alignSelf:       "flex-start",
            }}
          >
            <Text style={{ fontFamily: ListifyFonts.semibold, fontSize: 11, color: offerBadge.color }}>
              {offerBadge.label}
            </Text>
          </View>
        )}
      </View>

      {/* Expand chevron */}
      <Text style={{ fontSize: 16, color: "#9CA3AF" }}>{isExpanded ? "▲" : "▼"}</Text>
    </Pressable>
  );
}
