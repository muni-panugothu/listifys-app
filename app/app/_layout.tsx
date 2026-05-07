import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            animationMatchesGesture: true,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="onboarding-slide-1"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="onboarding-slide-2"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="onboarding-slide-3"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="sign-up" options={{ headerShown: false }} />
          <Stack.Screen
            name="forgot-password"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="reset-otp-verification"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="new-password" options={{ headerShown: false }} />
          <Stack.Screen
            name="home-feed-root"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="category-listing-template"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="listing-detail-template"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="search-home" options={{ headerShown: false }} />
          <Stack.Screen
            name="search-results-entity-tabs"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="nearby-map-view-bottom-sheet"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="services-category-hub"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="service-listing-grid"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="service-detail"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="properties-listing"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="property-detail"
            options={{ headerShown: false }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
