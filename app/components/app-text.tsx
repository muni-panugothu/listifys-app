import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { ListifyFonts, ListifyTypography } from "@/constants/typography";

export type AppTextVariant = keyof typeof ListifyTypography;

type AppTextProps = RNTextProps & {
  variant?: AppTextVariant;
  weight?: keyof typeof ListifyFonts;
};

export function AppText({
  variant,
  weight,
  style,
  ...props
}: AppTextProps) {
  const variantStyle = variant ? ListifyTypography[variant] : undefined;
  const weightStyle = weight ? { fontFamily: ListifyFonts[weight] } : undefined;

  return <RNText style={[variantStyle, weightStyle, style]} {...props} />;
}
