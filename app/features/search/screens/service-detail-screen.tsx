import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "@/lib/safe-router";
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

type ReviewItem = {
  id: string;
  avatar: string;
  name: string;
  date: string;
  rating: number;
  review: string;
};

type PortfolioItem = {
  id: string;
  image: string;
};

type PricePlan = {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  popular?: boolean;
};

const coverImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBGs23VktszuEagNylsPgf-9GFSu_s7uCb-J6Qi7ZCGqtm6O_KuWB_Y211FM3R8s4vQ9Tqs5YGlZ-C0v8gy8KMLTMzjLKoRrBkYepTFmKvmGpe_hWjjFe-xc3r1xuF-7JuUn-rwb4oqOoJrkNJOmG0wgxodueczJg2KwV6eEWKRyQzOMcWUqEjcex5_N_X3vo12YYaGEyFbq7_UXCyV2Z4KzsGH7wQVLUsRieRu8MkUOBXmvHwNx2Oy95ElfT9LiF_a4z5IgO8CNOM";

const profileImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBED343g7NNJLDUCiIrrFmoy5-EuJ-1-7wUNbwPZB6UWNvZdRTc4oCsjzevF1m4W4nBGpyZhTP142vJfSrr-pEyK9M5vBqCg_xhx21wxvxbWX0_ZbyvpNlv7IqgNzb6Dsx6pGCypesc_jOGb4-Le_eNcsvv-HYTlLcNnaIFv7LPeaednPFP8pCcIT4BcgDh2LelQ5eV_wuYr2HGFrpQxziOTQILaAO7JE-ywYSWMvBmok9FQzxpUczRw-YymnXUMuip2TJZJ4Eh1uY";

const portfolioItems: PortfolioItem[] = [
  {
    id: "living-room",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAlF2hAkVSYAm55L-77f-1LeCVgUsqf1kGAAdXwSavFj5-Dx2962_CVzkWf4-b0BqlhxzIeVvqSGbJWcHWC5SJuBbOlRHkuuU7qrbEFXcT97DuzwhCnZLoEL3MB-nPruSU_4jNS6ImivBqH_Hwwv833ShjNfWIBX1O-3UIC65XKVuj-ttjKVYA6qt4UblJPvt-CDdr7zy4fPajx452zpb-iyP3S3RH7087CdCoAv17-zMQbXC5XXN5OZOQizqonf3zmlIGu0u62B2E",
  },
  {
    id: "kitchen",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCIvXQr-RSAw2-OgCORDMu-psGNbDYVhAR7cuavsRinq3am5cPvQtmKfK22bDAY0UIbBfG1sf7vPsIv9KjrfOxChm8rI4LQonJP8t3UGxtulsgtQJTky9trMQECYtbUEkiK9G7SF8ZmAjAcJVjUShIIRHZWuXJ0S2gCheTZDH95DH7HvAW6jFriKib5pP82y65z_sGYW_vPPkLbZtAzdCRqSFLOw6WZyEUytxiD2LSzB3mzYjKDpshkMaXMLE_dweO8y-b0oK5OIcE",
  },
  {
    id: "bedroom",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC_Syn_4SedQpoO1LekoxQB6Fm47gnq8TAiGA_rh7V8_vh1nKziPOf0fpithR0zMz6vzyJGr1grsWewxSM-C1XfBbIQQJ99IS-ADT7Rf3CzLvqOD51d0_GDOwD3Z5v8-bW0yctNOJ-WsLiD4B10s6y2y7IirRAwjgkxFmtHcqNVmzTx4r9u8CIfV_jmMRJ1mHZidh_cKeeQM49jBza2WKrOu49t6Bi-CQ2ga3B8UTajLhhm8AUKkqpbrtcjCfu8LhXB5_LlvKkZEvc",
  },
];

const pricingPlans: PricePlan[] = [
  {
    id: "consult",
    title: "Consultation Call",
    subtitle: "45 min video strategy session",
    price: "₹1,499",
  },
  {
    id: "room-redesign",
    title: "Room Redesign",
    subtitle: "Full 2D layout + Material list",
    price: "₹8,999",
    popular: true,
  },
];

