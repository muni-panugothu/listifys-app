import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    PanResponder,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type NearbyItem = {
  id: string;
  title: string;
  location: string;
  distance: string;
  price: string;
  badge: string;
  image: string;
  liked?: boolean;
  active?: boolean;
};

const mapBackgroundImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAKVZlC-TyqExGtIWEdUMKO7pl85Pw8XEo_B5x6FEDH-KjV1RQERm14jNlyFb5AIVl9_Q7fr0xHghNonRnFivXQS3Srrs8_iA2g4b26fuFJYn43fBWw2_ZEc4D7E-aHD31BjHataW9ilcK_oZY1knyNtcd1aPSQedeXQGlBUzo-Mbf9gNDu6v7PSFWXUj7r_n8DrDjOf7v7B8Rtk4NRx62PJaBR2Q_y-6Od0OiFGatp7Yik_9EsP3O5f58NhznQNBDWbJPxXnHvwWM";

const activePinPreviewImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBCJuVgpJKlEhIhg2dtFu-Pa6QN_NSQ4J3anBEn-xyk6EY0_-OHt_Iy7KdQm1fqhu7yKeGG8XPS94X6brw_I1eY9hdp69TBPDWIazu6idMx1kz8Q0W7t11wFUT47YvOZyyamJR7HjnZNTkxv6YHozDSnIVyFXJkZs9IW19DlUjACGfQ0RzLEQT5bR8UIrAT5j4nDaiXd6oWFsADj2rzhElJllKNRdxW54K5iKI6cZak5Oa1l9JsliAfW6qp0ZvxgWBYWDtYDH169Ig";

const nearbyListings: NearbyItem[] = [
  {
    id: "chair",
    title: "Premium Office Chair",
    location: "Powai",
    distance: "0.5 km",
    price: "₹3,200",
    badge: "Used - Like New",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCJFJl-kKRARvk_Ue3ik5ClkRcP8HveevJ2c_C0qItO00eFRjBzEkN2rkDWYFdpcWuVGlPExAzxDJagswazNAjw7AYBpKegG0VR6IJ_uSXUAAhTKrOEd2UhH8pr6XKCjFkAkFK5FIWMT800hnFV-dJ15gjffWX_T8OVR9vvtBsiwQBhzxDE9iBdOmPCnNBWMFOgVhKZyecDqoXk7ou3vkfZgJoTog0U3ERybkBuE9t7GpfeqC6hVP31Y2XF_vsMSSzNjPvmXeUJSY8",
  },
  {
    id: "macbook",
    title: "MacBook Pro M1",
    location: "Chandivali",
    distance: "0.8 km",
    price: "₹45,000",
    badge: "Promoted",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDLXUtQkTjTbxqR71KXIEX3j1CBBNW3bU2KdAYoa-JFOqxQgOzZMiOv5a9fmxYmPeqf2L75snCMQFuc9Neu9QC4Gvaq7aeNstjeeGhIEGXatYEk8nnUqXxZLOiBLbWcmVuEslq8bWt9ZNoU6JKJCf9p64pPNZ_JYSUKLar6x1EY2O-VLUnR1xO3Lo5647tG2e7w5Bi87a_e0Lz1Ov19rguE_9l1jgFP0U2iQdQH7rbuTXEKlOUKW4GCOzWakFLBhRyxe5AzCJKyMV0",
    liked: true,
    active: true,
  },
  {
    id: "cycle",
    title: "Hybrid City Cycle",
    location: "Hiranandani",
    distance: "1.2 km",
    price: "₹8,500",
    badge: "2 years old",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDpqRdWnPxa4P9TTTcaW-WZdU1djVx9eZmUarUBvJluo-svIJnov4turRr0jUCHVl1Nc16QalGLouay1e3ETMftxKFu4dqmKrbEdU0ZG1ZDOZQR991DxcfFIfeEFyHXcPY_SXC0IUV7PVqyCB2n4YJvunV1glNwXMexTyLKzStndJdm7nLbvB_2SHPnkHXlDRMxVLeQNvr_Vr3joRcCr-j4sYDUxr1Ys8lnMaXaVPpNYrbrzHilyBq9fRc_Iqkb_pCs21O31lGDjr4",
  },
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

function parseQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "Search nearby...";
  }
  return value ?? "Search nearby...";
}

