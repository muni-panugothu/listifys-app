/**
 * AttachmentPickerSheet — WhatsApp-style "+" bottom sheet.
 * Lets the user grab media from:
 *   • Camera  (photo or video)
 *   • Gallery (photo / video, multi-select)
 *
 * It does **not** upload anything itself. It calls back with a list of local
 * file references; the caller is responsible for uploading + sending.
 */
import { useCallback } from "react";
import { Modal, Pressable, Text, View, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { ListifyFonts } from "@/constants/typography";

const BRAND     = "#27BB97";
const TEXT_DARK = "#1A1A1A";

export type LocalAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  kind: "image" | "video";
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onPicked: (attachments: LocalAttachment[]) => void;
};

function mimeFromAsset(a: ImagePicker.ImagePickerAsset): string {
  if (a.mimeType) return a.mimeType;
  if (a.type === "video") return "video/mp4";
  return "image/jpeg";
}

function nameFromAsset(a: ImagePicker.ImagePickerAsset, idx: number): string {
  if (a.fileName) return a.fileName;
  const ext = a.type === "video" ? "mp4" : "jpg";
  return `chat-${Date.now()}-${idx}.${ext}`;
}

function toLocal(assets: ImagePicker.ImagePickerAsset[]): LocalAttachment[] {
  return assets.map((a, i) => ({
    uri:      a.uri,
    name:     nameFromAsset(a, i),
    mimeType: mimeFromAsset(a),
    size:     (a as { fileSize?: number }).fileSize,
    kind:     a.type === "video" ? "video" : "image",
  }));
}

// SDK 54+ uses string array (`mediaTypes: ["images","videos"]`). Older builds
// understood `MediaTypeOptions.All`. We use the new shape because it matches
// the rest of the codebase (e.g. post-ad media picker).
const PICK_MEDIA: Array<"images" | "videos"> = ["images", "videos"];

export function AttachmentPickerSheet({ visible, onClose, onPicked }: Props) {
  const insets = useSafeAreaInsets();

  const takePhoto = useCallback(async () => {
    onClose();
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera permission needed", "Please enable camera access in Settings.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: PICK_MEDIA,
        quality:    0.8,
        videoMaxDuration: 60,
      });
      if (res.canceled || !res.assets?.length) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPicked(toLocal(res.assets));
    } catch (e: any) {
      Alert.alert("Camera Error", e?.message ?? "Could not open camera.");
    }
  }, [onClose, onPicked]);

  const pickFromGallery = useCallback(async () => {
    onClose();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Library permission needed", "Please enable photo library access in Settings.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: PICK_MEDIA,
        quality:    0.8,
        allowsMultipleSelection: true,
        selectionLimit: 6,
      });
      if (res.canceled || !res.assets?.length) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPicked(toLocal(res.assets));
    } catch (e: any) {
      Alert.alert("Gallery Error", e?.message ?? "Could not open gallery.");
    }
  }, [onClose, onPicked]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} onPress={onClose} />
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 16),
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#E5E7EB",
              marginBottom: 16,
            }}
          />
          <Text style={{ fontFamily: ListifyFonts.semiBold, fontSize: 14, color: TEXT_DARK, marginBottom: 12 }}>
            Share
          </Text>
          <View style={{ flexDirection: "row", gap: 18 }}>
            <Tile icon="photo-camera" label="Camera" tint="#3B82F6" onPress={takePhoto} />
            <Tile icon="photo-library" label="Gallery" tint="#A855F7" onPress={pickFromGallery} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Tile({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: tint + "22",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <MaterialIcons name={icon} size={28} color={tint} />
      </View>
      <Text style={{ fontFamily: ListifyFonts.regular, fontSize: 12, color: TEXT_DARK }}>{label}</Text>
    </Pressable>
  );
}
