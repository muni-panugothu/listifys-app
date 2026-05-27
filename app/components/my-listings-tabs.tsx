import { Pressable, Text, View } from "react-native";

import { ListifyFonts } from "@/constants/typography";

const TABS = ["Active", "Expired", "Drafts"] as const;

export type MyListingsTab = (typeof TABS)[number];

type MyListingsTabsProps = {
  activeTab: MyListingsTab;
  onTabPress: (tab: MyListingsTab) => void;
};

export function MyListingsTabs({ activeTab, onTabPress }: MyListingsTabsProps) {
  return (
    <View className="mb-5 flex-row rounded-2xl bg-white p-1">
      {TABS.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <Pressable
            key={tab}
            onPress={() => onTabPress(tab)}
            className="flex-1 items-center rounded-xl py-2.5"
            style={{
              backgroundColor: isActive ? "#27BB97" : "transparent",
            }}
          >
            <Text
              className="text-[13px]"
              style={{
                fontFamily: isActive ? ListifyFonts.semiBold : ListifyFonts.medium,
                color: isActive ? "#FFFFFF" : "#6B7280",
              }}
            >
              {tab}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
