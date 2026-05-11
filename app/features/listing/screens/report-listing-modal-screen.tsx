import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "@/lib/safe-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ReportReason = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
};

const reasons: ReportReason[] = [
  { id: "spam", label: "Spam", icon: "info" },
  { id: "fraud", label: "Fraud / Scams", icon: "gavel" },
  { id: "duplicate", label: "Duplicate Listing", icon: "content-copy" },
  {
    id: "offensive",
    label: "Offensive Content",
    icon: "sentiment-very-dissatisfied",
  },
  { id: "category", label: "Incorrect Category", icon: "category" },
];

export function ReportListingModalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState("spam");
  const [comments, setComments] = useState("");

  return (
    <View className="flex-1 bg-[#161D1A]/40">
      {/* Backdrop */}
      <Pressable
        onPress={() => router.back()}
        className="flex-1"
        style={{ minHeight: 60 }}
      />

      {/* Bottom Sheet */}
      <View
        className="rounded-t-[32px] bg-white"
        style={{
          paddingBottom: Math.max(insets.bottom, 16),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -12 },
          shadowOpacity: 0.15,
          shadowRadius: 40,
          elevation: 24,
          maxHeight: "85%",
        }}
      >
        {/* Handle */}
        <View className="items-center py-4">
          <View className="h-1.5 w-12 rounded-full bg-[#DDE4DF]" />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16 }}
        >
          {/* Header */}
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="text-[20px] font-semibold text-[#161D1A]">
              Report this Ad
            </Text>
            <Pressable
              onPress={() => router.back()}
              className="rounded-full p-2"
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#EFF5F0" : "transparent",
              })}
            >
              <MaterialIcons name="close" size={24} color="#161D1A" />
            </Pressable>
          </View>

          {/* Reasons */}
          <View className="mb-8 gap-2">
            {reasons.map((reason) => {
              const isSelected = reason.id === selectedReason;
              return (
                <Pressable
                  key={reason.id}
                  onPress={() => setSelectedReason(reason.id)}
                  className="flex-row items-center rounded-xl bg-[#EFF5F0] p-4"
                  style={{
                    borderWidth: 1,
                    borderColor: isSelected ? "#27BB97" : "transparent",
                  }}
                >
                  {/* Radio */}
                  <View
                    className="h-5 w-5 items-center justify-center rounded-full border-2"
                    style={{
                      borderColor: isSelected ? "#006B55" : "#6C7A74",
                      backgroundColor: isSelected ? "#006B55" : "transparent",
                    }}
                  >
                    {isSelected && (
                      <View className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </View>
                  <Text className="ml-4 flex-1 text-[16px] text-[#161D1A]">
                    {reason.label}
                  </Text>
                  <MaterialIcons name={reason.icon} size={22} color="#6C7A74" />
                </Pressable>
              );
            })}
          </View>

          {/* Comment */}
          <View className="mb-8">
            <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
              Additional Comments (Optional)
            </Text>
            <TextInput
              value={comments}
              onChangeText={setComments}
              placeholder="Provide more details to help us investigate..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="min-h-[90px] rounded-xl border border-[#DDE4DF] bg-[#EFF5F0] p-4 text-[14px] text-[#161D1A]"
            />
          </View>

          {/* Actions */}
          <View className="gap-3">
            <Pressable
              className="overflow-hidden rounded-xl"
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <LinearGradient
                colors={["#BA1A1A", "#D32F2F"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{
                  height: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <MaterialIcons name="report" size={20} color="#FFFFFF" />
                <Text className="text-[18px] font-semibold text-white">
                  Submit Report
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              className="h-12 items-center justify-center rounded-xl bg-[#E3EAE5]"
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Text className="text-[18px] font-semibold text-[#3C4A44]">
                Cancel
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
