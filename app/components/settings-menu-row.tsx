import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Switch, Text, View } from "react-native";

import { ListifyFonts } from "@/constants/typography";

type SettingsMenuRowProps = {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  iconBg: string;
  iconColor: string;
  label: string;
  subtitle?: string;
  type: "navigate" | "toggle";
  value?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
  disabled?: boolean;
  showDivider?: boolean;
};

export function SettingsMenuRow({
  icon,
  iconBg,
  iconColor,
  label,
  subtitle,
  type,
  value,
  onToggle,
  onPress,
  disabled,
  showDivider,
}: SettingsMenuRowProps) {
  return (
    <>
      <Pressable
        onPress={type === "navigate" ? onPress : undefined}
        disabled={disabled || type === "toggle"}
        className="flex-row items-center justify-between px-4 py-3.5"
        style={({ pressed }) => ({
          opacity: disabled ? 0.5 : pressed && type === "navigate" ? 0.88 : 1,
        })}
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-3 pr-3">
          <View
            className="h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: iconBg }}
          >
            <MaterialIcons name={icon} size={22} color={iconColor} />
          </View>
          <View className="min-w-0 flex-1">
            <Text
              className="text-[16px] text-[#1A1A1A]"
              style={{ fontFamily: ListifyFonts.medium }}
            >
              {label}
            </Text>
            {subtitle ? (
              <Text
                className="mt-0.5 text-[12px] text-[#9CA3AF]"
                style={{ fontFamily: ListifyFonts.regular }}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {type === "toggle" ? (
          <Switch
            value={value}
            onValueChange={onToggle}
            disabled={disabled}
            trackColor={{ false: "#E5E7EB", true: "#27BB97" }}
            thumbColor="#FFFFFF"
          />
        ) : (
          <MaterialIcons name="chevron-right" size={22} color="#C4C4C4" />
        )}
      </Pressable>
      {showDivider ? <View className="mx-4 h-px bg-[#F0F0F0]" /> : null}
    </>
  );
}
