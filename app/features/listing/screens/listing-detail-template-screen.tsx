import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
    Dimensions,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const galleryImages = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCyo-DEhSQWij_8TCGkbOlbvRXwn7OmV_Nyd9j3_BSY0Nl222NpqpSjZ9Wu2nMATuk_BpFtreapq9qdFdRacm9HRtTKmyOiRdXzEbIKf332Vhv5gldclFQx-mNmMwlx52ZxE58aQzxE5SW9eoy6PmnscYDMR1xcq8sMcs8ugZTeL4S9es-mxzrRL7CE7AAnnhUhcTWrLkM17xdkp5uFimkVtlxlhFk8I8nhnVPMWUIVHzV_CEHxpzTxrWuLjtDMtznn9nCTyK0nbfw",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCT9sTYZ9RfkNspk7jrp2GRFYindVNvZG9XtDmBk3C4597fas9wFXUNIdKKawXhxnv8IFf2kpF12lMz9gr3yDAHdbVPXu-IrooP5npQYc5JYNOGxAOznYWMUUQs5aiN7XTXBrBYBBuer10t-zn3PiyNzw21mO9wUXwjttVsmoKHgCPvkwh503yMIZ3cvICasOb6-iWfTWAcw09zu-QvNrcsfhmrxSAiRFwPpq3Xra0GQlXCvwtVA6w8bGa1l2A8bQTmOPJ0H90iivs",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuARP2l8zUsaZ2V4rYV8fUrGLUj2vMZCbFVgEgFFQN465h9JyGD_EanjVoNPbRdPeKGsjXjN-VRLSGAbyoGTtNsJMrvTI_RdCoNP0xNkiZN9C3zq_LyTt0XWDUH7Uj4zbo1nq7uEcrdxf2LhxjZC8LSiu2vpOpA0xRN8Bu-yKzF-X7zPaZTtYoXeJrmbtxBHdySgCRIFmuJn7v3a3GBq2sSaovHRnmXdXuC8M5oNGOLuZG1iws-40yPL_dCZsRtnSjr-diNiK0PAHk4",
];

const mapImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCAVYfR8aC7KqDOIqHdhM5CQSs3MPAQWfF1rVEIcsXfJ5ot_uPO-J0sIfOimcIpF90ObzJ0q4TmADY9jj5gZ9YfKEHnPeu8IB6IBbq1VtwCcnnaJN1vUzqg59LUqi_vU-zXRa_hN03J2q0kqrzEVLyOzTLDYQcdSIJPJeeUZwjP6RVjb_C-nASKxRhO4yG4mnpUGeeoaC7PsyJPkPalFINlSFyCmGUCcW7CFY_a_Ml294Fs53tJ5AgDm5vFGQwONmTMe9dftfjBN5w";

const sellerImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC9LDdNevaB_R6eajjo6Yc7JbRhvfBO-8llZ6RSHIvG3BnT6ds4GsiBBKI1dKLxMHcrf-1O72vMrHmn1IdnxxDjhdEu1s08-1K1XG-azSuySCawuwHvbX1ePzX46le3647TDM06NhyTPRkcV8c5InmjUjBkaf41xWsuHq0hyAoQFJYhSr2_gDS3GQmsG0lqEPnb0mJ8y6mPpGcisibFIk3yKXBwdCWVdVatvUyOsrurDXvQJo5-H1mpudL_bL5fXQey1q6juFXYzUE";

