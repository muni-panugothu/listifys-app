import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
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

type Review = {
  id: string;
  name: string;
  avatar: string;
  date: string;
  rating: number;
  text: string;
};

const heroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD_iedlRV7Ku-Px5f9Luzmh89j_oISAeZJvN3Ifl6er_uP9W96QA2qLJR3ew3RfZ6u1QKSUUn4tgccUHL6pOp26fvV9wNfgRIrdIzjCohq3Ni2xi57byUq328q5SsEAcL64XCAxlGxwTVJm_6LtROuN2nemuIESDYlkeGryzrVyEilBwLrth8d22svl9uOskUo0yOLG39rlV5Bh15JoOdGuje4Ugb6hAAMxd4wv0c2ZBRQPa8x70HS4yuD6-nR6TVvM3OZsq66Zlpc";

const agentAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCVzPCCsdyVrEXfxE4rBZ_DWQI53a9vXs4uvu7dIigAoc2dW868d88_ZJu_v3uPzD0OwqrRreqpuF27sDQEy_Kx00Z1w4Be6rRgHyQgew94ywXg86huPWxBAnpok8QeUF7f6_7hftMjyG24w6dcmdB8M0XNu590yGupwC6HYNFub-JsOILaFQZRJ_w5rtccvSjnZGn85KsCnBdID0dxldaR40ORZHDUz00iAvR94jjli87G0WKGG_uLJ03qUUo7vNWVXlQ9QOEGvKI";

const mapImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCxwhpe6eJsnLd_QHbVzcXnlZatAbJ6Rc9VKIJDO57DQ0MjvUHTJBoHMOplb4cEwT0RUW21Q4hFdquI_xWJJgxhifFzcPSLQk7yLWbDfAF17x-fZwoZDsmWHVj8NcB-mLwxEpkjlTBCbrTMwn40YtTaXb26b63RaAUmXw6p-YrCxgMQRw_T6Ng_6hccCfuRplTLGqgt_jGxB8OZZ47M0IjylTfIjMj3imKuXUwfbBhFUCYEY2tDb1XZt5xSyVFRKJfPggbGs6kf9Ug";

const reviews: Review[] = [
  {
    id: "rahul",
    name: "Rahul Mehta",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDSctB2QhHptLZ-gpplqfqBrAI423MtkNpBWjWUL5WiI1RAiPllwt2z8GGaI7h96_Y5WJj6sUjE3IuiXibLrv_hUjfiOs8T4lAo8RKWDhq1GKzv0pHfZu7oz6_f_TsG6ObY_C_7jp9O-tJGdqzNB9P4lFOHBKOjhLDU7fPRYWLZ5Zh0JBJ3nqZcGGhV8pE-kLBPiJZ3GjpCUNj1t10IFyEJevDyWOlpU9npFtF2HvJhJpXbSuPZpzbVu89mplqdSVn53nE6dDCsKvE",
    date: "2 days ago",
    rating: 5,
    text: "Priya completely transformed my studio apartment. Her eye for detail and space utilization is unmatched. Highly recommend!",
  },
  {
    id: "ananya",
    name: "Ananya Iyer",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDLZCD0j-0uBAJfH30FVDbB8ao7Md9m319IyEZKLhvlUPxrsL4fxGmwPpjw9f0nQt9cppQ14xvNlqx_b1TF-BdIN-xm4E8OMtF96Diy_I6jDh22X6K_vi4YHLTjAZq5PAqCElJIDfnf7haWTE6g7y80Ko7b2C1fJnnYkWmJ7jco29f4sQXudgWc3oP9SYEhvDaOWx_nz6yr5ZMfe2LOuu-ul_p0d7N1yPvV-K7Y1ctd9p1VreAdkmJOjveYII16MCTyjMDvB5XhN1I",
    date: "1 week ago",
    rating: 4,
    text: "Great consultation session. She gave me practical tips that I could implement immediately on a budget.",
  },
];

