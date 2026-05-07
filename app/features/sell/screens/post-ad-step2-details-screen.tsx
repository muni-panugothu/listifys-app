import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const conditionOptions = ["New", "Like New", "Used"];

export function PostAdStep2DetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("Modern Oak Desk");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [condition, setCondition] = useState("New");

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const priceError =
    price.length > 0 && (Number(price) <= 100 || Number(price) === 0);

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
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
            <MaterialIcons name="arrow-back" size={23} color="#0F172A" />
          </Pressable>
          <Text className="text-[18px] font-semibold tracking-tight text-[#0F172A]">
            Step 2 of 3
          </Text>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Text className="text-[12px] font-semibold text-[#27BB97]">
            Save as Draft
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topBarHeight + 16,
          paddingBottom: 100 + Math.max(insets.bottom, 8),
        }}
      >
        <View className="px-4">
          {/* Progress Bar */}
          <View className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <View className="h-full w-2/3 rounded-full bg-[#27BB97]" />
          </View>

          {/* Header */}
          <View className="mb-6">
            <Text className="text-[24px] font-bold tracking-tight text-[#0F172A]">
              Listing Details
            </Text>
            <Text className="mt-1 text-[14px] text-[#6C7A74]">
              Provide accurate details to help buyers find your item.
            </Text>
          </View>

          {/* Ad Title */}
          <View className="mb-6">
            <View className="mb-2 flex-row items-end justify-between">
              <Text className="text-[12px] font-medium text-[#161D1A]">
                Ad Title
              </Text>
              <Text className="text-[10px] font-medium text-[#6C7A74]">
                {title.length}/70
              </Text>
            </View>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={70}
              placeholder="e.g. iPhone 13 Pro Max with box"
              placeholderTextColor="#94A3B8"
              className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-[14px] text-[#161D1A]"
              style={{ paddingVertical: 0 }}
            />
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what you're selling, including features and any flaws..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="min-h-[120px] rounded-lg border border-slate-200 bg-white p-4 text-[14px] text-[#161D1A]"
            />
            <Text className="mt-1 px-1 text-[11px] text-[#6C7A74]">
              Mention key selling points like brand, age, and condition details.
            </Text>
          </View>

          {/* Price */}
          <View className="mb-6">
            <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
              Price
            </Text>
            <View
              className="h-12 flex-row items-center rounded-lg bg-white px-4"
              style={{
                borderWidth: 1,
                borderColor: priceError ? "#BA1A1A" : "#E2E8F0",
              }}
            >
              <Text className="mr-1 text-[16px] font-semibold text-[#161D1A]">
                ₹
              </Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                className="flex-1 text-[16px] font-bold text-[#161D1A]"
                style={{
                  paddingVertical: 0,
                  color: priceError ? "#BA1A1A" : "#161D1A",
                }}
              />
            </View>
            {priceError && (
              <View className="mt-1 flex-row items-center gap-1 px-1">
                <MaterialIcons name="error" size={14} color="#BA1A1A" />
                <Text className="text-[11px] text-[#BA1A1A]">
                  Price must be greater than ₹100
                </Text>
              </View>
            )}
          </View>

          {/* Condition */}
          <View className="mb-8">
            <Text className="mb-3 text-[12px] font-medium text-[#161D1A]">
              Condition
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {conditionOptions.map((opt) => {
                const isActive = condition === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setCondition(opt)}
                    className="rounded-full px-5 py-2.5"
                    style={{
                      backgroundColor: isActive ? "#27BB97" : "#FFFFFF",
                      borderWidth: 1,
                      borderColor: isActive ? "#27BB97" : "#E2E8F0",
                    }}
                  >
                    <Text
                      className="text-[12px] font-medium"
                      style={{ color: isActive ? "#FFFFFF" : "#161D1A" }}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Tip Box */}
          <View className="flex-row gap-4 rounded-xl border border-slate-100 bg-white/70 p-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[rgba(39,187,151,0.1)]">
              <MaterialIcons name="lightbulb" size={22} color="#27BB97" />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-[12px] font-semibold text-[#0F172A]">
                Seller Pro-Tip
              </Text>
              <Text className="text-[12px] leading-5 text-[#6C7A74]">
                Ads with a clear title and fair pricing receive 3x more
                inquiries. Consider checking similar listings to stay
                competitive.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 flex-row items-center justify-between border-t border-slate-100 bg-white px-4"
        style={{
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-wider text-[#6C7A74]">
            Estimated Reach
          </Text>
          <Text className="text-[16px] font-bold text-[#0F172A]">
            ~2.5k views/week
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/post-ad-step3-media")}
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <LinearGradient
            colors={["#27BB97", "#1E9E7E"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              height: 48,
              paddingHorizontal: 32,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="text-[14px] font-bold text-white">Next</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
