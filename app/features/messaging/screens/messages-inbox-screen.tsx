import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";

type Chat = {
  id: string;
  name: string;
  avatar: string;
  message: string;
  time: string;
  unread?: number;
  online?: boolean;
  read?: boolean;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
};

const chats: Chat[] = [
  { id: "1", name: "Priya Sharma", avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAw5T9JT8xAHK95_hBh4zI4YOfw0miPlVgE6p2rbSdbhBAhXjgcDUowLDaf9NACVTTwmTMAZPgOhXFUxYuLymwKR1MgjrIeLw-L-UagxlPd_PP4Z0tEgW9sI6F8A9S203z9Niiff55i957tCTlFh1CuWehTVerfaML3NmZFTjM_LX9jSv_f6CmmjS9i_L7Bx_Z-H5MhoBRoWxHAqGeIbUkRDAw-4BN_ZYRzTq-9nHG7uUZcGiuDy1phHYtyxI_LzeZ-_vCHkVe7hQg", message: "Is the price negotiable?", time: "2m ago", unread: 1, online: true },
  { id: "2", name: "Rahul Mehta", avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDrNR7ui7N2n7aTNKMnWRihV7Qo_xL2luZfFN_AigTazYiuSFmnOpbe9JwoJk1PYZMkLUpre5sxZHHm7sFpAWBO98t2N89yY17gySNXLLPTwWVN7-bn4G7H19yp6wAXkBRA1eS555TFne7jH_9NtiEtQOiGMFNFWGeX_M0hSK_mhplhBKSFLpUZeM3tu1UMcx87m-E-m6l9R-6kglzq0K58EUsYSxS6p4-QNhDIxvtjbVovPSiXin9jAiilyZ65TE0Dp0Ojpnqnlmc", message: "I can pick it up tomorrow", time: "1h ago", read: true },
  { id: "3", name: "Sarah Chen", avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCPuNf6K1fD0hXu_FMLokrTfNFyMdN0AaNgWAn13AwBXmiQEWfx6d--63GXPt9iLaC9jgfuZK2aTabo8-qBw82u3xjF4ha3wl2nvCVYPykhDFxk_m8lnpOVgKKdjR_9bqkHuN5su6ELeVPVvi2J8bh-Xs8WJwp8p4AOu5f20VRy0RxkL2cbkNCp43A-eVZfpjeO0eaPeCGJ5AVWVaA1XcdQFMVgCBsQJK1GgQ2pERToNoa9pYp4bI7bvZ9WAW1zYJZ9lnPTyFxtzCg", message: "Sent the offer!", time: "Yesterday", icon: "sell" },
  { id: "4", name: "Michael Scott", avatar: "", message: "Is this still available?", time: "Yesterday" },
];

const filterChips = ["All", "Unread", "Buying", "Selling"];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const, active: true },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function MessagesInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const handleBottomTabPress = useTabNavigation();

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="arrow-back" size={24} color="#27BB97" />
          </Pressable>
          <Text className="text-[14px] font-semibold tracking-tight text-[#161D1A]">Messages</Text>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <MaterialIcons name="settings" size={24} color="#27BB97" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 84 + bottomNavPadding }}>
        <View className="px-4">
          {/* Search */}
          <View className="mb-6 h-12 flex-row items-center rounded-xl border border-[#BBCAC3] bg-[#EFF5F0] px-4">
            <MaterialIcons name="search" size={22} color="#6C7A74" />
            <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search conversations..." placeholderTextColor="#94A3B8" className="ml-2 flex-1 text-[14px] text-[#161D1A]" style={{ paddingVertical: 0 }} />
          </View>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6" contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {filterChips.map((chip) => (
              <Pressable
                key={chip}
                onPress={() => setActiveFilter(chip)}
                className="rounded-full px-4 py-1.5"
                style={{ backgroundColor: chip === activeFilter ? "#27BB97" : "#FFFFFF", borderWidth: chip === activeFilter ? 0 : 1, borderColor: "#BBCAC3" }}
              >
                <Text className="text-[12px] font-medium" style={{ color: chip === activeFilter ? "#FFFFFF" : "#3C4A44" }}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Chat List */}
          <View className="gap-1">
            {chats.map((chat) => (
              <Pressable
                key={chat.id}
                onPress={() => router.push({ pathname: "/chat-conversation", params: { name: chat.name } })}
                className="flex-row items-center gap-4 rounded-2xl p-4"
                style={({ pressed }) => ({
                  backgroundColor: chat.unread ? "rgba(255,255,255,0.7)" : pressed ? "rgba(255,255,255,0.5)" : "transparent",
                  borderWidth: chat.unread ? 1 : 0,
                  borderColor: chat.unread ? "#F3F4F6" : "transparent",
                  shadowColor: chat.unread ? "#000" : "transparent",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: chat.unread ? 0.05 : 0,
                  shadowRadius: chat.unread ? 3 : 0,
                  elevation: chat.unread ? 1 : 0,
                })}
              >
                {/* Avatar */}
                <View className="relative">
                  {chat.avatar ? (
                    <Image source={chat.avatar} contentFit="cover" className="h-14 w-14 rounded-full" />
                  ) : (
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-[#DDE4DF]">
                      <MaterialIcons name="person" size={24} color="#6C7A74" />
                    </View>
                  )}
                  {chat.online && <View className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />}
                </View>
                {/* Content */}
                <View className="flex-1">
                  <View className="flex-row items-baseline justify-between mb-0.5">
                    <Text className="text-[18px] font-semibold text-[#161D1A]" numberOfLines={1}>{chat.name}</Text>
                    <Text className="text-[12px] font-medium" style={{ color: chat.unread ? "#27BB97" : "#6C7A74" }}>{chat.time}</Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 flex-row items-center gap-1">
                      {chat.read && <MaterialIcons name="done-all" size={16} color="#6C7A74" />}
                      {chat.icon && <MaterialIcons name={chat.icon} size={16} color="#6C7A74" />}
                      <Text className="text-[14px]" style={{ color: chat.unread ? "#161D1A" : "#3C4A44", fontWeight: chat.unread ? "600" : "400" }} numberOfLines={1}>{chat.message}</Text>
                    </View>
                    {chat.unread && (
                      <View className="ml-4 h-5 w-5 items-center justify-center rounded-full bg-[#27BB97]">
                        <Text className="text-[10px] font-bold text-white">{chat.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-100 bg-white" style={{ paddingTop: 12, paddingBottom: bottomNavPadding, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 8 }}>
        <View className="flex-row items-end justify-around px-2">
          {bottomTabs.map((tab) => {
            if (tab.highlight) {
              return (
                <Pressable key={tab.id} onPress={() => handleBottomTabPress(tab.id)} className="items-center justify-center" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <View className="-mt-7 rounded-full border-4 border-[#F4FBF6] bg-[#27BB97] p-2.5" style={{ shadowColor: "#27BB97", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}>
                    <MaterialIcons name={tab.icon} size={24} color="#FFFFFF" />
                  </View>
                  <Text className="mt-1 text-[11px] font-medium tracking-wide text-slate-400">{tab.label}</Text>
                </Pressable>
              );
            }
            return (
              <Pressable key={tab.id} onPress={() => handleBottomTabPress(tab.id)} className="items-center py-1" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <MaterialIcons name={tab.icon} size={24} color={tab.active ? "#27BB97" : "#94A3B8"} />
                <Text className="text-[11px] font-medium tracking-wide" style={{ color: tab.active ? "#27BB97" : "#94A3B8" }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
