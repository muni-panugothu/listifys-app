import { View, Text } from "react-native";

import { ListifyFonts } from "@/constants/typography";

const STEP_LABELS = ["Category", "Details", "Publish"];

type SellStepIndicatorProps = {
  currentStep: 1 | 2 | 3;
};

/** Minimal step progress — matches profile/settings (no icon row). */
export function SellStepIndicator({ currentStep }: SellStepIndicatorProps) {
  const progressPct = (currentStep / 3) * 100;

  return (
    <View style={{ marginBottom: 20 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontFamily: ListifyFonts.medium,
            fontSize: 13,
            color: "#6B7280",
          }}
        >
          Step {currentStep} of 3
        </Text>
        <Text
          style={{
            fontFamily: ListifyFonts.semiBold,
            fontSize: 13,
            color: "#1A1A1A",
          }}
        >
          {STEP_LABELS[currentStep - 1]}
        </Text>
      </View>
      <View
        style={{
          height: 4,
          borderRadius: 999,
          backgroundColor: "#E5E7EB",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 4,
            width: `${progressPct}%`,
            borderRadius: 999,
            backgroundColor: "#1A1A1A",
          }}
        />
      </View>
    </View>
  );
}

/** Compact preview on sell entry (before step 1). */
export function SellStepPreview() {
  return (
    <View style={{ marginTop: 20, marginBottom: 4 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontFamily: ListifyFonts.medium,
            fontSize: 13,
            color: "#6B7280",
          }}
        >
          3 quick steps
        </Text>
        <Text
          style={{
            fontFamily: ListifyFonts.semiBold,
            fontSize: 13,
            color: "#1A1A1A",
          }}
        >
          Category → Details → Publish
        </Text>
      </View>
      <View
        style={{
          height: 4,
          borderRadius: 999,
          backgroundColor: "#E5E7EB",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 4,
            width: "12%",
            borderRadius: 999,
            backgroundColor: "#1A1A1A",
          }}
        />
      </View>
    </View>
  );
}
