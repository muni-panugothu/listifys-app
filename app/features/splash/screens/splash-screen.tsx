import { type Href, useRouter } from "@/lib/safe-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { restoreSession } from "@/store/slices/auth-slice";
import { checkOnboarding } from "@/store/slices/onboarding-slice";

export function SplashScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const { hasCompletedOnboarding } = useAppSelector((s) => s.onboarding);
  const hasNavigatedRef = useRef(false);
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Fail-safe: never allow splash to block forever.
    const fallback = setTimeout(() => {
      if (isMounted) {
        setIsBootstrapped(true);
      }
    }, 2200);

    Promise.all([dispatch(checkOnboarding()), dispatch(restoreSession())]).finally(
      () => {
        if (isMounted) {
          setIsBootstrapped(true);
        }
        clearTimeout(fallback);
      },
    );

    return () => {
      isMounted = false;
      clearTimeout(fallback);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!isBootstrapped || hasNavigatedRef.current) return;

    // If onboarding state is unresolved, treat as first-time user.
    const onboardingCompleted = hasCompletedOnboarding === true;

    const timeout = setTimeout(() => {
      hasNavigatedRef.current = true;
      if (isAuthenticated) {
        router.replace("/home-feed-root" as Href);
      } else if (!onboardingCompleted) {
        router.replace("/onboarding-slide-3" as Href);
      } else {
        router.replace("/sign-in" as Href);
      }
    }, 700);

    return () => {
      clearTimeout(timeout);
    };
  }, [isBootstrapped, hasCompletedOnboarding, isAuthenticated, router]);

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
