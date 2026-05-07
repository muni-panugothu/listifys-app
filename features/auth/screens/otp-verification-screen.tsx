import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const OTP_LENGTH = 4;
const INITIAL_TIMER = 59;

export function OtpVerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [otpDigits, setOtpDigits] = useState<string[]>(
    Array(OTP_LENGTH).fill(""),
  );
  const [secondsRemaining, setSecondsRemaining] = useState(INITIAL_TIMER);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const headerHeight = useMemo(() => insets.top + 64, [insets.top]);
  const isVerifyEnabled = otpDigits.every((digit) => digit.length === 1);
  const timerLabel = `00:${String(secondsRemaining).padStart(2, "0")}`;

  useEffect(() => {
    if (secondsRemaining === 0) {
      return;
    }

    const timer = setTimeout(() => {
      setSecondsRemaining((current) => current - 1);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [secondsRemaining]);

  const handleDigitChange = (value: string, index: number) => {
    const nextCharacter = value.replace(/\D/g, "").slice(-1);

    setOtpDigits((current) => {
      const nextDigits = [...current];
      nextDigits[index] = nextCharacter;
      return nextDigits;
    });

    if (nextCharacter && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    setSecondsRemaining(INITIAL_TIMER);
    inputRefs.current[0]?.focus();
  };

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      <View className="absolute inset-0 overflow-hidden">
        <View className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#27BB97]/5" />
        <View className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#5BA2FF]/5" />
      </View>

      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/80 px-4 shadow-sm"
        style={{ paddingTop: insets.top, height: headerHeight }}
      >
        <Pressable
          onPress={() => {
            router.back();
          }}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          className="-ml-2 h-10 w-10 items-center justify-center rounded-full"
        >
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </Pressable>

        <View
          className="absolute inset-x-0 items-center"
          style={{ top: insets.top + 18 }}
        >
          <Text className="text-xl font-black tracking-tight text-[#27BB97]">
            Listify
          </Text>
        </View>

        <View className="h-10 w-10" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: headerHeight + 24,
            paddingBottom: Math.max(insets.bottom + 48, 64),
            paddingHorizontal: 16,
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          <View className="mx-auto w-full max-w-md items-center">
            <View className="relative mb-6">
              <View
                className="absolute inset-0 rounded-full bg-[#27BB97]/10 blur-2xl"
                style={{ transform: [{ scale: 1.5 }] }}
              />
              <View className="h-24 w-24 items-center justify-center rounded-full border border-slate-100 bg-white shadow-sm">
                <MaterialIcons name="shield" size={48} color="#27BB97" />
              </View>
            </View>

            <View className="mb-6 items-center">
              <Text className="mb-2 text-center text-[24px] font-bold tracking-[-0.48px] text-[#161D1A]">
                Verification Code
              </Text>
              <Text className="text-center text-[14px] leading-5 text-[#6C7A74]">
                Enter the 4-digit code sent to
                <Text className="font-semibold text-[#161D1A]">
                  {" "}
                  +91 98765-XXXXX
                </Text>
              </Text>
            </View>

            <View className="mb-4 w-full flex-row justify-center gap-3">
              {otpDigits.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  value={digit}
                  onChangeText={(value) => {
                    handleDigitChange(value, index);
                  }}
                  onKeyPress={({ nativeEvent }) => {
                    handleKeyPress(nativeEvent.key, index);
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                  placeholder="•"
                  placeholderTextColor="#6C7A74"
                  style={styles.otpInput}
                />
              ))}
            </View>

            <View className="mb-6 flex-row items-center gap-1 text-[#6C7A74]">
              <MaterialIcons name="schedule" size={18} color="#6C7A74" />
              <Text className="text-[12px] font-medium tracking-[0.24px] text-[#6C7A74]">
                {timerLabel}
              </Text>
            </View>

            <Pressable
              disabled={!isVerifyEnabled}
              style={({ pressed }) => [
                {
                  transform: [{ scale: pressed && isVerifyEnabled ? 0.98 : 1 }],
                },
                { opacity: isVerifyEnabled ? 1 : 0.5 },
              ]}
              className="w-full overflow-hidden rounded-xl"
            >
              <LinearGradient
                colors={["#27BB97", "#1E9E7E"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                className="h-12 items-center justify-center rounded-xl"
                style={{
                  shadowColor: "rgba(39,187,151,0.2)",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 1,
                  shadowRadius: 18,
                  elevation: 6,
                }}
              >
                <Text className="text-[16px] font-semibold text-white">
                  Verify
                </Text>
              </LinearGradient>
            </Pressable>

            <View className="mt-6 items-center">
              <Text className="text-center text-[14px] text-[#6C7A74]">
                Didn&apos;t receive code?
                <Text
                  className="ml-1 font-semibold text-[#27BB97]"
                  onPress={handleResend}
                >
                  {" "}
                  Resend
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  otpInput: {
    width: 64,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#161D1A",
  },
});
