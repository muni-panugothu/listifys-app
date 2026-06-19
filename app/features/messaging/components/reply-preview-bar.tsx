/**
 * ReplyPreviewBar — shown above the composer when the user is replying to a
 * message. Vertical accent stripe + author name + preview + dismiss button.
 */
import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "@/lib/nativewind-interop";
import { resolveAbsoluteMediaUrl } from "@/features/auth/services/auth-api";
import { ListifyFonts } from "@/constants/typography";
import type { ChatMessage, ChatParticipant } from "@/features/messaging/services/chat-api";

const BRAND     = "#27BB97";
const TEXT_DARK = "#1A1A1A";
const TEXT_MUTED = "#9CA3AF";

function senderName(m: ChatMessage, currentUserId?: string): string {
  const s = m.sender;
  if (!s) return "Unknown";
  if (typeof s === "string") return s === currentUserId ? "You" : "User";
  const p = s as ChatParticipant;
  return p.id === currentUserId ? "You" : (p.name || "User");
}

type Meta = { icon: keyof typeof MaterialIcons.glyphMap | null; preview: string; thumbUrl: string | null };

function buildMeta(m: ChatMessage): Meta {
  const attachments = m.attachments || [];
  const first = attachments[0];
  const thumb = first?.url ? (resolveAbsoluteMediaUrl(first.url) as string | null) : null;

  if (m.messageType === "audio") return { icon: "mic",          preview: "Voice message", thumbUrl: null };
  if (m.messageType === "image") return { icon: "photo-camera", preview: "Photo",         thumbUrl: thumb };
  if (m.messageType === "video") return { icon: "videocam",     preview: "Video",         thumbUrl: thumb };
  if (m.messageType === "document") return { icon: "attach-file", preview: first?.name || "Document", thumbUrl: null };
  if (m.messageType === "offer") return { icon: "local-offer",  preview: "Offer",         thumbUrl: null };

  const c = (m.content || "").trim();
  return { icon: null, preview: c.length > 0 ? c : "Message", thumbUrl: null };
}

type Props = {
  message: ChatMessage;
  currentUserId?: string;
  onCancel: () => void;
};

export function ReplyPreviewBar({ message, currentUserId, onCancel }: Props) {
  const meta = buildMeta(message);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        paddingHorizontal: 10,
        paddingVertical: 8,
        gap: 8,
      }}
    >
      <View style={{ width: 3, height: 38, backgroundColor: BRAND, borderRadius: 2 }} />

      <View style={{ flex: 1, paddingVertical: 2 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: ListifyFonts.semiBold, fontSize: 12, color: BRAND, marginBottom: 2 }}
        >
          Replying to {senderName(message, currentUserId)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {meta.icon && (
            <MaterialIcons name={meta.icon} size={14} color={TEXT_MUTED} />
          )}
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontFamily: ListifyFonts.regular, fontSize: 13, color: TEXT_DARK }}
          >
            {meta.preview}
          </Text>
        </View>
      </View>

      {meta.thumbUrl && (
        <Image
          source={{ uri: meta.thumbUrl }}
          style={{ width: 38, height: 38, borderRadius: 6 }}
          contentFit="cover"
        />
      )}

      <Pressable
        onPress={onCancel}
        hitSlop={10}
        style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: "#F3F4F6",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <MaterialIcons name="close" size={16} color={TEXT_MUTED} />
      </Pressable>
    </View>
  );
}
