import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";

type SavedItem = {
  id: string;
  title: string;
  price: string;
  location: string;
  timeAgo: string;
  image: string;
  wide?: boolean;
};

const savedItems: SavedItem[] = [
  {
    id: "1",
    title: "Elegant Modern Living Sofa",
    price: "₹24,999",
    location: "Indiranagar, Bangalore",
    timeAgo: "2h ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAHKuRSqBvFz-njyFPuaLRGuY2K8EBqo1tMeABWJW0980o5B2CbGHwlqB0gWK3hmcJ6QkfnFGojFw7PvCsIp2B7QlVzBYn2ZmFGJeks70ffx8iresJ8GyWyjlho24AkxrQE95hDxy2hIBAfeSd8ByLzS66ApdRvC9OzIFwNeYNf5KhgHBWZ7vz-pNUAtXVuw8-pXUbxx29-s5tGenJmSOkpAzqqzcgvdUbEq_vUKGrDP9FY0TJz19jER-WHnP4H1w4kNOzk3jb8cN0",
    wide: true,
  },
  {
    id: "2",
    title: "Custom Mechanical Keyboard",
    price: "₹8,499",
    location: "HSR Layout",
    timeAgo: "1d ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCXgVpcVwfJEDPZ6ETM5pkAqFxWrP4DIH3VBTZ5LZlCFyOpn6ZtJasBBR8_EA6FaV-zd_P-l4FoCJ_tzxqP38MERCqmsyieRf06H7Lj7CAxXsSeo7jAMVXHqFQRw8GDOnkIaAftz8ZXNFa0WcTXSAXI3-4W00w-2D3B0d0sHEqfo7R7Dq2aMWf1tAOa3NhT1abUb6PBg8HF78H5ljqc4x0X9n7A5BcV-2sw0Z5zNdTVlhaVhFlMnfmJ5qBDhSyxnb8pDClatmD-qwc",
  },
  {
    id: "3",
    title: "Sony WH-1000XM5",
    price: "₹24,999",
    location: "Koramangala",
    timeAgo: "3d ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBeyypC9Pkdh5GZ1qKRPhQX4yH7GqijYr8hDQh5LJroDA1bzliiq4ZTYZ32-Fac6NuVJSJK6Q7OYxQn9NIp2mEbWtkzYq0sx3m01tm1syRytlskMkOx7msMKHxUGm5zfTq3rQIgqOCdxn6Vy5mN-7tVEB0U1SrPLBHqFQqzDQt_7AVUzq_9CtGTDF819_jSGomEX06yaeshctu101LBsHi7dfb0iVr2JdJC61xw1HSyNn2xenIavWGT2t2Q0yCAcS61l1IO9-DWs5w",
  },
  {
    id: "4",
    title: "Nike Air Zoom Pulse",
    price: "₹5,200",
    location: "MG Road",
    timeAgo: "5d ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCS23_BQR_idKthAezAeDcFIDhoacF1CAF38RjLvBVBE-YTYCVmYGl1lrMab_i66GqNA2YYfwNTWLKTZGHNMh03sq8Wib7xalZ6kY_nKWg0z90fAqqWtdoCt0t7jQtaz9azz8_bqzbXR21g0szBtvT82R4o3qjUmdRnOx2_RGGxIppGgfJ9GtDs4sg-G0xV9jPCMyLH3hVKQdMvJLGpoPIxuWh8AcmvDxMBbN-LEUk_hCC4kmeyPGObLFWWvABQUpyH_v9yTWKJDmQ",
  },
  {
    id: "5",
    title: "Vintage Record Player",
    price: "₹6,500",
    location: "Jayanagar",
    timeAgo: "1w ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBXuo6LzQc-Mij-_BvqApAiuGeVZjLT0p72YYK7WwfvGNiU5KVk_YPcMe5dG5C6hSyjlfjoAiq47yweiyuCU7KRlR4DtdFL8QeFjvAOPU28CWI0fkj-bczfgdeuRJd98TeOqZt6YRWFlfelf3845KQTVIDCBRuTNc8w_WpvEsiNTLEbcOuBwz_ixJK3qJ32sitTBZZ-pcOvXvuVihZmLqAjdOTZTGzFvlFcZelNgfQY1MTz7IbGJTYzlCGvo2BUx-qmDqmRVEAXkvk",
  },
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function SavedItemsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);

  const handleBottomTabPress = useTabNavigation();

  const wideItem = savedItems.find((i) => i.wide);
  const gridItems = savedItems.filter((i) => !i.wide);

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
      >
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} className="rounded-full p-1">
            <MaterialIcons name="arrow-back" size={24} color="#161D1A" />
          </Pressable>
          <Text className="text-[20px] font-bold tracking-tight text-[#161D1A]">Saved Items</Text>
        </View>
        <Pressable className="rounded-full p-2">
          <MaterialIcons name="filter-list" size={24} color="#64748B" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 84 + bottomNavPadding }}
      >
        <View className="px-4">
          {/* Count */}
          <Text className="mb-6 text-[14px] text-[#6C7A74]">
            <Text className="font-bold text-[#27BB97]">{savedItems.length}</Text> saved items
          </Text>

          {/* Wide Card */}
          {wideItem && (
            <Pressable
              className="mb-4 overflow-hidden rounded-xl border border-slate-100 bg-white"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
            >
              <View className="relative h-52 w-full">
                <Image source={wideItem.image} contentFit="cover" className="h-full w-full" />
                <Pressable className="absolute right-3 top-3 rounded-full bg-white/70 p-2">
                  <MaterialIcons name="favorite" size={20} color="#EF4444" />
                </Pressable>
              </View>
              <View className="p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-[16px] font-semibold text-[#161D1A]">{wideItem.title}</Text>
                    <View className="mt-1 flex-row items-center gap-1">
                      <MaterialIcons name="location-on" size={14} color="#94A3B8" />
                      <Text className="text-[12px] text-[#6C7A74]">{wideItem.location}</Text>
                    </View>
                  </View>
                  <Text className="text-[18px] font-bold text-[#27BB97]">{wideItem.price}</Text>
                </View>
                <Text className="mt-2 text-[11px] text-[#94A3B8]">{wideItem.timeAgo}</Text>
              </View>
            </Pressable>
          )}

          {/* 2-Column Grid */}
          <View className="flex-row flex-wrap gap-3">
            {gridItems.map((item) => (
              <Pressable
                key={item.id}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white"
                style={{
                  width: "48%",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <View className="relative aspect-square w-full">
                  <Image source={item.image} contentFit="cover" className="h-full w-full" />
                  <Pressable className="absolute right-2 top-2 rounded-full bg-white/70 p-1.5">
                    <MaterialIcons name="favorite" size={16} color="#EF4444" />
                  </Pressable>
                </View>
                <View className="p-3">
                  <Text className="text-[14px] font-bold text-[#27BB97]">{item.price}</Text>
                  <Text className="mt-0.5 text-[12px] font-medium text-[#161D1A]" numberOfLines={1}>{item.title}</Text>
                  <View className="mt-1 flex-row items-center gap-0.5">
                    <MaterialIcons name="location-on" size={12} color="#94A3B8" />
                    <Text className="text-[11px] text-[#6C7A74]" numberOfLines={1}>{item.location}</Text>
                  </View>
                  <Text className="mt-1 text-[10px] text-[#94A3B8]">{item.timeAgo}</Text>
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
                <MaterialIcons name={tab.icon} size={24} color="#94A3B8" />
                <Text className="text-[11px] font-medium tracking-wide text-[#94A3B8]">{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
