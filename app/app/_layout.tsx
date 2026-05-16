import { AuthGateBottomSheet } from "@/features/auth/components/auth-gate-bottom-sheet";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { type Href, Stack, useRouter } from "@/lib/safe-router";
import { StatusBar } from "expo-status-bar";
import { useCallback } from "react";
import "react-native-reanimated";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { store } from "@/store";

export default function RootLayout() {
  return (
    <Provider store={store}>
      <AppLayout />
    </Provider>
  );
}

function AppLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { visible, action, redirectTo } = useAppSelector((state) => state.authGate);

  const handleCloseAuthGate = useCallback(() => {
    dispatch(hideAuthGate());
  }, [dispatch]);

  const handleAuthenticated = useCallback(() => {
    if (redirectTo) {
      router.replace(redirectTo as Href);
    }
  }, [redirectTo, router]);

  const authGateEmailSignInHref = useCallback(() => {
    if (!redirectTo) return "/sign-in" as Href;
    return {
      pathname: "/sign-in",
      params: { redirectTo },
    } as Href;
  }, [redirectTo]);

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
          <Stack.Screen
            name="sell-entry"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="post-ad-step1-category"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="post-ad-step2-details"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="post-ad-step3-media"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="edit-listing"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="create-offer-modal"
            options={{ headerShown: false, presentation: "transparentModal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="report-listing-modal"
            options={{ headerShown: false, presentation: "transparentModal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="listing-success"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="listing-draft-saved"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="my-listings-active"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="my-listings-expired"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="my-listings-drafts"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="saved-items"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="dashboard-home"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="followers-following"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="profile-details-edit"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="messages-inbox"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="chat-conversation"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="notifications-center"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="devices"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="activity-log"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="app-settings"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="security"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="logout-modal"
            options={{ headerShown: false, presentation: "transparentModal", animation: "fade" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
