import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GUTTER = 12;
const GRID_SIDE_PADDING = 16;
const PRODUCT_CARD_WIDTH =
  (SCREEN_WIDTH - GRID_SIDE_PADDING * 2 - GRID_GUTTER) / 2;

type ProductItem = {
  id: string;
  title: string;
  price: string;
  location: string;
  timeAgo: string;
  image: string;
  premium?: boolean;
};

const subcategories = [
  "All",
  "Laptops",
  "Tablets",
  "Headphones",
  "Cameras",
  "Gaming",
];

const products: ProductItem[] = [
  {
    id: "macbook-pro-m2",
    title: "MacBook Pro M2 - 512GB",
    price: "₹1,24,990",
    location: "Bandra, Mumbai",
    timeAgo: "2h ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCbLGKg_VLrCivipA5M1mqlXsTOqme6F41Vq-UknnSRxbahLGbjqBlq4UQA5UDMTwX9KJkJogG7jCUCJ67R_Gw3ea2gn453ZiaI9Wya7CAiG9VXEe_76mLMm_6uoR3VQ48RYOPa7SI5Sh28hyY2q2EfleRJii1ze-ONG0ioNI6kR73b537p8ovXxbYcvZUHSfRMyJkOpPFUzFYnasl-7HC7IgLqkyi2cNgM4_sehXPPMaBzejN0ZHJmWh_XKeeXJPDkHDkvbuwxaJA",
    premium: true,
  },
  {
    id: "ipad-pro-11",
    title: "iPad Pro 11-inch (Gen 4)",
    price: "₹74,500",
    location: "Indiranagar, BLR",
    timeAgo: "4h ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDyow35OEXh_uvjAffJp2lg7i04735UV0MXGi3Qv242cqTCA3fyUCMHA2HgRVb0nuOyH2t9SFI7nRwdadh1JUSixz-1lSsHTgQyfTynWA7-jhQWxpJgBRLfBHoM8Myk1AePimY_K36dLnuh1MvmLm9bVpTSdoY-DzC7mnSRX9zNQRTt0-QAzjet2Qih8mdbYO58y61wEgf8KpP4AT6NIohjuRCjR2ITv_Ctw_sel2lfoPjWakMKF9TiZAfXPXNBe0lhy4R2bDD72do",
  },
  {
    id: "sony-xm5",
    title: "Sony WH-1000XM5 ANC",
    price: "₹18,900",
    location: "Saket, Delhi",
    timeAgo: "1h ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCNwSJa5uAkoWfdr6cIzgx0ckC4kG8jfjsp4DAEytcQBSV4xJXXw835uMzMxSf--wKvpwSk1JNg7fJFPU1jFzUTkHXIO7SicyvmXuVcPgIyshxf9z6s52iK68JRSYLx1j1OCEXtlwCP7YLqhjiC9aXkIL2NVWnloaAAY1_oZr7W14yxLfZYjY9BRlBOBn0S4fahSBEuGk4LrlA-s6eeBkszUH5zdGRDW9hu3l7kDtFt38RZ4IURvW0LfzFCS--mFpSL8SYgMahwb0k",
  },
  {
    id: "sony-a7iv",
    title: "Sony A7 IV + 24-70mm Lens",
    price: "₹2,10,000",
    location: "Koramangala, BLR",
    timeAgo: "5h ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBQX3oLLzH4N25jOFTA6d_e0yN2L9_PjbDayHlzvWgLT-Vxzw2-lAVovxuGrQaDXHUGKDWDh23-V73uDCcDp4twMi_x-M84N6nB6YqItJ-nU0Di-QxTcZbCcRjC31mS7r1PeiIQ3O7gR6iaWFXYQ8kV2fAUzi5TVgyWf6R3N7fNSg2djsfRj5nFXTnoapsu06VMNMkQXEipTRVueWf_NjiYXnsHtkdNdgddDG2zfmmzYqT_NlxXNb-zCQWqzYxSiEwUTICoYOTwsFk",
  },
  {
    id: "ps5-console",
    title: "PS5 Console + 2 Controllers",
    price: "₹39,990",
    location: "Kolkata, WB",
    timeAgo: "3h ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDtQyOB7BAIRJuv1yoNpSxlXr6SJ7ohydm9TSZ1FWrKZqY2028nwvJdsD5GrE7w48P9ks_JSgZrHldPQ_fyhMen3yPH8_d6vnWc3u8Evu0qPQfaIdOuPIgG_fEGJHtX9c5Y5QLCrF7t9EkhFtePpBqfSVq_SRvCh96kIL_7UN7oct8zH2WieZB4j1vXvd9dDcnp6UEwJuss7oye90KIrfnYBaESSCktK39EMdjiBSF_pXKVAgwzUa_FObJKqLzVJh8rD8gLN7dUm8Q",
  },
  {
    id: "apple-watch-8",
    title: "Apple Watch Series 8",
    price: "₹32,500",
    location: "Pune, MH",
    timeAgo: "6h ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDSbt51JwbYsz8_fionbFdezafxcEsZgkgLRM2YzpQVXFfQDpfJfRku3TbnktoO7YzLi2f5QBrOdKDIxcjSY2_KlQf390UzLr6vI4rqOm-wVBYFMKDnSOoHzb9emcUxMExLRTPP2xInxe3Dacz-G8OnJT5gT_sZoyTa6_KmRlnDFYoeQgIJedLbjV64wJSHaJftWEpSlfk0LetuJd-x8FhyEi9nGKRpVAEAH49yJLHlGSb2Kr3Pmro1CfuFc6LXraPOHZgBVyndGuE",
  },
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function CategoryListingTemplateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);

  const handleBottomTabPress = useTabNavigation();

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{
          paddingTop: insets.top,
          height: topBarHeight,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={22} color="#0F172A" />
          </Pressable>
          <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
            Electronics
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full"
            onPress={() => router.push("/search-home")}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="search" size={22} color="#0F172A" />
          </Pressable>
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons
              name="notifications-none"
              size={22}
              color="#0F172A"
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topBarHeight + 8,
          paddingBottom: 84 + bottomNavPadding,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 8,
            paddingVertical: 8,
          }}
        >
          {subcategories.map((chip) => {
            const isActive = chip === selectedSubcategory;
            return (
              <Pressable
                key={chip}
                onPress={() => setSelectedSubcategory(chip)}
                className="rounded-full px-4 py-2"
                style={{
                  backgroundColor: isActive ? "#27BB97" : "#E9EFEB",
                  shadowColor: isActive ? "#27BB97" : "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isActive ? 0.22 : 0.04,
                  shadowRadius: 2,
                  elevation: isActive ? 2 : 1,
                }}
              >
                <Text
                  className="text-[12px] font-medium"
                  style={{ color: isActive ? "#FFFFFF" : "#3C4A44" }}
                >
                  {chip}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="flex-row items-center justify-between px-4 py-4">
          <Pressable
            className="flex-row items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-1.5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <MaterialIcons name="tune" size={18} color="#161D1A" />
            <Text className="text-[12px] font-medium text-[#161D1A]">
              Filters
            </Text>
            <View className="h-4 w-4 items-center justify-center rounded-full bg-[#27BB97]">
              <Text className="text-[10px] font-semibold text-white">2</Text>
            </View>
          </Pressable>

          <Pressable
            className="flex-row items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-1.5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <Text className="text-[12px] font-medium text-slate-500">
              Sort:
            </Text>
            <Text className="text-[12px] font-semibold text-[#161D1A]">
              Recommended
            </Text>
            <MaterialIcons
              name="keyboard-arrow-down"
              size={18}
              color="#161D1A"
            />
          </Pressable>
        </View>

        <View
          className="flex-row flex-wrap px-4"
          style={{ columnGap: GRID_GUTTER, rowGap: GRID_GUTTER }}
        >
          {products.map((product) => (
            <Pressable
              key={product.id}
              onPress={() => router.push("/listing-detail-template")}
              className="overflow-hidden rounded-xl border border-slate-100 bg-white"
              style={{
                width: PRODUCT_CARD_WIDTH,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View
                style={{
                  width: PRODUCT_CARD_WIDTH,
                  height: PRODUCT_CARD_WIDTH,
                }}
              >
                <Image
                  source={product.image}
                  contentFit="cover"
                  transition={200}
                  className="h-full w-full"
                />

                <Pressable className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/80">
                  <MaterialIcons
                    name="favorite-border"
                    size={20}
                    color="#0F172A"
                  />
                </Pressable>

                {product.premium ? (
                  <View className="absolute bottom-2 left-2 rounded-md bg-white/80 px-2 py-1">
                    <Text className="text-[10px] font-bold text-[#0F172A]">
                      PREMIUM
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="gap-1 p-3">
                <Text className="text-[16px] font-bold text-[#27BB97]">
                  {product.price}
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-[14px] font-semibold leading-4 text-[#161D1A]"
                >
                  {product.title}
                </Text>
                <View className="mt-1 flex-row items-center gap-1">
                  <MaterialIcons name="location-on" size={14} color="#64748B" />
                  <Text className="text-[10px] font-medium uppercase text-slate-500">
                    {product.location}
                  </Text>
                </View>
                <Text className="text-[10px] font-medium text-slate-400">
                  {product.timeAgo}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-100 bg-white"
        style={{
          paddingTop: 12,
          paddingBottom: bottomNavPadding,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View className="flex-row items-end justify-around px-2">
          {bottomTabs.map((tab) => {
            if (tab.highlight) {
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => handleBottomTabPress(tab.id)}
                  className="items-center justify-center"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <View
                    className="-mt-7 rounded-full border-4 border-[#F4FBF6] bg-[#27BB97] p-2.5"
                    style={{
                      shadowColor: "#27BB97",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <MaterialIcons name={tab.icon} size={24} color="#FFFFFF" />
                  </View>
                  <Text className="mt-1 text-[11px] font-medium tracking-wide text-slate-400">
                    {tab.label}
                  </Text>
                </Pressable>
              );
            }

            return (
              <Pressable
                key={tab.id}
                onPress={() => handleBottomTabPress(tab.id)}
                className="items-center py-1"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={24}
                  color={tab.active ? "#27BB97" : "#94A3B8"}
                />
                <Text
                  className="text-[11px] font-medium tracking-wide"
                  style={{ color: tab.active ? "#27BB97" : "#94A3B8" }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
