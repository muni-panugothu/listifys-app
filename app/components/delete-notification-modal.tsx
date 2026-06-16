import { MaterialIcons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";

import { ListifyFonts } from "@/constants/typography";

type DeleteNotificationModalProps = {
  visible: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteNotificationModal({
  visible,
  loading = false,
  onCancel,
  onConfirm,
}: DeleteNotificationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        className="flex-1 items-center justify-center px-4"
        style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      >
        <Pressable className="absolute inset-0" onPress={onCancel} />
        <View
          className="w-full max-w-sm overflow-hidden rounded-2xl bg-white"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <View className="items-center p-6">
            <View
              className="mb-4 h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
            >
              <MaterialIcons name="delete-outline" size={30} color="#EF4444" />
            </View>

            <Text
              className="mb-1 text-center text-[20px]"
              style={{ fontFamily: ListifyFonts.bold, color: "#161D1A" }}
            >
              Delete notification?
            </Text>
            <Text
              className="mb-6 text-center text-[14px] leading-5"
              style={{ fontFamily: ListifyFonts.regular, color: "#6C7A74" }}
            >
              This notification will be removed from your inbox. You can&apos;t undo this action.
            </Text>

            <View className="w-full gap-3">
              <Pressable
                onPress={onConfirm}
                disabled={loading}
                className="h-12 flex-row items-center justify-center gap-2 rounded-xl"
                style={({ pressed }) => ({
                  backgroundColor: "#EF4444",
                  opacity: loading ? 0.6 : pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <MaterialIcons name="delete" size={20} color="#FFFFFF" />
                )}
                <Text
                  className="text-[16px] text-white"
                  style={{ fontFamily: ListifyFonts.semiBold }}
                >
                  Delete
                </Text>
              </Pressable>
              <Pressable
                onPress={onCancel}
                disabled={loading}
                className="h-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white"
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <Text
                  className="text-[16px]"
                  style={{ fontFamily: ListifyFonts.semiBold, color: "#161D1A" }}
                >
                  Keep notification
                </Text>
              </Pressable>
            </View>
          </View>

          <View
            className="flex-row items-center justify-center gap-2 border-t border-slate-50 px-6 py-4"
            style={{ backgroundColor: "#F9FAFB" }}
          >
            <MaterialIcons name="notifications-none" size={16} color="#9CA3AF" />
            <Text
              className="text-[12px]"
              style={{ fontFamily: ListifyFonts.regular, color: "#9CA3AF" }}
            >
              Long-press any notification to delete
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
