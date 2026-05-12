import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "@/lib/safe-router";
import { useCallback, useMemo, useState } from "react";
import { BackHandler, Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATEGORIES, type CategorySlug } from "@/constants/categories";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { Image } from "@/lib/nativewind-interop";
import { useAppDispatch } from "@/store/hooks";
import { setCategory } from "@/store/slices/post-form-slice";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 10;
const HORIZONTAL_PADDING = 16;
const COLS = 3;
const CATEGORY_CARD_WIDTH =
	(SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GRID_GAP * (COLS - 1)) / COLS;
const IMAGE_SIZE = CATEGORY_CARD_WIDTH - 24;

// ── Category image map (real product images for OLX-style feel) ─────────────
const CATEGORY_IMAGES: Record<CategorySlug, string> = {
	electronics:
		"https://images.unsplash.com/photo-1498049794561-7780e7231661?w=200&h=200&fit=crop&q=80",
	jobs: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=200&h=200&fit=crop&q=80",
	vehicles:
		"https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=200&h=200&fit=crop&q=80",
	takecare:
		"https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=200&h=200&fit=crop&q=80",
	events:
		"https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200&h=200&fit=crop&q=80",
	properties:
		"https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200&h=200&fit=crop&q=80",
	forsale:
		"https://images.unsplash.com/photo-1607082349566-187342175e2f?w=200&h=200&fit=crop&q=80",
	mobiles:
		"https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&h=200&fit=crop&q=80",
	furniture:
		"https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&h=200&fit=crop&q=80",
	fashion:
		"https://images.unsplash.com/photo-1483985988355-763728e1935b?w=200&h=200&fit=crop&q=80",
	sports:
		"https://images.unsplash.com/photo-1461896836934-bd45ba48bf1d?w=200&h=200&fit=crop&q=80",
	collectibles:
		"https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=200&h=200&fit=crop&q=80",
	pets: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=200&fit=crop&q=80",
	books:
		"https://images.unsplash.com/photo-1512820790803-83ca734da794?w=200&h=200&fit=crop&q=80",
	beauty:
		"https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&h=200&fit=crop&q=80",
	others:
		"https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=200&h=200&fit=crop&q=80",
	toys: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=200&h=200&fit=crop&q=80",
};

type SellCategory = {
	slug: CategorySlug;
	title: string;
	image: string;
};

const categories: SellCategory[] = CATEGORIES.map((c) => ({
	slug: c.slug,
	title: c.name,
	image: CATEGORY_IMAGES[c.slug],
}));

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

export function SellEntryScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const dispatch = useAppDispatch();
	const handleBottomTabPress = useTabNavigation();
	const [selectedCategorySlug, setSelectedCategorySlug] =
		useState<CategorySlug | null>(null);

	const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
	const bottomNavPadding = Math.max(insets.bottom, 8);
	const selectedCategory = selectedCategorySlug
		? categories.find((category) => category.slug === selectedCategorySlug) ?? null
		: null;

	const openCategoryFlow = (slug: CategorySlug) => {
		setSelectedCategorySlug(slug);
		dispatch(setCategory(slug));
		router.push({
			pathname: "/post-ad-step1-category",
			params: { category: slug },
		});
	};

	useFocusEffect(
		useCallback(() => {
			const onHardwareBack = () => {
				handleBottomTabPress("home");
				return true;
			};

			const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
			return () => sub.remove();
		}, [handleBottomTabPress]),
	);

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
					onPress={() => handleBottomTabPress("home")}
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
						className="mb-8 flex-row flex-wrap"
						style={{ columnGap: GRID_GAP, rowGap: GRID_GAP }}
					>
						{categories.map((category) => {
							const isSelected = category.slug === selectedCategorySlug;

							return (
								<Pressable
									key={category.slug}
									onPress={() => openCategoryFlow(category.slug)}
									className="items-center overflow-hidden rounded-2xl bg-white"
									style={({ pressed }) => ({
										width: CATEGORY_CARD_WIDTH,
										borderWidth: isSelected ? 2 : 1,
										borderColor: isSelected ? "#27BB97" : "#F1F5F9",
										shadowColor: isSelected ? "#27BB97" : "#000",
										shadowOffset: { width: 0, height: 2 },
										shadowOpacity: isSelected ? 0.18 : 0.06,
										shadowRadius: isSelected ? 10 : 4,
										elevation: isSelected ? 5 : 1,
										transform: [{ scale: pressed ? 0.96 : 1 }],
									})}
								>
									<View
										className="w-full items-center justify-center overflow-hidden"
										style={{
											height: IMAGE_SIZE,
											backgroundColor: "#F8FAF9",
										}}
									>
										<Image
											source={category.image}
											contentFit="cover"
											transition={150}
											className="h-full w-full"
											style={{
												width: CATEGORY_CARD_WIDTH - (isSelected ? 4 : 2),
												height: IMAGE_SIZE,
												borderTopLeftRadius: 14,
												borderTopRightRadius: 14,
											}}
										/>
										{isSelected && (
											<View className="absolute right-1.5 top-1.5 h-5 w-5 items-center justify-center rounded-full bg-[#27BB97]">
												<MaterialIcons
													name="check"
													size={14}
													color="#FFF"
												/>
											</View>
										)}
									</View>
									<View
										className="w-full items-center px-1 py-2.5"
										style={{
											backgroundColor: isSelected
												? "rgba(39,187,151,0.06)"
												: "#FFF",
										}}
									>
										<Text
											numberOfLines={1}
											className="text-center text-[11px] font-semibold"
											style={{
												color: isSelected ? "#27BB97" : "#161D1A",
											}}
										>
											{category.title}
										</Text>
									</View>
								</Pressable>
							);
						})}
					</View>

					{/* Quick Tips */}
					<View className="mb-8 rounded-2xl bg-white p-4" style={{ borderWidth: 1, borderColor: "#F1F5F9" }}>
						<Text className="mb-3 text-[16px] font-bold text-[#161D1A]">
							Tips to sell faster
						</Text>
						{[
							{ icon: "photo-camera" as const, text: "Add clear, well-fit photos" },
							{ icon: "description" as const, text: "Write a detailed description" },
							{ icon: "local-offer" as const, text: "Set a competitive price" },
						].map((tip) => (
							<View key={tip.text} className="mb-2 flex-row items-center gap-3">
								<View className="h-8 w-8 items-center justify-center rounded-lg bg-[#EEF7F3]">
									<MaterialIcons name={tip.icon} size={16} color="#27BB97" />
								</View>
								<Text className="flex-1 text-[13px] text-[#3C4A44]">
									{tip.text}
								</Text>
							</View>
						))}
					</View>
				</View>
			</ScrollView>

			<View
				className="absolute inset-x-0 z-40 px-4"
				style={{ bottom: 86 + bottomNavPadding }}
			>
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