function MapPin({
  iconName,
  active = false,
}: {
  iconName: keyof typeof MaterialIcons.glyphMap;
  active?: boolean;
}) {
  return (
    <View style={{ transform: [{ rotate: "-45deg" }] }}>
      <View
        className="h-10 w-10 items-center justify-center rounded-full rounded-bl-sm border-2 border-white bg-[#27BB97]"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: active ? 5 : 3 },
          shadowOpacity: active ? 0.22 : 0.15,
          shadowRadius: active ? 8 : 5,
          elevation: active ? 8 : 5,
        }}
      >
        <View style={{ transform: [{ rotate: "45deg" }] }}>
          <MaterialIcons
            name={iconName}
            size={active ? 20 : 18}
            color="#FFFFFF"
          />
        </View>
      </View>
    </View>
  );
}

export function NearbyMapViewBottomSheetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(() => parseQueryParam(params.q));
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const { refreshing, onRefresh } = usePullToRefresh();

  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetTranslateRef = useRef(0);

  const topOverlayPadding = useMemo(() => insets.top + 8, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const bottomNavHeight = bottomNavPadding + 76;
  const sheetTopInset = insets.top + 92;
  const sheetHeight = Math.max(
    320,
    SCREEN_HEIGHT - sheetTopInset - bottomNavHeight,
  );
  const collapsedVisibleHeight = Math.min(
    300,
    Math.max(210, SCREEN_HEIGHT * 0.33),
  );
  const collapsedTranslateY = Math.max(0, sheetHeight - collapsedVisibleHeight);
  const bottomSheetListPadding = bottomNavPadding + 24;

  useEffect(() => {
    const listener = sheetTranslateY.addListener(({ value }) => {
      sheetTranslateRef.current = value;
    });

    return () => {
      sheetTranslateY.removeListener(listener);
    };
  }, [sheetTranslateY]);

  useEffect(() => {
    sheetTranslateY.setValue(collapsedTranslateY);
    sheetTranslateRef.current = collapsedTranslateY;
    setIsSheetExpanded(false);
  }, [collapsedTranslateY, sheetTranslateY]);

  const snapSheetTo = (toValue: number) => {
    Animated.spring(sheetTranslateY, {
      toValue,
      useNativeDriver: true,
      damping: 24,
      stiffness: 240,
      mass: 0.45,
    }).start(() => {
      const expandedThreshold = collapsedTranslateY * 0.4;
      setIsSheetExpanded(toValue <= expandedThreshold);
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((value) => {
            sheetTranslateRef.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const nextValue = Math.min(
            Math.max(0, sheetTranslateRef.current + gestureState.dy),
            collapsedTranslateY,
          );
          sheetTranslateY.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          const projected = Math.min(
            Math.max(0, sheetTranslateRef.current + gestureState.dy),
            collapsedTranslateY,
          );
          const shouldExpand =
            projected < collapsedTranslateY / 2 || gestureState.vy < -0.45;
          snapSheetTo(shouldExpand ? 0 : collapsedTranslateY);
        },
        onPanResponderTerminate: () => {
          const shouldExpand =
            sheetTranslateRef.current < collapsedTranslateY / 2;
          snapSheetTo(shouldExpand ? 0 : collapsedTranslateY);
        },
      }),
    [collapsedTranslateY],
  );

  const handleBottomTabPress = useTabNavigation();

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      <View className="absolute inset-0">
        <Image
          source={mapBackgroundImage}
          contentFit="cover"
          transition={150}
          className="h-full w-full"
          style={{ opacity: 0.62 }}
        />
      </View>

      <View className="absolute left-[25%] top-[35%] z-20">
        <MapPin iconName="weekend" />
      </View>

      <View className="absolute left-[50%] top-[42%] z-20">
        <MapPin iconName="electric-bike" />
      </View>

      <View
        className="absolute left-[65%] top-[55%] z-30"
        style={{ transform: [{ scale: 1.08 }] }}
      >
        <MapPin iconName="laptop-mac" active />

        <View
          className="absolute -left-20 -top-40 w-48 overflow-hidden rounded-xl border border-slate-100 bg-white"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.18,
            shadowRadius: 14,
            elevation: 10,
          }}
        >
          <View className="relative h-24">
            <Image
              source={activePinPreviewImage}
              contentFit="cover"
              transition={150}
              className="h-full w-full"
            />
            <View className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1">
              <Text className="text-[10px] font-bold text-[#27BB97]">
                ₹45,000
              </Text>
            </View>
          </View>
          <View className="p-2">
            <Text
              numberOfLines={1}
              className="text-[12px] font-semibold text-[#161D1A]"
            >
              MacBook Pro M1 2021
            </Text>
            <View className="mt-1 flex-row items-center gap-1">
              <MaterialIcons name="location-on" size={12} color="#6C7A74" />
              <Text className="text-[10px] text-[#6C7A74]">0.8 km away</Text>
            </View>
          </View>
        </View>
      </View>

      <View
        className="absolute inset-x-0 z-40 px-4"
        style={{ top: topOverlayPadding }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="h-12 w-12 items-center justify-center rounded-full bg-white/85"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <MaterialIcons name="arrow-back" size={22} color="#3C4A44" />
          </Pressable>

          <View
            className="h-12 flex-1 flex-row items-center gap-3 rounded-full border border-slate-100 bg-white/85 px-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <MaterialIcons name="search" size={20} color="#27BB97" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search furniture, electronics..."
              placeholderTextColor="#6C7A74"
              className="flex-1 text-[14px] text-[#161D1A]"
              style={{ paddingVertical: 0 }}
            />
            <MaterialIcons name="tune" size={20} color="#6C7A74" />
          </View>
        </View>
      </View>

      <View className="absolute right-4 top-[45%] z-40 gap-3">
        <Pressable
          className="h-12 w-12 items-center justify-center rounded-xl bg-white/90"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <MaterialIcons name="my-location" size={22} color="#161D1A" />
        </Pressable>

        <Pressable
          className="h-12 w-12 items-center justify-center rounded-xl bg-white/90"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <MaterialIcons name="layers" size={22} color="#161D1A" />
        </Pressable>
      </View>

      <Animated.View
        className="absolute inset-x-0 z-50"
        style={{
          height: sheetHeight,
          bottom: bottomNavHeight,
          transform: [{ translateY: sheetTranslateY }],
        }}
      >
        <View
          className="h-full rounded-t-4xl border-t border-slate-100 bg-white pt-3"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.12,
            shadowRadius: 20,
            elevation: 12,
          }}
        >
          <View className="items-center pb-2" {...panResponder.panHandlers}>
            <Pressable
              onPress={() =>
                snapSheetTo(isSheetExpanded ? collapsedTranslateY : 0)
              }
              hitSlop={8}
              className="mb-4 h-7 w-24 items-center justify-center"
            >
              <View className="h-1.5 w-12 rounded-full bg-slate-200" />
            </Pressable>

            <View className="mb-4 w-full flex-row items-center justify-between px-4">
              <View>
                <Text className="text-[20px] font-semibold text-[#161D1A]">
                  Nearby Listings
                </Text>
                <Text className="text-[12px] text-[#6C7A74]">
                  Showing 24 items within 2 km
                </Text>
              </View>

              <Pressable
                onPress={() => router.push("/search-results-entity-tabs")}
                className="rounded-full bg-[#27BB97]/10 px-4 py-2"
              >
                <Text className="text-[12px] font-medium text-[#27BB97]">
                  List View
                </Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            scrollEnabled={isSheetExpanded}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#27BB97"]}
                tintColor="#27BB97"
              />
            }
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: bottomSheetListPadding,
            }}
          >
            <View className="gap-4 pb-4">
              {nearbyListings.map((item) => {
                const isActive = !!item.active;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push("/listing-detail-template")}
                    className="flex-row gap-4 rounded-2xl p-3"
                    style={{
                      backgroundColor: isActive
                        ? "rgba(39,187,151,0.05)"
                        : "#FFFFFF",
                      borderWidth: isActive ? 2 : 1,
                      borderColor: isActive
                        ? "rgba(39,187,151,0.2)"
                        : "#F1F5F9",
                    }}
                  >
                    <View className="h-24 w-24 overflow-hidden rounded-xl">
                      <Image
                        source={item.image}
                        contentFit="cover"
                        transition={150}
                        className="h-full w-full"
                      />
                    </View>

                    <View className="flex-1 justify-between py-0.5">
                      <View>
                        <View className="flex-row items-start justify-between">
                          <Text className="text-[18px] font-semibold leading-6 text-[#161D1A]">
                            {item.title}
                          </Text>
                          <MaterialIcons
                            name={item.liked ? "favorite" : "favorite-border"}
                            size={20}
                            color={item.liked ? "#BA1A1A" : "#6C7A74"}
                          />
                        </View>
                        <Text className="mt-1 text-[12px] text-[#6C7A74]">
                          {item.location} • {item.distance}
                        </Text>
                      </View>

                      <View className="flex-row items-end justify-between">
                        <Text className="text-[16px] font-bold text-[#27BB97]">
                          {item.price}
                        </Text>
                        <View
                          className="rounded-md px-2 py-0.5"
                          style={{
                            backgroundColor: isActive
                              ? "rgba(203,161,0,0.2)"
                              : "#E9EFEB",
                          }}
                        >
                          <Text
                            className="text-[10px] font-bold uppercase"
                            style={{ color: isActive ? "#755B00" : "#3C4A44" }}
                          >
                            {item.badge}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Animated.View>

      <View
        className="absolute inset-x-0 bottom-0 z-60 rounded-t-2xl border-t border-slate-100 bg-white"
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
