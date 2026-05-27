import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBk6QKVWQ9KkXMXWBSN_XdZ_hwNHFgw9x9f5vp7BQjo4NzEX_nBaFOKeyKQ2iCePYe8UONxvNdEggqAdmz25-npG2VR8R399n9GRCA93Vq2mEl156Cb-JsIswSBWDOMK-ke1bM_tgs5ue09fLcVHon1fjAQfnpL6KugUz38son6J-aiBTlcdbwCkid_luCChHGCGoHBCq7rzfTbgGCayzGXmoErCDLFOyIDOvPdwnbyxuTyQ_nx6mVWXITTDcEy2MImpV6YCWO9LtY";

const COMPANY_LOGO =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCx0CM_M4kX7OfjvIYEeBSuJFrQ7eHdlckA9WDtIthZ_nXLWWdZrglutnAPWH5m4HZaEwtzpxUDAZcC0MRhjKPRJoZLN-BHk2xgKRV-QWjy2P03KHVyFKKcg0CgqEdz7-KNm_jWO08hdOspIV0LfMYehhpbecUVOvBD4eCV3MhsFMDXWwXwxKj_aheVVcRUa0THD46JtBjqbOmigjc87gvNy_p4pXs959Y_bFuH98hk9T5uU-8lrVzdAKhHgnBUnWnFk_Nfzk29StM";

const ABOUT_LOGO =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCXUpGdLCNbQ0QhXy3s9GnYGm4xQG6tkUJnyn9zO9Gc8CMl7pcqsZyYl4WneWt-epZhra6I9uDdShVTIItLobqS2jqAhGLrAVFsv2AadWHf5RHJ9fvD8SglhjF9Z1Ugm5CNceRGHG0QYQKaCnUVdPSbJQctfaGDiP1XXzlKRhv0aNfG1aVDz0PjxPHNS68M5d0J15-AcNvR8eP2YCUWmHf1E7dpJDGkcmDvq05wQrv0h5gPrGw3wtsCErZ23WQuoKfXanVJY0NzhmA";

const requirements = [
  "5+ years of experience in product design for B2C platforms.",
  "Proficiency in Figma, prototyping, and design systems.",
  "Strong portfolio showcasing end-to-end design process.",
  "Excellent communication and leadership skills.",
];

