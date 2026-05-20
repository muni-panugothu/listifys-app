/**
 * LocationAutocompleteInput
 *
 * A text input that debounces the user's query, geocodes it using Expo Location,
 * and presents matching suggestions in a dropdown below the field.
 *
 * Props:
 *   value         – controlled text value
 *   onChangeText  – called on every keystroke
 *   onSelect      – called when user picks a suggestion; receives { label, lat, lng }
 *   placeholder   – input placeholder text
 *   contained     – when true, wraps the field in a card-style container
 */
import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { ListifyFonts } from "@/constants/typography";
import { geocodeQuerySuggestions } from "@/lib/location-service";

export type LocationSuggestion = {
  label: string;
  lat: number;
  lng: number;
  isoCountryCode: string | null;
};

type LocationAutocompleteInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (result: LocationSuggestion) => void | Promise<void>;
  placeholder?: string;
  /** Render inside a rounded card container with border. */
  contained?: boolean;
  inputProps?: Omit<TextInputProps, "value" | "onChangeText" | "placeholder">;
};

const DEBOUNCE_MS = 480;

export function LocationAutocompleteInput({
  value,
  onChangeText,
  onSelect,
  placeholder = "Search city or neighbourhood…",
  contained = false,
  inputProps,
}: LocationAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef<string>("");

  // Debounced geocode lookup
  const fetchSuggestions = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      latestQueryRef.current = query;
      setLoading(true);
      try {
        const results = await geocodeQuerySuggestions(query, 5);
        // Ignore stale results if query changed while we were awaiting
        if (latestQueryRef.current !== query) return;
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch {
        if (latestQueryRef.current === query) {
          setSuggestions([]);
          setShowDropdown(false);
        }
      } finally {
        if (latestQueryRef.current === query) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text);
      fetchSuggestions(text);
    },
    [onChangeText, fetchSuggestions],
  );

  const handleSelect = useCallback(
    async (suggestion: LocationSuggestion) => {
      setShowDropdown(false);
      setSuggestions([]);
      onChangeText(suggestion.label);
      await onSelect(suggestion);
    },
    [onChangeText, onSelect],
  );

  const inputRow = (
    <View
      className="flex-row items-center"
      style={{
        height: 48,
        borderRadius: contained ? 12 : 0,
        borderWidth: contained ? 1.5 : 0,
        borderColor: "#E5E7EB",
        backgroundColor: contained ? "#FAFAFA" : "transparent",
        paddingHorizontal: 12,
        gap: 8,
      }}
    >
      <MaterialIcons name="search" size={20} color="#9CA3AF" />
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        returnKeyType="search"
        autoCapitalize="words"
        autoCorrect={false}
        style={{
          flex: 1,
          fontSize: 14,
          color: "#111827",
          fontFamily: ListifyFonts.regular,
          paddingVertical: 0,
        }}
        {...inputProps}
      />
      {loading && <ActivityIndicator size="small" color="#27BB97" />}
      {!loading && value.length > 0 && (
        <Pressable
          onPress={() => {
            onChangeText("");
            setSuggestions([]);
            setShowDropdown(false);
          }}
          hitSlop={8}
        >
          <MaterialIcons name="close" size={18} color="#9CA3AF" />
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={{ position: "relative", zIndex: 10 }}>
      {inputRow}

      {showDropdown && suggestions.length > 0 && (
        <View
          style={{
            position: "absolute",
            top: 52,
            left: 0,
            right: 0,
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 6,
            zIndex: 100,
          }}
        >
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={`${suggestion.lat}-${suggestion.lng}-${index}`}
              onPress={() => void handleSelect(suggestion)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 10,
                backgroundColor: pressed ? "#F3F4F6" : "#FFFFFF",
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: "#F3F4F6",
              })}
            >
              <MaterialIcons name="location-on" size={16} color="#27BB97" />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "#111827",
                  fontFamily: ListifyFonts.regular,
                }}
              >
                {suggestion.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
