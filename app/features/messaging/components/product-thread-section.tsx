/**
 * ProductThreadSection — renders the header banner for a product thread.
 * Shows the product image, title, price, status, and offer badge.
 * Appears as a sticky section header inside the chat FlatList.
 */
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "@/lib/nativewind-interop";
import { resolveAbsoluteMediaUrl } from "@/features/auth/services/auth-api";
import type { ProductThread, ChatParticipant } from "@/features/messaging/services/chat-api";
import { ListifyFonts } from "@/constants/typography";
import { Text, View, Pressable } from "react-native";

const BRAND  = "#27BB97";
const SOLD   = "#EF4444";
const ACTIVE = "#10B981";

type Props = {
  thread:      ProductThread;
  /** Current user id — used to label the listing as "Posted by me" vs.
   *  "Posted by <seller>". Pass undefined if not signed in. */
  currentUserId?: string;
  isExpanded?: boolean;
  onToggle?:    () => void;
  /** Navigate to listing detail when the banner is tapped. */
  onPress?:     () => void;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function participantIdOf(p: ChatParticipant | string | null | undefined): string {
  if (!p) return "";
  if (typeof p === "string") return p;
  return String(p.id ?? p._id ?? "");
}

function sellerNameOf(seller: ChatParticipant | string | null | undefined): string {
  if (!seller || typeof seller === "string") return "the seller";
  return seller.name || "the seller";
}

export function ProductThreadSection({ thread, currentUserId, isExpanded = true, onToggle, onPress }: Props) {
  const product    = thread.product;
  const isSold     = thread.status === "sold" || thread.status === "closed";
  const statusColor = isSold ? SOLD : ACTIVE;
  const statusLabel = isSold
    ? (thread.closedReason === "sold" ? "SOLD" : "CLOSED")
    : "ACTIVE";

  // "Posted by me" if the current user is the seller of this thread, otherwise
  // "Posted by <seller name>". Falls back to a generic label when we can't
  // identify either side (e.g. signed-out preview).
  const sellerId = participantIdOf(thread.seller);
  const postedByMe = !!currentUserId && sellerId === currentUserId;
  const postedByLabel = postedByMe
    ? "Posted by me"
    : `Posted by ${sellerNameOf(thread.seller)}`;

  const imageUrl = product.image
    ? resolveAbsoluteMediaUrl(product.image) ?? undefined
    : undefined;

  return (
    <Pressable
      onPress={onPress ?? onToggle}
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
            style={{ fontFamily: ListifyFonts.semiBold, fontSize: 14, color: "#111827", flexShrink: 1 }}
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

        {/* Price + posted-by */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, gap: 8, flexWrap: "wrap" }}>
          {product.price != null && (
            <Text style={{ fontFamily: ListifyFonts.semiBold, fontSize: 13, color: "#374151" }}>
              {product.currency}{product.price.toLocaleString("en-IN")}
            </Text>
          )}
          <Text
            style={{
              fontFamily: ListifyFonts.regular,
              fontSize: 11,
              color: postedByMe ? BRAND : "#6B7280",
            }}
            numberOfLines={1}
          >
            {postedByLabel}
          </Text>
        </View>
      </View>

      {/* Open indicator */}
      <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
    </Pressable>
  );
}
