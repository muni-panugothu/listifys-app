import { type Href, useRouter } from "@/lib/safe-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { configureGoogleSignIn } from "@/lib/google-sign-in";
import { getFCMToken } from "@/lib/firebase-messaging";
import { useAppDispatch } from "@/store/hooks";
import { store } from "@/store";
import { getAccessToken, getRefreshToken, restoreTokens } from "@/features/auth/services/auth-api";
import { restoreSession } from "@/store/slices/auth-slice";
import { checkOnboarding } from "@/store/slices/onboarding-slice";

const HOME_ROUTE = "/(tabs)/home-feed-root" as Href;

export function SplashScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await dispatch(checkOnboarding());
        const sessionResult = await dispatch(restoreSession());
        await configureGoogleSignIn().catch(() => {});
        await getFCMToken().catch(() => null);

        if (cancelled) return;

        const authenticated =
          restoreSession.fulfilled.match(sessionResult) &&
          sessionResult.payload.isAuthenticated;

        finishNavigation(authenticated);
      } catch {
        if (cancelled) return;
        await restoreTokens().catch(() => {});
        const hasTokens = Boolean(getAccessToken() || getRefreshToken());
        finishNavigation(hasTokens);
      }
    };

    const finishNavigation = (authenticated: boolean) => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;

      const onboardingCompleted =
        store.getState().onboarding.hasCompletedOnboarding === true;

      if (authenticated) {
        router.replace(HOME_ROUTE);
        return;
      }

      // Always show onboarding when not authenticated — covers:
      // • new users (first launch)
      // • users who logged out and restarted the app
      router.replace("/onboarding-slide-3" as Href);
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [dispatch, router]);

  return (
    <View
      className="flex-1 items-center justify-center bg-white"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <StatusBar style="dark" />

      <Image
        source={require("../../../assets/splashscreenImg/splashImg.png")}
        className="h-52 w-52"
        resizeMode="contain"
      />

      <View className="mt-8">
        <ActivityIndicator size="large" color="#111827" />
      </View>
    </View>
  );
}