function parseParam(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

export function PropertyDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title?: string | string[];
    price?: string | string[];
    location?: string | string[];
    bhk?: string | string[];
    area?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const { refreshing, onRefresh } = usePullToRefresh();

  const title = useMemo(
    () => parseParam(params.title, "3 BHK Luxury Apartment in Juhu"),
    [params.title],
  );
  const price = useMemo(
    () => parseParam(params.price, "₹85,000"),
    [params.price],
  );
  const location = useMemo(
    () => parseParam(params.location, "Juhu, Mumbai"),
    [params.location],
  );
  const bhk = useMemo(() => parseParam(params.bhk, "3 BHK"), [params.bhk]);
  const area = useMemo(
    () => parseParam(params.area, "1,850 Sq Ft"),
    [params.area],
  );

  const topBarHeight = insets.top + 64;
  const footerBottomPadding = Math.max(insets.bottom, 10);

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      <View
        className="absolute inset-x-0 top-0 z-50 border-b border-slate-100 bg-white/80 px-4"
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
        <View className="h-16 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.back()}
              className="p-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <MaterialIcons name="arrow-back" size={22} color="#161D1A" />
            </Pressable>
          </View>

          <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
            Listify
          </Text>

          <View className="flex-row items-center gap-4 pr-2">
            <Pressable
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <MaterialIcons name="share" size={22} color="#6C7A74" />
            </Pressable>
            <Pressable
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <MaterialIcons name="favorite-border" size={22} color="#6C7A74" />
            </Pressable>
          </View>
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
          paddingBottom: 112 + footerBottomPadding,
        }}
      >
        <View className="relative w-full" style={{ aspectRatio: 4 / 3 }}>
          <Image
            source={heroImage}
            contentFit="cover"
            transition={180}
            className="h-full w-full"
          />

          <View
            className="absolute bottom-4 left-1/2 flex-row gap-2"
            style={{ transform: [{ translateX: -18 }] }}
          >
            <View className="h-1 w-8 rounded-full bg-white" />
            <View className="h-1 w-2 rounded-full bg-white/50" />
            <View className="h-1 w-2 rounded-full bg-white/50" />
          </View>

          <View className="absolute bottom-4 right-4 rounded-full bg-black/50 px-3 py-1">
            <Text className="text-[12px] text-white">1/12</Text>
          </View>
        </View>

        <View className="mt-6 px-4">
          <View className="gap-1">
            <Text className="text-[24px] font-bold leading-8 text-[#161D1A]">
              {title}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-[20px] font-bold text-[#005FB0]">
                {price}
              </Text>
              <Text className="text-[12px] text-[#6C7A74]">/ month</Text>
            </View>
          </View>

          <View className="mt-6 flex-row border-y border-[#BBCAC3]/30 py-4">
            <View className="flex-1 items-center border-r border-[#BBCAC3]/30">
              <MaterialIcons name="bed" size={22} color="#006B55" />
              <Text className="mt-1 text-[12px] text-[#6C7A74]">{bhk}</Text>
            </View>
            <View className="flex-1 items-center border-r border-[#BBCAC3]/30">
              <MaterialIcons name="bathtub" size={22} color="#006B55" />
              <Text className="mt-1 text-[12px] text-[#6C7A74]">3 Bath</Text>
            </View>
            <View className="flex-1 items-center">
              <MaterialIcons name="square-foot" size={22} color="#006B55" />
              <Text className="mt-1 text-[12px] text-[#6C7A74]">{area}</Text>
            </View>
          </View>

          <View className="mt-6">
            <Text className="mb-4 text-[18px] font-semibold text-[#161D1A]">
              Key Amenities
            </Text>
            <View
              className="flex-row flex-wrap"
              style={{ columnGap: 8, rowGap: 8 }}
            >
              {[
                { icon: "fitness-center", label: "Private Gym" },
                { icon: "pool", label: "Infinity Pool" },
                { icon: "local-parking", label: "Valet Parking" },
                { icon: "elevator", label: "High-speed Lift" },
              ].map((item) => (
                <View
                  key={item.label}
                  className="flex-row items-center gap-3 rounded-xl border border-[#DDE4DF]/50 bg-[#EFF5F0] p-4"
                  style={{ width: "48.9%" }}
                >
                  <MaterialIcons
                    name={item.icon as keyof typeof MaterialIcons.glyphMap}
                    size={22}
                    color="#006B55"
                  />
                  <Text className="text-[14px] text-[#161D1A]">
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View className="mt-6">
            <Text className="mb-2 text-[18px] font-semibold text-[#161D1A]">
              Description
            </Text>
            <Text className="text-[14px] leading-6 text-[#3C4A44]">
              Modern sea-facing apartment with high-end finishes throughout.
              Located in the heart of Juhu, this luxury residence offers
              panoramic Arabian Sea views, Italian marble flooring, and smart
              home automation. The spacious layout includes a private deck and
              premium fixtures.
            </Text>
            <Pressable className="mt-2 self-start">
              <Text className="text-[12px] font-bold text-[#006B55]">
                Read More
              </Text>
            </Pressable>
          </View>

          <View className="mt-6 rounded-2xl border border-[#BBCAC3]/30 bg-white p-4">
            <View className="flex-row items-center gap-4">
              <View className="relative">
                <Image
                  source={agentAvatar}
                  contentFit="cover"
                  transition={150}
                  className="h-16 w-16 rounded-full"
                />
                <View className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-green-500" />
              </View>

              <View className="flex-1">
                <Text className="text-[18px] font-semibold text-[#161D1A]">
                  Rajesh Malhotra
                </Text>
                <Text className="text-[12px] text-[#6C7A74]">
                  Expert Real Estate • 12 years exp.
                </Text>
              </View>

              <View className="flex-row gap-2">
                <Pressable
                  className="h-10 w-10 items-center justify-center rounded-full bg-[#006B55]/10"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <MaterialIcons name="call" size={20} color="#006B55" />
                </Pressable>
                <Pressable
                  className="h-10 w-10 items-center justify-center rounded-full bg-[#006B55]/10"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <MaterialIcons name="chat" size={20} color="#006B55" />
                </Pressable>
              </View>
            </View>
          </View>

          <View className="mt-6">
            <Text className="mb-4 text-[18px] font-semibold text-[#161D1A]">
              Location
            </Text>
            <View className="relative h-48 overflow-hidden rounded-2xl">
              <Image
                source={mapImage}
                contentFit="cover"
                transition={150}
                className="h-full w-full"
              />
              <View className="absolute inset-0 items-center justify-center bg-black/5">
                <View className="rounded-full bg-white p-2 shadow">
                  <MaterialIcons name="location-on" size={20} color="#EF4444" />
                </View>
              </View>
            </View>
            <View className="mt-2 flex-row items-center gap-1">
              <MaterialIcons name="place" size={16} color="#6C7A74" />
              <Text className="text-[12px] text-[#6C7A74]">
                7th Floor, Sea View Apartments, {location}
              </Text>
            </View>
          </View>

          <View className="mt-6">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-[18px] font-semibold text-[#161D1A]">
                Reviews (128)
              </Text>
              <Pressable>
                <Text className="text-[12px] font-medium text-[#006B55]">
                  Read all
                </Text>
              </Pressable>
            </View>

            <View className="gap-4">
              {reviews.map((review) => (
                <View
                  key={review.id}
                  className="border-b border-slate-100 pb-4"
                >
                  <View className="mb-2 flex-row items-center gap-3">
                    <Image
                      source={review.avatar}
                      contentFit="cover"
                      transition={150}
                      className="h-10 w-10 rounded-full"
                    />

                    <View>
                      <Text className="text-[14px] font-semibold text-[#161D1A]">
                        {review.name}
                      </Text>
                      <View className="-ml-1 flex-row">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <MaterialIcons
                            key={`${review.id}-${index}`}
                            name={
                              index < review.rating ? "star" : "star-border"
                            }
                            size={16}
                            color="#CBA100"
                          />
                        ))}
                      </View>
                    </View>

                    <Text className="ml-auto text-[12px] text-[#6C7A74]">
                      {review.date}
                    </Text>
                  </View>

                  <Text className="text-[14px] leading-5 text-[#3C4A44]">
                    {review.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 z-50 border-t border-[#BBCAC3]/20 bg-white/90 px-4"
        style={{
          paddingTop: 12,
          paddingBottom: footerBottomPadding,
        }}
      >
        <View className="mx-auto w-full max-w-xl flex-row gap-4">
          <Pressable
            className="h-12 flex-1 items-center justify-center rounded-xl border border-[#BBCAC3]"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-[18px] font-semibold text-[#161D1A]">
              Contact Agent
            </Text>
          </Pressable>

          <Pressable
            className="h-12 flex-[1.5] items-center justify-center rounded-xl bg-[#27BB97]"
            style={({ pressed }) => ({
              opacity: pressed ? 0.9 : 1,
              shadowColor: "#27BB97",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 10,
              elevation: 4,
            })}
          >
            <Text className="text-[18px] font-semibold text-white">
              Request Visit
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
