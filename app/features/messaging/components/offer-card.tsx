/**
 * OfferCard — rendered inside a product thread when messageType === "offer".
 * Shows the offer amount, status badge, and Accept/Decline buttons (for seller).
 */
import { Text, View, Pressable } from "react-native";
import type { ChatMessage, ProductThread } from "@/features/messaging/services/chat-api";
import { ListifyFonts } from "@/constants/typography";

const BRAND   = "#27BB97";
const SOLD    = "#EF4444";
const PENDING = "#F59E0B";
const ACCENT  = "#3B82F6";

type Props = {
  message: ChatMessage;
  thread:  ProductThread;
  isSeller: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  pending:  PENDING,
  accepted: BRAND,
  declined: SOLD,
  countered: ACCENT,
};

const STATUS_LABELS: Record<string, string> = {
  pending:  "Pending",
  accepted: "Accepted ✓",
  declined: "Declined",
  countered: "Counter-offer",
};

export function OfferCard({ message, thread, isSeller, onAccept, onDecline }: Props) {
  const offer   = message.offerData;
  if (!offer) return null;

  const status  = offer.status ?? "pending";
  const amount  = offer.amount != null
    ? `${offer.currency || "₹"}${offer.amount.toLocaleString("en-IN")}`
    : "";

  const color  = STATUS_COLORS[status] ?? PENDING;
  const label  = STATUS_LABELS[status] ?? status;
  const showActions = isSeller && status === "pending" && thread.status === "active";

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth:  1,
        borderColor:  color,
        backgroundColor: "#FAFAFA",
        padding:      14,
        marginVertical: 4,
        maxWidth:     280,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ fontSize: 18, marginRight: 6 }}>💰</Text>
        <Text
          style={{
            fontFamily: ListifyFonts.semibold,
            fontSize: 13,
            color: "#374151",
          }}
        >
          Offer
        </Text>
        <View
          style={{
            marginLeft: "auto",
            backgroundColor: color + "20",
            borderRadius:    6,
            paddingHorizontal: 8,
            paddingVertical:   2,
          }}
        >
          <Text style={{ fontFamily: ListifyFonts.semibold, fontSize: 11, color }}>{label}</Text>
        </View>
      </View>

      {/* Amount */}
      <Text
        style={{
          fontFamily: ListifyFonts.bold,
          fontSize:   22,
          color:      "#111827",
          marginBottom: 4,
        }}
      >
        {amount}
      </Text>

      {/* Product name */}
      {thread.product?.title ? (
        <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
          {thread.product.title}
          {thread.product.price != null ? (
            <Text style={{ color: "#9CA3AF" }}>
              {" "}(Listed: {thread.product.currency}{thread.product.price.toLocaleString("en-IN")})
            </Text>
          ) : null}
        </Text>
      ) : null}

      {/* Actions (seller only, while pending) */}
      {showActions && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <Pressable
            onPress={onDecline}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: SOLD,
              backgroundColor: pressed ? "#FEE2E2" : "#FFF5F5",
            })}
          >
            <Text style={{ fontFamily: ListifyFonts.semibold, fontSize: 13, color: SOLD }}>
              Decline
            </Text>
          </Pressable>
          <Pressable
            onPress={onAccept}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: pressed ? "#059669" : BRAND,
            })}
          >
            <Text style={{ fontFamily: ListifyFonts.semibold, fontSize: 13, color: "#FFF" }}>
              Accept
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