const reviews: ReviewItem[] = [
  {
    id: "rahul",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDSctB2QhHptLZ-gpplqfqBrAI423MtkNpBWjWUL5WiI1RAiPllwt2z8GGaI7h96_Y5WJj6sUjE3IuiXibLrv_hUjfiOs8T4lAo8RKWDhq1GKzv0pHfZu7oz6_f_TsG6ObY_C_7jp9O-tJGdqzNB9P4lFOHBKOjhLDU7fPRYWLZ5Zh0JBJ3nqZcGGhV8pE-kLBPiJZ3GjpCUNj1t10IFyEJevDyWOlpU9npFtF2HvJhJpXbSuPZpzbVu89mplqdSVn53nE6dDCsKvE",
    name: "Rahul Mehta",
    date: "2 days ago",
    rating: 5,
    review:
      "Priya completely transformed my studio apartment. Her eye for detail and space utilization is unmatched. Highly recommend!",
  },
  {
    id: "ananya",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDLZCD0j-0uBAJfH30FVDbB8ao7Md9m319IyEZKLhvlUPxrsL4fxGmwPpjw9f0nQt9cppQ14xvNlqx_b1TF-BdIN-xm4E8OMtF96Diy_I6jDh22X6K_vi4YHLTjAZq5PAqCElJIDfnf7haWTE6g7y80Ko7b2C1fJnnYkWmJ7jco29f4sQXudgWc3oP9SYEhvDaOWx_nz6yr5ZMfe2LOuu-ul_p0d7N1yPvV-K7Y1ctd9p1VreAdkmJOjveYII16MCTyjMDvB5XhN1I",
    name: "Ananya Iyer",
    date: "1 week ago",
    rating: 4,
    review:
      "Great consultation session. She gave me practical tips that I could implement immediately on a budget.",
  },
];