export function JobDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshing, onRefresh } = usePullToRefresh();

  const topBarHeight = insets.top + 56;

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* ===== TOP APP BAR ===== */}
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
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
          </Pressable>
          <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
            Listify
          </Text>
        </View>
        <View className="flex-row items-center gap-4">
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="share" size={22} color="#64748B" />
          </Pressable>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="favorite" size={22} color="#64748B" />
          </Pressable>
        </View>
      </View>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#27BB97"]}
            tintColor="#27BB97"
            progressViewOffset={topBarHeight}
          />
        }
        contentContainerStyle={{
          paddingTop: topBarHeight,
          paddingBottom: 100 + Math.max(insets.bottom, 16),
        }}
      >
        {/* Hero Image */}
        <View className="relative h-48 w-full">
          <Image
            source={HERO_IMAGE}
            contentFit="cover"
            transition={200}
            className="h-full w-full"
          />
          <View className="absolute inset-0 bg-black/20" />
          {/* Company Logo */}
          <View
            className="absolute -bottom-8 left-4 rounded-xl bg-white p-1"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <View className="h-20 w-20 overflow-hidden rounded-lg bg-[#e9efeb]">
              <Image
                source={COMPANY_LOGO}
                contentFit="cover"
                transition={200}
                className="h-full w-full"
              />
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="mt-12 px-4 gap-6">
          {/* Title & Company */}
          <View className="gap-2">
            <Text className="text-[24px] font-bold leading-8 tracking-tight text-[#161D1A]">
              Senior Product Designer
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-[16px] font-medium leading-6 text-[#006b55]">
                Innovate Tech Solutions
              </Text>
              <MaterialIcons name="verified" size={16} color="#006b55" />
            </View>
          </View>

          {/* Meta Badges */}
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-row items-center gap-1 rounded-full bg-[#27BB97]/10 px-3 py-1">
              <MaterialIcons name="work" size={14} color="#27BB97" />
              <Text className="text-[12px] font-medium tracking-wide text-[#27BB97]">
                Full-time
              </Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-full bg-[#5ba2ff]/10 px-3 py-1">
              <MaterialIcons name="wifi" size={14} color="#5ba2ff" />
              <Text className="text-[12px] font-medium tracking-wide text-[#5ba2ff]">
                Remote
              </Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-full bg-[#e3eae5] px-3 py-1">
              <MaterialIcons name="location-on" size={14} color="#3c4a44" />
              <Text className="text-[12px] font-medium tracking-wide text-[#3c4a44]">
                Mumbai, IN
              </Text>
            </View>
          </View>

          {/* Salary Card */}
          <View
            className="flex-row items-center justify-between rounded-xl border border-slate-100 bg-white p-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 3,
              elevation: 1,
            }}
          >
            <View>
              <Text className="mb-1 text-[12px] font-medium tracking-wide text-slate-500">
                Expected Salary
              </Text>
              <View className="flex-row items-baseline">
                <Text className="text-[20px] font-bold leading-6 text-[#161D1A]">
                  ₹18L - ₹24L
                </Text>
                <Text className="ml-1 text-[14px] leading-5 text-slate-400">
                  / year
                </Text>
              </View>
            </View>
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[#006b55]/10">
              <MaterialIcons name="payments" size={22} color="#006b55" />
            </View>
          </View>

          {/* Job Description */}
          <View className="gap-3">
            <Text className="text-[20px] font-semibold leading-7 text-[#161D1A]">
              Job Description
            </Text>
            <Text className="text-[14px] leading-6 text-[#3c4a44]">
              We are looking for a Senior Product Designer to lead the evolution
              of our marketplace platform. You will be responsible for crafting
              seamless user experiences across mobile and web interfaces,
              focusing on high-trust interactions and visual excellence.
            </Text>
            <Text className="text-[14px] leading-6 text-[#3c4a44]">
              You will collaborate closely with product managers and engineers
              to define the product roadmap and execute pixel-perfect designs
              that align with our brand identity.
            </Text>
          </View>

          {/* Requirements */}
          <View className="gap-3">
            <Text className="text-[20px] font-semibold leading-7 text-[#161D1A]">
              Requirements
            </Text>
            <View className="gap-3">
              {requirements.map((req, index) => (
                <View key={index} className="flex-row gap-3">
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color="#006b55"
                    style={{ marginTop: 2 }}
                  />
                  <Text className="flex-1 text-[14px] leading-5 text-[#3c4a44]">
                    {req}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* About Company */}
          <View className="gap-4 rounded-2xl bg-[#eff5f0] p-6">
            <View className="flex-row items-center gap-4">
              <View
                className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white p-2"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <Image
                  source={ABOUT_LOGO}
                  contentFit="contain"
                  transition={200}
                  className="h-full w-full"
                />
              </View>
              <View>
                <Text className="text-[18px] font-semibold leading-6 text-[#161D1A]">
                  About Innovate Tech
                </Text>
                <Text className="text-[12px] font-medium tracking-wide text-slate-500">
                  500-1000 Employees • Tech Marketplace
                </Text>
              </View>
            </View>
            <Text className="text-[14px] leading-5 text-[#3c4a44]">
              Innovate Tech is a leading multi-category marketplace platform
              dedicated to connecting high-quality service providers with
              discerning customers across India. We believe in high-trust
              commerce and sustainable growth.
            </Text>
            <Pressable
              className="items-center rounded-lg border border-[#bbcac3] py-2.5"
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            >
              <Text className="text-[14px] font-semibold text-[#006b55]">
                View Company Profile
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* ===== FOOTER ACTION BAR ===== */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 flex-row items-center gap-4 border-t border-slate-100 bg-white/95 px-4"
        style={{
          paddingBottom: Math.max(insets.bottom, 16),
          paddingTop: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {/* Bookmark */}
        <Pressable
          className="h-12 w-14 items-center justify-center rounded-xl border border-slate-100"
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <MaterialIcons name="bookmark-outline" size={24} color="#64748B" />
        </Pressable>

        {/* Apply Now Button */}
        <Pressable
          className="flex-1 overflow-hidden rounded-xl"
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: "#27BB97",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 6,
          })}
        >
          <LinearGradient
            colors={["#27BB97", "#1E9E7E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              height: 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 12,
            }}
          >
            <Text className="text-[16px] font-bold text-white">Apply Now</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
