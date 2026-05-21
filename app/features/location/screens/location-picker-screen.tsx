import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "@/lib/safe-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_SCREEN_BG } from "@/constants/theme";
import { ListifyFonts } from "@/constants/typography";
import { showErrorToast } from "@/lib/toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setLocationFromSearch,
  useCurrentDeviceLocation,
} from "@/store/slices/location-slice";

const BRAND = "#27BB97";

export function LocationPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const currentLabel = useAppSelector((s) => s.location.label);
  const status = useAppSelector((s) => s.location.status);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const busy = submitting || status === "loading";

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/home-feed-root" as Href);
    }
  }, [router]);

  const handleSearchSubmit = useCallback(async () => {
    const text = query.trim();
    if (!text) return;

    Keyboard.dismiss();
    setSubmitting(true);
    try {
      await dispatch(setLocationFromSearch(text)).unwrap();
      handleBack();
    } catch (error) {
      showErrorToast(
        "Location not found",
        error instanceof Error ? error.message : "Try a different place name.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [dispatch, handleBack, query]);

  const handleUseCurrentLocation = useCallback(async () => {
    setSubmitting(true);
    try {
      await dispatch(useCurrentDeviceLocation()).unwrap();
      handleBack();
    } catch (error) {
      showErrorToast(
        "Location unavailable",
        error instanceof Error
          ? error.message
          : "Allow location access in settings and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [dispatch, handleBack]);

  return (
    <View className="flex-1" style={{ backgroundColor: APP_SCREEN_BG }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
        }}
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            className="mr-1 h-10 w-10 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="chevron-left" size={32} color="#1A1A1A" />
          </Pressable>
          <Text
            className="text-[22px] text-[#1A1A1A]"
            style={{ fontFamily: ListifyFonts.bold }}
          >
            Choose location
          </Text>
        </View>

        <View
          className="mt-5 h-12 flex-row items-center rounded-2xl bg-white px-4"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <MaterialIcons name="search" size={22} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void handleSearchSubmit()}
            placeholder="Search city, area, or address"
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            editable={!busy}
            className="ml-3 flex-1 text-[16px] text-[#1A1A1A]"
            style={{ fontFamily: ListifyFonts.regular, paddingVertical: 0 }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <MaterialIcons name="close" size={20} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </View>

        {currentLabel && currentLabel !== "Set location" ? (
          <View className="mt-4 flex-row items-start gap-2 rounded-2xl bg-white px-4 py-3">
            <MaterialIcons name="location-on" size={20} color={BRAND} />
            <View className="flex-1">
              <Text
                className="text-[12px] text-[#9CA3AF]"
                style={{ fontFamily: ListifyFonts.regular }}
              >
                Current
              </Text>
              <Text
                className="text-[15px] text-[#1A1A1A]"
                style={{ fontFamily: ListifyFonts.semiBold }}
              >
                {currentLabel}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View className="flex-1 justify-end px-5" style={{ paddingBottom: insets.bottom + 24 }}>
        <Pressable
          onPress={() => void handleSearchSubmit()}
          disabled={busy || !query.trim()}
          className="mb-3 items-center rounded-2xl py-4"
          style={({ pressed }) => ({
            backgroundColor: BRAND,
            opacity: busy || !query.trim() ? 0.5 : pressed ? 0.9 : 1,
          })}
        >
          {busy && query.trim() ? (
            <ActivityIndicator color={BRAND} />
          ) : (
            <Text
              className="text-[16px]"
              style={{ fontFamily: ListifyFonts.semiBold }}
            >
              Use this location
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => void handleUseCurrentLocation()}
          disabled={busy}
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white py-4"
          style={({ pressed }) => ({
            opacity: busy ? 0.6 : pressed ? 0.9 : 1,
          })}
        >
          {busy && !query.trim() ? (
            <ActivityIndicator color={BRAND} />
          ) : (
            <>
              <MaterialIcons name="my-location" size={22} color={BRAND} />
              <Text
                className="text-[16px]"
                style={{ fontFamily: ListifyFonts.semiBold, color: BRAND }}
              >
                Use my current location
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
