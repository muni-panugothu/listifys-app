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

const EVENT_POSTER =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDKIvmxGYMni8Cxbs_TfoVlLgn6bI-T2xT28A1ex27dGYFuSf6X5JUGtJbkyzY3aDNSA88IZz50eyiJZS-KwbcsiWkynWRfRZQ4STIWDwrzXbdP3uAYSbPhUwXnIHH6SGKTiHDKpgtkq4mXnpYnD4tIdMNbY-XoDYZ0vF-1D8xHRISdDW8ixHYPglSZ_JnRbXy2bSSNH5XcNmEhlRCPdbI1oCzZ7Kz_axB9HWDiif1H8FjQNljMMhOYVUXiw4vZjOz3HfU2sQGY0JY";

const ORGANIZER_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAgOQDrZXn2ZzTvxK-KPYf2bCl6f5Tu3lMtfsCQWEz61W-S6zXgjJhnJFnq_Pt3kfedmqcwwB-Z9Yk_ObbQrsgJtKpu-mLZng4Jh_rzNoM4osKdGYTsgJa0ONEv8kzY9xzowNYeRlcSqlnBfQkUWfKyKOCRcMrf4dBiFl_yOQq0lxTYTw8kpAX9lgdKxJ_9X4Yu8FMYjjnXcxNGjW8MPdJJoBTlLIFjMHgZC9KBVXQtE2IIQ2fUlbfXyllV3Eti3jmPcsRrnrGBxog";

const MAP_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBWxsVDnoB8ByzVWF--Sox-u0TGPxpeGNXTkGp6HaQynKPQm4t8diUSjGifBJ8Bcu76ECoR4W-wOfx-NDLS_tMDAOGD5NXfGZtPwbeTau5cIbEkn6LsagVxUNi0yv996UDU_H1yQtVhTRTcpsYRmFXUv9rhCChiHgtMbs7_hcNmFNb-O90wq5_ZHZkIwAvv-Bcf_9A20KQMGPkM2FCc0EBlSfP81jx4jLI5TIrZ2jb6XICExAh9cOqz5ma4zTnY7USUokqjaH8B7fA";

const attendeeAvatars = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBZ1bDidgCuelkZ_YaffIZGDuMWgb2mcQphhEc3d92APhd2bGB430GFBRkdBMqJtz6vA8WxDbCadCMDMv5iWp30JAhVfAi56krpqb3gRI3X_f1Wx94uSh6yIoHmAoa0Po8CdErB5VRKTolTiBmt8m6isYTnWTnZmXg5Wt_CRN7JDX_58YxKCn0VMSKug8eYIOi_CJ1ktx0RsJ_cwDLFctehcq4Ls9fyo5tZb4zV6AvJ_DV7_IrfV9f-D20VTlXYHX4HYqy0LPL1xO0",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCGOUTydk6cH6pYV4GNh9sQsSMISCTCCmshkCC2MFa-8Sqk3RGhaKMcfuOB-at3tywmMaipt_ipexMiWWB7ENHAtGSiZ9QKz_4T0dSgGJJh2WB02oXAvmOlmIMK7sbRbSj4BPE453X2D4C6dKoxXDr2kSl3zBPyLjXS7sIZdCot1Nj8L4526Nn7OcvIvo9UMTlLYAc_3ef-Z5BrWS3IOqBJQIKo4Mem4F8XpYs-XE8B-8_oYv8dCUnYrJ6Dx2XJjuHjAr6buB3n6Ho",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBX75-KSrE7EtOtKjFGFsAymm9tfoXJTqPbhwYbEL682dAZBVaFbdDkVOXITKaHa5UvRv_vzcYIRQ-NH7jsWRgo0vHCVd2ig5-pZFXpcySSyAlXSHhez9QPmc_sT0iIIe0zrlVDm0iL_JFJ2vu4DCOZ2DRIBXaaztgbrGIa39Pn1nZucBvXnDXMaE7u8sfANcYlVPv1n5ojit0-IWMjA2zcbbz5aXOM5N0EpxrVk4_ny3DgGiQKlV2FUk74Na5v1uPD8pWS_DT782Q",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB8uD7c_7gkoJBIeZp12ob2pO96qIbmAD1LzvuTi4ZIOzCajWofqTnn5SNbRu55jBWxgAFTNIkgR1E4ppOf9aifQgTHseUJSvFat28JoJ9gqK9-Q1AASheRygFRWl4OQon8s512Nr48-3ywi3TSCneW8lJotiCcOGRlnd0ihB-sX4iJOW4kJCoLTuSahkw3q_eaGEV4r2riARmv-lvO05J8x-rSQ93AP8Q-aMizWA7O57R2V97U0ZGnwHEB_eSIgct4LJ5D-1OYrdo",
];

