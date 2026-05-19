import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "@/lib/safe-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";
import { formatPrice, getCurrencySymbol } from "@/lib/currency";

const productThumb =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCUf9mnHqpHBej7XV7AA8q4n_A2SsI9rqSSYQ1ZqF_RZTJa6cyAJckoI8qP3YUeiT9HWEOIylPb1WOlcpNDEEBOeNwgE5_k_p64ocBMFr6nyGMQnDsKGd44fqaLFLumcCs2lpN6oqQ-cpK8R8ELD_vKJ5JxbjgCGIOpwgJ0lJIR0AGpcq0vqorQBDh81TxGZXX_AXLUaHTCQQZ1pDLg335_yVjLwSvSGkzbIy8vR8QRMMiJhKfkx2cNj_fA14JTnlFEGbNZkMZUSKE";

const recommendedOfferAmounts = [21500, 22500, 23000];

export function CreateOfferModalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedChip, setSelectedChip] = useState("22500");
  const [customAmount, setCustomAmount] = useState("22500");

  return (
    <View className="flex-1 bg-black/40">
      {/* Backdrop - tap to dismiss */}
      <Pressable
        onPress={() => router.back()}
        className="flex-1"
        style={{ minHeight: 100 }}
      />

      {/* Bottom Sheet */}
      <View
        className="rounded-t-3xl border-t border-slate-100 bg-white"
        style={{
          paddingBottom: Math.max(insets.bottom, 16),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -12 },
          shadowOpacity: 0.15,
          shadowRadius: 40,
          elevation: 24,
        }}
      >
        {/* Handle */}
        <View className="items-center py-3">
          <View className="h-1.5 w-12 rounded-full bg-slate-200" />
        </View>

        <View className="px-4 pb-4">
          {/* Header */}
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="text-[24px] font-bold tracking-tight text-[#161D1A]">
              Make an Offer
            </Text>
            <Pressable
              onPress={() => router.back()}
              className="rounded-full p-2"
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#F1F5F9" : "transparent",
              })}
            >
              <MaterialIcons name="close" size={24} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Product Summary */}
          <View className="mb-6 flex-row items-center gap-3 rounded-lg bg-[#F3F4F6] p-3">
            <Image
              source={productThumb}
              contentFit="cover"
              className="h-12 w-12 rounded"
            />
            <View className="flex-1">
              <Text className="text-[12px] font-medium uppercase text-[#6C7A74]">
                Listed Price
              </Text>
              <Text className="text-[16px] font-bold text-[#161D1A]">
                {formatPrice(24999)}
              </Text>
            </View>
          </View>

          {/* Recommended Offers */}
          <View className="mb-8">
            <Text className="mb-3 text-[12px] font-medium uppercase text-[#6C7A74]">
              Recommended Offers
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {recommendedOfferAmounts.map((amt) => {
                const label = formatPrice(amt);
                const isSelected = String(amt) === selectedChip;
                return (
                  <Pressable
                    key={amt}
                    onPress={() => {
                      setSelectedChip(String(amt));
                      setCustomAmount(String(amt));
                    }}
                    className="rounded-full px-4 py-2"
                    style={{
                      borderWidth: 1,
                      borderColor: isSelected ? "#006B55" : "#E2E8F0",
                      backgroundColor: isSelected
                        ? "rgba(39,187,151,0.1)"
                        : "#FFFFFF",
                    }}
                  >
                    <Text
                      className="text-[14px]"
                      style={{
                        color: isSelected ? "#006B55" : "#161D1A",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Custom Input */}
          <View className="mb-8">
            <Text className="mb-2 text-[12px] font-medium uppercase text-[#161D1A]">
              Your Custom Offer
            </Text>
            <View className="h-14 flex-row items-center rounded-xl border-2 border-slate-100 bg-slate-50 px-4">
              <Text className="text-[20px] font-bold text-slate-400">{getCurrencySymbol()}</Text>
              <TextInput
                value={customAmount}
                onChangeText={(val) => {
                  setCustomAmount(val);
                  setSelectedChip("");
                }}
                keyboardType="numeric"
                placeholder="Enter amount"
                placeholderTextColor="#CBD5E1"
                className="ml-2 flex-1 text-[20px] font-bold text-[#161D1A]"
                style={{ paddingVertical: 0 }}
              />
            </View>
            <View className="mt-2 flex-row items-center gap-1">
              <MaterialIcons name="info" size={14} color="#6C7A74" />
              <Text className="text-[12px] text-[#6C7A74]">
                Offers are usually 10-15% below listed price
              </Text>
            </View>
          </View>

          {/* Submit */}
          <Pressable
            className="overflow-hidden rounded-xl"
            style={({ pressed }) => ({
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <LinearGradient
              colors={["#27BB97", "#1E9E7E"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                height: 56,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Text className="text-[18px] font-semibold text-white">
                Send Offer
              </Text>
              <MaterialIcons name="send" size={20} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
          <Text className="mt-4 text-center text-[12px] text-slate-400">
            The seller will be notified and can accept or counter.
          </Text>
        </View>
      </View>
    </View>
  );
}
