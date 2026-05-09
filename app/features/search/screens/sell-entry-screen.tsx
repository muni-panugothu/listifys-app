import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 12;
const HORIZONTAL_PADDING = 16;
const CATEGORY_CARD_WIDTH =
	(SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2;

type SellCategory = {
	id: string;
	title: string;
	icon: React.ComponentProps<typeof MaterialIcons>["name"];
};

const categories: SellCategory[] = [
	{
		id: "electronics",
		title: "Electronics",
		icon: "devices",
	},
	{
		id: "vehicles",
		title: "Vehicles",
		icon: "directions-car",
	},
	{
		id: "property",
		title: "Property",
		icon: "home-work",
	},
	{
		id: "fashion",
		title: "Fashion",
		icon: "checkroom",
	},
	{
		id: "home",
		title: "Home",
		icon: "chair",
	},
	{
		id: "jobs",
		title: "Jobs",
		icon: "work",
	},
];

const bottomTabs = [
	{ id: "home", label: "Home", icon: "home" as const },
	{ id: "search", label: "Search", icon: "search" as const },
	{
		id: "sell",
		label: "Sell",
		icon: "add-circle" as const,
		highlight: true,
		active: true,
	},
	{ id: "messages", label: "Messages", icon: "chat-bubble" as const },
	{ id: "profile", label: "Profile", icon: "person" as const },
];

const featureBannerImage =
	"https://lh3.googleusercontent.com/aida-public/AB6AXuBitXIseT__b9o7MK-VxwZYKCmFhF0W1GGHZSwnmo92SgG0FDmRBIw2LYPPRkbvVpATytd5KfgFqxTx8CXq3WoLXgB52EYa3sKHGVJ95STgFkYwOxwzrs8c93nz7tzT45gNk_SnExz2EPSnDNrhzh4d8bJnBjc7UkXG0PMoFcNdhCB3u4tao8C_gK2NpZK49RJOcMDPdlPC1jO60JHmr01Wyyr8YtnFjbkzvHaJaFo64tkRT7RGhHsQsXXJqxw7n1_CT9kSFZyYJ-w";

export function SellEntryScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [selectedCategoryId, setSelectedCategoryId] =
		useState<string>("electronics");

	const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
	const bottomNavPadding = Math.max(insets.bottom, 8);
	const selectedCategory =
		categories.find((category) => category.id === selectedCategoryId) ??
		categories[0];

	const openCategoryFlow = (categoryId: string) => {
		setSelectedCategoryId(categoryId);
		router.push({
			pathname: "/post-ad-step1-category",
			params: { category: categoryId },
		});
	};

	const handleBottomTabPress = (tabId: string) => {
		if (tabId === "home") {
			router.push("/home-feed-root");
			return;
		}

		if (tabId === "search") {
			router.push("/search-home");
			return;
		}

		if (tabId === "messages") {
			router.push("/messages-inbox");
			return;
		}

		if (tabId === "profile") {
			router.push("/dashboard-home");
			return;
		}
	};

	return (
		<View className="flex-1 bg-[#F4FBF6]">
			<View
				className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
				style={{
					paddingTop: insets.top,
					height: topBarHeight,
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 1 },
					shadowOpacity: 0.05,
					shadowRadius: 2,
					elevation: 2,
				}}
			>
				<Pressable
					onPress={() => router.back()}
					className="h-10 w-10 items-center justify-center rounded-full"
					style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
				>
					<MaterialIcons name="close" size={24} color="#0F172A" />
				</Pressable>

				<Text className="text-[20px] font-semibold tracking-tight text-[#0F172A]">
					Sell
				</Text>

				<View className="h-10 w-10" />
			</View>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingTop: topBarHeight + 24,
					paddingBottom: 196 + bottomNavPadding,
				}}
			>
				<View className="px-4">
					<View className="mb-8">
						<Text className="mb-2 text-[28px] font-bold tracking-tight text-[#161D1A]">
							What are you offering?
						</Text>
						<Text className="text-[16px] leading-6 text-[#6C7A74]">
							Choose a category to start listing your item for thousands of
							buyers.
						</Text>
					</View>

					<View
						className="mb-10 flex-row flex-wrap"
						style={{ columnGap: GRID_GAP, rowGap: GRID_GAP }}
					>
						{categories.map((category) => {
							const isSelected = category.id === selectedCategoryId;

							return (
								<Pressable
									key={category.id}
									onPress={() => openCategoryFlow(category.id)}
									className="items-center rounded-2xl bg-white px-4 py-5"
									style={({ pressed }) => ({
										width: CATEGORY_CARD_WIDTH,
										borderWidth: 1,
										borderColor: isSelected ? "#27BB97" : "#F1F5F9",
										shadowColor: isSelected ? "#27BB97" : "#000",
										shadowOffset: { width: 0, height: 2 },
										shadowOpacity: isSelected ? 0.16 : 0.05,
										shadowRadius: isSelected ? 10 : 4,
										elevation: isSelected ? 4 : 1,
										transform: [{ scale: pressed ? 0.97 : 1 }],
									})}
								>
									<View
										className="mb-3 h-12 w-12 items-center justify-center rounded-full"
										style={{
											backgroundColor: isSelected ? "#D7F8EF" : "#EEF7F3",
										}}
									>
										<MaterialIcons
											name={category.icon}
											size={24}
											color="#27BB97"
										/>
									</View>
									<Text className="text-center text-[13px] font-semibold text-[#161D1A]">
										{category.title}
									</Text>
								</Pressable>
							);
						})}
					</View>

					<View
						className="relative mb-10 h-48 overflow-hidden rounded-[24px] bg-[#004535] px-6 pb-6"
						style={{
							shadowColor: "#004535",
							shadowOffset: { width: 0, height: 8 },
							shadowOpacity: 0.18,
							shadowRadius: 16,
							elevation: 8,
						}}
					>
						<Image
							source={featureBannerImage}
							contentFit="cover"
							transition={200}
							className="absolute inset-0 h-full w-full"
						/>
						<LinearGradient
							colors={["rgba(0,69,53,0.12)", "rgba(0,69,53,0.86)"]}
							start={{ x: 0.5, y: 0.1 }}
							end={{ x: 0.5, y: 1 }}
							style={{
								position: "absolute",
								top: 0,
								right: 0,
								bottom: 0,
								left: 0,
							}}
						/>

						<View className="flex-1 justify-end">
							<Text className="mb-1 text-[22px] font-semibold tracking-tight text-white">
								Make money today
							</Text>
							<Text className="max-w-60 text-[14px] leading-5 text-[#DCEEE8]">
								Listing is free and takes less than a minute.
							</Text>
						</View>
					</View>
				</View>
			</ScrollView>

			<View
				className="absolute inset-x-0 z-40 px-4"
				style={{ bottom: 86 + bottomNavPadding }}
			>
				<Pressable
					onPress={() => openCategoryFlow(selectedCategory.id)}
					className="overflow-hidden rounded-2xl"
					style={({ pressed }) => ({
						transform: [{ scale: pressed ? 0.98 : 1 }],
					})}
				>
					<LinearGradient
						colors={["#27BB97", "#1E9E7E"]}
						start={{ x: 0, y: 0.5 }}
						end={{ x: 1, y: 0.5 }}
						style={{
							height: 56,
							alignItems: "center",
							justifyContent: "center",
							shadowColor: "#27BB97",
							shadowOffset: { width: 0, height: 8 },
							shadowOpacity: 0.22,
							shadowRadius: 14,
							elevation: 7,
						}}
					>
						<Text className="text-[18px] font-semibold tracking-tight text-white">
							Start Listing
						</Text>
					</LinearGradient>
				</Pressable>
			</View>

			<View
				className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-100 bg-white"
				style={{
					paddingTop: 12,
					paddingBottom: bottomNavPadding,
					shadowColor: "#000",
					shadowOffset: { width: 0, height: -4 },
					shadowOpacity: 0.05,
					shadowRadius: 12,
					elevation: 8,
				}}
			>
				<View className="flex-row items-end justify-around px-2">
					{bottomTabs.map((tab) => {
						if (tab.highlight) {
							return (
								<Pressable
									key={tab.id}
									onPress={() => handleBottomTabPress(tab.id)}
									className="items-center justify-center"
									style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
								>
									<View
										className="-mt-7 rounded-full border-4 border-[#F4FBF6] bg-[#27BB97] p-2.5"
										style={{
											shadowColor: "#27BB97",
											shadowOffset: { width: 0, height: 4 },
											shadowOpacity: 0.3,
											shadowRadius: 8,
											elevation: 6,
										}}
									>
										<MaterialIcons name={tab.icon} size={24} color="#FFFFFF" />
									</View>
									<Text className="mt-1 text-[11px] font-semibold tracking-wide text-[#27BB97]">
										{tab.label}
									</Text>
								</Pressable>
							);
						}

						return (
							<Pressable
								key={tab.id}
								onPress={() => handleBottomTabPress(tab.id)}
								className="items-center py-1"
								style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
							>
								<MaterialIcons
									name={tab.icon}
									size={24}
									color={tab.active ? "#27BB97" : "#94A3B8"}
								/>
								<Text
									className="text-[11px] font-medium tracking-wide"
									style={{ color: tab.active ? "#27BB97" : "#94A3B8" }}
								>
									{tab.label}
								</Text>
							</Pressable>
						);
					})}
				</View>
			</View>
		</View>
	);
}