export function EventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshing, onRefresh } = usePullToRefresh();

  const topBarHeight = insets.top + 64;

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
        <Pressable
          className="h-10 w-10 items-center justify-center"
          onPress={() => router.back()}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <MaterialIcons name="arrow-back" size={24} color="#27BB97" />
        </Pressable>

        <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
          Listify
        </Text>

        <View className="flex-row items-center gap-4">
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="share" size={22} color="#64748B" />
          </Pressable>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="favorite-border" size={22} color="#64748B" />
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
            progressViewOffset={topBarHeight}
          />
        }
        contentContainerStyle={{
          paddingTop: topBarHeight,
          paddingBottom: 96 + Math.max(insets.bottom, 16),
        }}
      >
        <View className="relative w-full" style={{ aspectRatio: 4 / 5 }}>
          <Image
            source={EVENT_POSTER}
            contentFit="cover"
            transition={200}
            className="h-full w-full"
          />
          <View className="absolute bottom-4 left-4 rounded-full bg-[#27BB97] px-3 py-1">
            <Text className="text-[12px] font-medium uppercase tracking-wide text-white">
              Music & Arts
            </Text>
          </View>
        </View>

        <View className="mt-6 gap-6 px-4">
          <View className="gap-1">
            <Text className="text-[24px] font-bold leading-8 tracking-tight text-[#161D1A]">
              Midnight Echoes Festival 2024
            </Text>
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="calendar-today" size={20} color="#6c7a74" />
              <Text className="text-[14px] leading-5 text-[#6c7a74]">
                Saturday, Oct 12 • 08:00 PM - 02:00 AM
              </Text>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-[20px] font-semibold leading-7 text-[#161D1A]">
              About Event
            </Text>
            <Text className="text-[14px] leading-6 text-[#3c4a44]">
              Experience an immersive journey through sound and light. Midnight
              Echoes brings together the finest electronic producers and visual
              artists for a one-night-only spectacular at the historic Grand
              Arena.
            </Text>
            <Pressable
              className="self-start"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="flex-row items-center gap-1">
                <Text className="text-[12px] font-medium tracking-wide text-[#006b55]">
                  Read More
                </Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={16}
                  color="#006b55"
                />
              </View>
            </Pressable>
          </View>

          <View className="flex-row items-center justify-between rounded-xl border border-[#bbcac3]/20 bg-[#e9efeb] p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 overflow-hidden rounded-full border-2 border-white">
                <Image
                  source={ORGANIZER_IMAGE}
                  contentFit="cover"
                  transition={200}
                  className="h-full w-full"
                />
              </View>
              <View>
                <Text className="text-[18px] font-semibold leading-6 text-[#161D1A]">
                  Neon Pulse Events
                </Text>
                <Text className="text-[12px] font-medium tracking-wide text-[#6c7a74]">
                  Organizer • 4.9 ★
                </Text>
              </View>
            </View>
            <Pressable
              className="rounded-lg border border-[#006b55]/20 bg-white px-4 py-2"
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            >
              <Text className="text-[12px] font-medium tracking-wide text-[#006b55]">
                Follow
              </Text>
            </Pressable>
          </View>

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-[20px] font-semibold leading-7 text-[#161D1A]">
                Location
              </Text>
              <Pressable
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View className="flex-row items-center gap-1">
                  <Text className="text-[12px] font-medium tracking-wide text-[#006b55]">
                    Get Directions
                  </Text>
                  <MaterialIcons name="near-me" size={16} color="#006b55" />
                </View>
              </Pressable>
            </View>

            <View className="relative h-48 overflow-hidden rounded-xl border border-[#bbcac3]/30">
              <Image
                source={MAP_IMAGE}
                contentFit="cover"
                transition={200}
                className="h-full w-full"
              />

              <View className="absolute inset-0 items-center justify-center">
                <View
                  className="h-10 w-10 items-center justify-center rounded-full bg-[#27BB97]"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 4,
                  }}
                >
                  <MaterialIcons name="location-on" size={20} color="#FFFFFF" />
                </View>
              </View>

              <View
                className="absolute bottom-3 left-3 right-3 rounded-lg bg-white/90 p-3"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <Text className="text-[14px] font-semibold text-[#161D1A]">
                  Grand Arena Stadium
                </Text>
                <Text
                  className="text-[12px] font-medium text-[#6c7a74]"
                  numberOfLines={1}
                >
                  Sector 42, Marine Drive, Mumbai, MH
                </Text>
              </View>
            </View>
          </View>

          <View className="mb-2 gap-3">
            <Text className="text-[20px] font-semibold leading-7 text-[#161D1A]">
              Who&apos;s going?
            </Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-row">
                {attendeeAvatars.map((avatar, index) => (
                  <View
                    key={avatar}
                    className="h-10 w-10 overflow-hidden rounded-full border-2 border-white"
                    style={{ marginLeft: index === 0 ? 0 : -12 }}
                  >
                    <Image
                      source={avatar}
                      contentFit="cover"
                      transition={200}
                      className="h-full w-full"
                    />
                  </View>
                ))}
                <View
                  className="h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#e3eae5]"
                  style={{ marginLeft: -12 }}
                >
                  <Text className="text-[12px] font-medium tracking-wide text-[#3c4a44]">
                    +42k
                  </Text>
                </View>
              </View>
              <Text className="ml-2 text-[14px] leading-5 text-[#6c7a74]">
                Going this weekend
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 z-50 flex-row items-center justify-between border-t border-slate-100 bg-white/95 px-4"
        style={{
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 12),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View>
          <Text className="text-[12px] font-medium tracking-wide text-[#6c7a74]">
            Price per ticket
          </Text>
          <Text className="text-[20px] font-bold leading-6 text-[#161D1A]">
            ₹2,499.00
          </Text>
        </View>

        <Pressable
          className="overflow-hidden rounded-lg"
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.95 : 1 }],
            shadowColor: "#27BB97",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
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
              paddingHorizontal: 24,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Text className="text-[18px] font-semibold text-white">
              Book Tickets
            </Text>
            <MaterialIcons
              name="confirmation-number"
              size={20}
              color="#FFFFFF"
            />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
