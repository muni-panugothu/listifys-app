/**
 * CallSellerButton
 *
 * Renders a "Call" button on the listing detail screen.
 *
 * On press:
 *   1. Calls POST /api/marketplace/call-click  →  saves analytics, returns tel: URL
 *   2. Opens the native phone dialer via Linking.openURL("tel:+919876543210")
 *
 * The buyer ALWAYS calls product.contactPhone (the seller's verified contact number),
 * NEVER user.accountPhone directly.
 *
 * Props:
 *   contactPhone   - E.164 phone (from listing.phone / listing.contactPhone)
 *   listingId      - MongoDB ObjectId string of the listing
 *   listingModel   - Mongoose model name: "ForSale" | "Vehicle" | ...
 *   sellerId       - MongoDB ObjectId string of the seller
 *   label          - Optional button label (default: "Call Seller")
 *   variant        - "full" (black button) | "icon" (icon-only circle)
 *   disabled       - Prevent press (e.g. own listing)
 *
 * Usage:
 *   <CallSellerButton
 *     contactPhone="+919876543210"
 *     listingId="64a..."
 *     listingModel="ForSale"
 *     sellerId="64b..."
 *   />
 */

import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import { showErrorToast } from "@/lib/toast";
import { recordCallClick } from "@/features/marketplace/services/marketplace-api";

type CallSellerButtonProps = {
  contactPhone: string;
  listingId: string;
  listingModel: string;
  sellerId: string;
  label?: string;
  variant?: "full" | "icon";
  disabled?: boolean;
};

export function CallSellerButton({
  contactPhone,
  listingId,
  listingModel,
  sellerId,
  label = "Call Seller",
  variant = "full",
  disabled = false,
}: CallSellerButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (!contactPhone) {
      showErrorToast("No Number", "Seller has not provided a contact number.");
      return;
    }

    setLoading(true);
    try {
      // Record the click event & get tel: URL from backend
      const { telUrl } = await recordCallClick({
        listingId,
        listingModel,
        sellerId,
        contactPhone,
        platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
        eventType: "call_click",
      });

      // Check device can make phone calls
      const canOpen = await Linking.canOpenURL(telUrl);
      if (!canOpen) {
        Alert.alert(
          "Cannot Make Call",
          "Your device does not support phone calls. Please dial manually:\n\n" + contactPhone,
        );
        return;
      }

      // Open the native dialer
      await Linking.openURL(telUrl);
    } catch (err: unknown) {
      // Even if analytics fail, still attempt the call with a direct tel: link
      const directTel = `tel:${contactPhone}`;
      try {
        await Linking.openURL(directTel);
      } catch {
        const message = err instanceof Error ? err.message : "Could not open phone dialer.";
        showErrorToast("Call Failed", message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Icon variant (circle button) ─────────────────────────────────────────────
  if (variant === "icon") {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityLabel={label}
        accessibilityRole="button"
        style={({ pressed }) => ({
          opacity: pressed || disabled ? 0.7 : 1,
        })}
        className="w-12 h-12 rounded-full bg-black items-center justify-center"
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <MaterialIcons name="call" size={22} color="#fff" />
        )}
      </Pressable>
    );
  }

  // ── Full variant (wide button) ────────────────────────────────────────────────
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => ({
        opacity: pressed || disabled ? 0.7 : 1,
      })}
      className="flex-row items-center justify-center gap-2 bg-black rounded-full px-6 py-3.5"
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          <MaterialIcons name="call" size={20} color="#fff" />
          <Text className="text-white font-semibold text-[15px]">{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ── WhatsApp variant ───────────────────────────────────────────────────────────

type WhatsAppButtonProps = Omit<CallSellerButtonProps, "label" | "variant"> & {
  label?: string;
};

export function WhatsAppSellerButton({
  contactPhone,
  listingId,
  listingModel,
  sellerId,
  label = "WhatsApp",
  disabled = false,
}: WhatsAppButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (!contactPhone) {
      showErrorToast("No Number", "Seller has not provided a contact number.");
      return;
    }
    setLoading(true);
    try {
      const { whatsappUrl } = await recordCallClick({
        listingId,
        listingModel,
        sellerId,
        contactPhone,
        platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
        eventType: "whatsapp_click",
      });

      const url = whatsappUrl ?? `https://wa.me/${contactPhone.replace("+", "")}`;
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert("WhatsApp not installed", "Please install WhatsApp to message the seller.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      // Fallback: open WhatsApp directly without analytics
      const fallback = `https://wa.me/${contactPhone.replace("+", "")}`;
      await Linking.openURL(fallback).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed || disabled ? 0.7 : 1 })}
      className="flex-row items-center justify-center gap-2 bg-green-500 rounded-full px-6 py-3.5"
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          <View className="w-5 h-5 items-center justify-center">
            <Text style={{ fontSize: 18 }}>💬</Text>
          </View>
          <Text className="text-white font-semibold text-[15px]">{label}</Text>
        </>
      )}
    </Pressable>
  );
}
