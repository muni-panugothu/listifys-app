import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

const contactAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAkbDj3WVZlplCzzdMgPqKGMWUR41rieSQRogJn6V5hIlmTfa5SJwCm2-VdoE0O4pPyF4RS0PTAtkjbHFM7w9hX4bTTLOKGehPKsw5exMOp7TmWuTSTdGH0uRySutMVmSPp_dvHQIYGfZDLuhvAig3sc6XR_B_h0zCW4PAzhyKZGVE7T31wVkrqnWYH7Y6dUkM08OPlCPb6tUtifXh8x7FygapuSFls775-clKIWj8mG8tT0m-tw32MODbEXwqO0EpOyMBjr8i31Wk";

const productImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBCksGlF_ziSLbrYueZLbgXejWzJj1EWxFYBbz09ok6lGfgWjNTGZEeKbUbho7b53LaaXM320UOaT1rxdD_dkXolST52N857_b1XO6lt_3kEqugcesj_51eGY6ToiJUQ6UOFGiyazQB6Hq1qid2LAFIPnge5jL3mCdmLCennl8HsuScg0CmmIYAXgM3_aCetSESsjO8Rh_2iId4PrT0kn4tkikRDxdsIUHvCmyG_6HyaCthhuPtxVuDZ-Zx7LDq-ezlG9V_5T0Kf3Y";

type Message = {
  id: string;
  text: string;
  time: string;
  fromMe: boolean;
  read?: boolean;
};

const messages: Message[] = [
  { id: "1", text: "Hi, is the MacBook still available?", time: "1:58 PM", fromMe: false },
  { id: "2", text: "Yes, it is!", time: "2:01 PM", fromMe: true, read: true },
  { id: "3", text: "Great! Is the price negotiable?", time: "2:04 PM", fromMe: false },
];

export function ChatConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const [messageText, setMessageText] = useState("");

  const contactName = typeof params.name === "string" ? params.name : params.name?.[0] ?? "Priya Sharma";

  return (
    <View className="flex-1 bg-white">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="arrow-back" size={24} color="#27BB97" />
          </Pressable>
          <View className="relative">
            <Image source={contactAvatar} contentFit="cover" className="h-10 w-10 rounded-full" style={{ borderWidth: 2, borderColor: "rgba(39,187,151,0.2)" }} />
            <View className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#27BB97]" />
          </View>
          <View>
            <Text className="text-[14px] font-semibold tracking-tight text-[#161D1A]">{contactName}</Text>
            <Text className="text-[10px] font-medium text-[#27BB97]">Online</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-4">
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="videocam" size={22} color="#64748B" /></Pressable>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="call" size={22} color="#64748B" /></Pressable>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}><MaterialIcons name="settings" size={22} color="#64748B" /></Pressable>
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 84 + Math.max(insets.bottom, 8), paddingHorizontal: 16, gap: 24 }}>
          {/* Product Context Card */}
          <Pressable className="flex-row items-center gap-3 rounded-xl border border-[#BBCAC3]/30 bg-[#EFF5F0] p-3">
            <Image source={productImage} contentFit="cover" className="h-12 w-12 rounded-lg" />
            <View className="flex-1">
              <Text className="text-[12px] font-medium text-[#3C4A44]">Inquired about</Text>
              <Text className="text-[14px] font-semibold text-[#161D1A]">MacBook Pro M2 - 14 inch</Text>
              <Text className="text-[14px] font-bold text-[#27BB97]">₹1,24,000</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
          </Pressable>

          {/* Date Divider */}
          <View className="items-center">
            <View className="rounded-full bg-[#E3EAE5] px-3 py-1">
              <Text className="text-[10px] font-medium uppercase tracking-wider text-[#3C4A44]">Today</Text>
            </View>
          </View>

          {/* Messages */}
          {messages.map((msg) => (
            <View key={msg.id} style={{ alignItems: msg.fromMe ? "flex-end" : "flex-start", maxWidth: "85%" , alignSelf: msg.fromMe ? "flex-end" : "flex-start" }}>
              <View className="rounded-2xl p-4" style={{
                backgroundColor: msg.fromMe ? "#27BB97" : "#FFFFFF",
                borderWidth: msg.fromMe ? 0 : 1,
                borderColor: "#F3F4F6",
                borderBottomRightRadius: msg.fromMe ? 4 : 16,
                borderBottomLeftRadius: msg.fromMe ? 16 : 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: msg.fromMe ? 0.1 : 0.05,
                shadowRadius: msg.fromMe ? 4 : 2,
                elevation: msg.fromMe ? 2 : 1,
              }}>
                <Text className="text-[14px] leading-5" style={{ color: msg.fromMe ? "#FFFFFF" : "#161D1A" }}>{msg.text}</Text>
              </View>
              <View className="mt-1 flex-row items-center gap-1" style={{ marginLeft: msg.fromMe ? 0 : 4, marginRight: msg.fromMe ? 4 : 0 }}>
                <Text className="text-[10px] text-[#94A3B8]">{msg.time}</Text>
                {msg.read && <MaterialIcons name="done-all" size={12} color="#27BB97" />}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Input Area */}
        <View className="border-t border-slate-100 bg-white px-4 py-3" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
          <View className="flex-row items-end gap-3">
            <View className="flex-row items-center gap-1 mb-2">
              <Pressable className="h-10 w-10 items-center justify-center"><MaterialIcons name="add-circle" size={24} color="#94A3B8" /></Pressable>
              <Pressable className="h-10 w-10 items-center justify-center"><MaterialIcons name="photo-camera" size={24} color="#94A3B8" /></Pressable>
            </View>
            <View className="flex-1 relative">
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type a message..."
                placeholderTextColor="#94A3B8"
                multiline
                className="max-h-32 rounded-2xl bg-slate-50 px-4 py-3 pr-12 text-[14px] text-[#161D1A]"
              />
              <Pressable className="absolute bottom-1.5 right-2 h-9 w-9 items-center justify-center rounded-xl bg-[#27BB97]" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
                <MaterialIcons name="send" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