export function ListingDetailTemplateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { refreshing, onRefresh } = usePullToRefresh();

  const footerInsetPadding = Math.max(insets.bottom, 12);
  const topControlsOffset = useMemo(() => insets.top + 8, [insets.top]);

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      <View
        className="absolute inset-x-0 z-50 flex-row items-center justify-between px-4"
        style={{ top: topControlsOffset }}
      >
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/70"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <MaterialIcons name="arrow-back" size={22} color="#161D1A" />
        </Pressable>

        <View className="flex-row gap-2">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-white/70"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <MaterialIcons name="share" size={21} color="#161D1A" />
          </Pressable>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-white/70"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <MaterialIcons name="favorite" size={21} color="#BA1A1A" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#27BB97"]}
            tintColor="#27BB97"
            progressViewOffset={topControlsOffset}
          />
        }
        contentContainerStyle={{ paddingBottom: 96 + footerInsetPadding }}
      >
        <View className="relative h-105 w-full overflow-hidden bg-[#E9EFEB]">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const x = event.nativeEvent.contentOffset.x;
              const index = Math.round(x / SCREEN_WIDTH);
              setActiveImageIndex(index);
            }}
          >
            {galleryImages.map((image, index) => (
              <View
                key={image + index.toString()}
                style={{ width: SCREEN_WIDTH, height: 420 }}
              >
                <Image
                  source={image}
                  contentFit="cover"
                  transition={200}
                  className="h-full w-full"
                />
              </View>
            ))}
          </ScrollView>

          <View className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-2">
            {galleryImages.map((_, index) => (
              <View
                key={index.toString()}
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    index === activeImageIndex
                      ? "#FFFFFF"
                      : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </View>
        </View>

        <View className="mt-4 gap-4 px-4">
          <View className="gap-2">
            <Text className="text-[24px] font-bold leading-8 text-[#161D1A]">
              Sony WH-1000XM4 Noise Cancelling Headphones
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-[20px] font-bold text-[#27BB97]">
                ₹18,500
              </Text>
              <View className="rounded-full bg-[#27BB97]/10 px-2.5 py-0.5">
                <Text className="text-[12px] font-medium text-[#27BB97]">
                  Like New
                </Text>
              </View>
            </View>
          </View>

          <View className="pt-1">
            <Text className="mb-2 text-[18px] font-semibold text-[#161D1A]">
              Description
            </Text>
            <Text className="text-[14px] leading-6 text-[#3C4A44]">
              Barely used, 6 months old. Original packaging included with all
              accessories (aux cable, flight adapter, charging cable).
              Exceptional battery life and industry-leading noise cancellation.
              Selling because I upgraded to the newer model. No scratches or
              signs of wear.
            </Text>
          </View>

          <View className="h-px bg-[#BBCAC3]/30" />

          <View className="py-1">
            <Text className="mb-3 text-[18px] font-semibold text-[#161D1A]">
              Location
            </Text>
            <View className="relative h-40 w-full overflow-hidden rounded-xl border border-[#BBCAC3]/30">
              <Image
                source={mapImage}
                contentFit="cover"
                transition={200}
                className="h-full w-full"
                style={{ opacity: 0.55 }}
              />
              <View className="absolute inset-0 items-center justify-center">
                <View className="h-24 w-24 items-center justify-center rounded-full border-2 border-[#27BB97]/40 bg-[#27BB97]/10">
                  <View className="h-4 w-4 rounded-full bg-[#27BB97]" />
                </View>
              </View>
            </View>
            <View className="mt-2 flex-row items-center gap-2">
              <MaterialIcons name="location-on" size={18} color="#3C4A44" />
              <Text className="text-[12px] font-medium text-[#3C4A44]">
                Indiranagar, Bangalore • 2.4 km away
              </Text>
            </View>
          </View>

          <View className="h-px bg-[#BBCAC3]/30" />

          <View className="py-1">
            <Text className="mb-4 text-[18px] font-semibold text-[#161D1A]">
              Seller Information
            </Text>
            <Pressable
              onPress={() => router.push("/seller-public-profile")}
              className="flex-row items-center rounded-xl border border-[#BBCAC3]/20 bg-white p-4"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View className="mr-4 h-14 w-14 overflow-hidden rounded-full border-2 border-white">
                <Image
                  source={sellerImage}
                  contentFit="cover"
                  transition={200}
                  className="h-full w-full"
                />
              </View>

              <View className="flex-1">
                <View className="flex-row items-center gap-1">
                  <Text className="text-[20px] font-semibold text-[#161D1A]">
                    John D.
                  </Text>
                  <MaterialIcons name="verified" size={18} color="#005FB0" />
                </View>
                <Text className="text-[12px] text-[#3C4A44]">
                  Member since 2021
                </Text>
                <View className="mt-1 flex-row items-center gap-1">
                  <MaterialIcons name="star" size={16} color="#755B00" />
                  <Text className="text-[12px] font-bold text-[#161D1A]">
                    4.8
                  </Text>
                  <Text className="text-[12px] text-[#3C4A44]">
                    (124 reviews)
                  </Text>
                </View>
              </View>

              <MaterialIcons name="chevron-right" size={22} color="#161D1A" />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 z-50 border-t border-[#BBCAC3]/20 bg-white/95 px-4"
        style={{ paddingTop: 12, paddingBottom: footerInsetPadding }}
      >
        <View className="flex-row gap-4">
          <Pressable className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border-2 border-[#BBCAC3]/50 bg-white">
            <MaterialIcons name="chat" size={20} color="#161D1A" />
            <Text className="text-[16px] font-semibold text-[#161D1A]">
              Message
            </Text>
          </Pressable>
          <Pressable
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#27BB97]"
            style={{
              shadowColor: "#27BB97",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <MaterialIcons name="call" size={20} color="#FFFFFF" />
            <Text className="text-[16px] font-semibold text-white">Call</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
