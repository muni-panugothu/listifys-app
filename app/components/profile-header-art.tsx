import { Dimensions, View } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TEAL = "#1B4D4A";
const RED = "#E53935";
const GRAY = "#D1D5DB";

type ProfileHeaderArtProps = {
  height?: number;
};

/**
 * Abstract blob banner (teal / red / gray) with asymmetric white wave at the bottom.
 */
export function ProfileHeaderArt({ height = 248 }: ProfileHeaderArtProps) {
  return (
    <View style={{ height, width: SCREEN_WIDTH, backgroundColor: "#F5F5F5", overflow: "hidden" }}>
      {/* Teal blob — top left */}
      <View
        style={{
          position: "absolute",
          top: -40,
          left: -SCREEN_WIDTH * 0.15,
          width: SCREEN_WIDTH * 0.85,
          height: height * 0.75,
          backgroundColor: TEAL,
          borderRadius: height * 0.4,
          transform: [{ rotate: "-8deg" }],
        }}
      />
      {/* Red blob — center right */}
      <View
        style={{
          position: "absolute",
          top: height * 0.08,
          right: -SCREEN_WIDTH * 0.2,
          width: SCREEN_WIDTH * 0.7,
          height: height * 0.65,
          backgroundColor: RED,
          borderRadius: height * 0.35,
          transform: [{ rotate: "12deg" }],
        }}
      />
      {/* Gray blob — middle */}
      <View
        style={{
          position: "absolute",
          top: height * 0.22,
          left: SCREEN_WIDTH * 0.25,
          width: SCREEN_WIDTH * 0.55,
          height: height * 0.45,
          backgroundColor: GRAY,
          borderRadius: height * 0.3,
          transform: [{ rotate: "-4deg" }],
        }}
      />
      {/* White accent curve */}
      <View
        style={{
          position: "absolute",
          top: height * 0.12,
          right: SCREEN_WIDTH * 0.08,
          width: SCREEN_WIDTH * 0.35,
          height: height * 0.35,
          backgroundColor: "#FFFFFF",
          borderRadius: 999,
          opacity: 0.95,
        }}
      />

      {/* Wavy white foreground */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: height * 0.42,
          backgroundColor: "#FFFFFF",
          borderTopLeftRadius: 36,
          borderTopRightRadius: 56,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: height * 0.38,
          left: -SCREEN_WIDTH * 0.08,
          width: SCREEN_WIDTH * 0.45,
          height: 48,
          backgroundColor: "#FFFFFF",
          borderTopRightRadius: 80,
          borderTopLeftRadius: 20,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: height * 0.35,
          right: -SCREEN_WIDTH * 0.05,
          width: SCREEN_WIDTH * 0.5,
          height: 56,
          backgroundColor: "#FFFFFF",
          borderTopLeftRadius: 90,
          borderTopRightRadius: 24,
        }}
      />
    </View>
  );
}