function parseParam(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

export function ServiceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string | string[];
    badge?: string | string[];
    startingPrice?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const { refreshing, onRefresh } = usePullToRefresh();

  const professionalName = useMemo(
    () => parseParam(params.name, "Priya Sharma"),
    [params.name],
  );
  const professionalBadge = useMemo(
    () =>
      parseParam(params.badge, "Premium Interior Architect & Space Planner"),
    [params.badge],
  );
  const startingPrice = useMemo(
    () => parseParam(params.startingPrice, "₹1,499"),
    [params.startingPrice],
  );

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const footerBottom = Math.max(insets.bottom, 12);

  return (
    <View className="flex-1 bg-[#F6F7F8]">
      <View
        className="absolute inset-x-0 top-0 z-50 bg-white/80 px-4"
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
              className="p-2"
              onPress={() => router.back()}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <MaterialIcons name="arrow-back" size={22} color="#161D1A" />
            </Pressable>
            <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
              Listify
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              className="rounded-full p-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <MaterialIcons name="share" size={22} color="#161D1A" />
            </Pressable>
            <Pressable
              className="rounded-full p-2"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <MaterialIcons name="favorite-border" size={22} color="#161D1A" />
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
          paddingBottom: 120 + footerBottom,
        }}
      >
        <View className="relative h-64 w-full">
          <Image
            source={coverImage}
            contentFit="cover"
            transition={200}
            className="h-full w-full"
          />

          <View className="absolute -bottom-12 left-4">
            <View className="relative">
              <Image
                source={profileImage}
                contentFit="cover"
                transition={200}
                className="h-24 w-24 rounded-xl border-4 border-white"
              />
              <View className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-[#27BB97] p-1">
                <MaterialIcons name="verified" size={16} color="#FFFFFF" />
              </View>
            </View>
          </View>
        </View>

        <View className="mt-16 px-4">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="text-[24px] font-bold text-[#161D1A]">
                {professionalName}
              </Text>
              <Text className="text-[16px] text-[#6C7A74]">
                {professionalBadge}
              </Text>
            </View>

            <View className="flex-row items-center gap-1 rounded-lg bg-[#E9EFEB] px-2 py-1">
              <MaterialIcons name="star" size={18} color="#CBA100" />
              <Text className="text-[16px] font-bold text-[#161D1A]">4.9</Text>
            </View>
          </View>

          <View className="mt-4 flex-row gap-4">
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="location-on" size={16} color="#6C7A74" />
              <Text className="text-[12px] font-medium text-[#6C7A74]">
                Bandra, Mumbai
              </Text>
            </View>

            <View className="flex-row items-center gap-1">
              <MaterialIcons name="work" size={16} color="#6C7A74" />
              <Text className="text-[12px] font-medium text-[#6C7A74]">
                8+ Years Exp.
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-6">
          <View className="mb-2 flex-row items-center justify-between px-4">
            <Text className="text-[20px] font-semibold text-[#161D1A]">
              Portfolio
            </Text>
            <Pressable>
              <Text className="text-[12px] font-medium text-[#27BB97]">
                View all
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {portfolioItems.map((item) => (
              <Image
                key={item.id}
                source={item.image}
                contentFit="cover"
                transition={200}
                className="h-32 w-48 rounded-xl border border-slate-100"
              />
            ))}
          </ScrollView>
        </View>

        <View className="mt-6 px-4">
          <Text className="mb-2 text-[20px] font-semibold text-[#161D1A]">
            About me
          </Text>
          <Text className="text-[14px] leading-6 text-[#3C4A44]">
            Transforming spaces into curated experiences. I specialize in
            contemporary Indian aesthetics blended with global minimalism. My
            focus is on sustainable materials and ergonomic efficiency for
            modern urban homes.
          </Text>
        </View>

        <View className="mt-6 px-4">
          <Text className="mb-2 text-[20px] font-semibold text-[#161D1A]">
            Pricing
          </Text>

          <View className="gap-2">
            {pricingPlans.map((plan) => (
              <View
                key={plan.id}
                className="relative flex-row items-center justify-between rounded-xl bg-white p-4"
                style={{
                  borderWidth: plan.popular ? 2 : 1,
                  borderColor: plan.popular ? "#27BB97" : "#BBCAC3",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: plan.popular ? 0.08 : 0.04,
                  shadowRadius: 3,
                  elevation: plan.popular ? 2 : 1,
                }}
              >
                {plan.popular ? (
                  <View className="absolute right-0 top-0 rounded-bl-lg bg-[#27BB97] px-3 py-0.5">
                    <Text className="text-[10px] font-medium uppercase tracking-[1.4px] text-white">
                      Popular
                    </Text>
                  </View>
                ) : null}

                <View className="pr-3">
                  <Text className="text-[18px] font-semibold text-[#161D1A]">
                    {plan.title}
                  </Text>
                  <Text className="text-[12px] text-[#6C7A74]">
                    {plan.subtitle}
                  </Text>
                </View>

                <Text className="text-[20px] font-bold text-[#27BB97]">
                  {plan.price}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="mt-6 px-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-[20px] font-semibold text-[#161D1A]">
              Reviews (128)
            </Text>
            <Pressable>
              <Text className="text-[12px] font-medium text-[#27BB97]">
                Read all
              </Text>
            </Pressable>
          </View>

          <View className="gap-4">
            {reviews.map((item) => (
              <View key={item.id} className="border-b border-slate-100 pb-4">
                <View className="mb-2 flex-row items-center gap-3">
                  <Image
                    source={item.avatar}
                    contentFit="cover"
                    transition={150}
                    className="h-10 w-10 rounded-full"
                  />

                  <View>
                    <Text className="text-[14px] font-semibold text-[#161D1A]">
                      {item.name}
                    </Text>
                    <View className="-ml-1 flex-row">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const filled = index < item.rating;
                        return (
                          <MaterialIcons
                            key={`${item.id}-star-${index}`}
                            name={filled ? "star" : "star-border"}
                            size={16}
                            color="#CBA100"
                          />
                        );
                      })}
                    </View>
                  </View>

                  <Text className="ml-auto text-[12px] text-[#6C7A74]">
                    {item.date}
                  </Text>
                </View>

                <Text className="text-[14px] leading-5 text-[#3C4A44]">
                  {item.review}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white/90 px-4"
        style={{
          paddingTop: 16,
          paddingBottom: footerBottom,
        }}
      >
        <View className="flex-row items-center gap-4">
          <View className="flex-1">
            <Text className="text-[12px] text-[#6C7A74]">Starting from</Text>
            <Text className="text-[20px] font-bold text-[#161D1A]">
              {startingPrice}
            </Text>
          </View>

          <Pressable
            className="flex-[2] overflow-hidden rounded-lg"
            style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
          >
            <LinearGradient
              colors={["#27BB97", "#1E9E7E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="h-12 flex-row items-center justify-center gap-2"
            >
              <Text className="text-[18px] font-semibold text-white">
                Book Now
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
