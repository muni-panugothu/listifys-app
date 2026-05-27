import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";

import { ListifyFonts } from "@/constants/typography";

let defaultsApplied = false;

function applyDefaultTextFonts() {
  if (defaultsApplied) return;
  defaultsApplied = true;

  const baseStyle = { fontFamily: ListifyFonts.regular };

  Text.defaultProps = Text.defaultProps ?? {};
  Text.defaultProps.style = [baseStyle, Text.defaultProps.style];

  TextInput.defaultProps = TextInput.defaultProps ?? {};
  TextInput.defaultProps.style = [baseStyle, TextInput.defaultProps.style];
}

type TypographyProviderProps = {
  children: ReactNode;
};

export function TypographyProvider({ children }: TypographyProviderProps) {
  const [loaded, error] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      applyDefaultTextFonts();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F6F7F8]">
        <ActivityIndicator size="large" color="#1B3022" />
      </View>
    );
  }

  return <>{children}</>;
}
