import { type Href, useRouter } from "@/lib/safe-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhoneInputWithCountry } from "@/components/phone-input-with-country";
import { showErrorToast } from "@/lib/toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearError, sendPhoneOtp, verifyPhoneOtp } from "@/store/slices/auth-slice";

const OTP_LENGTH = 6;
const INITIAL_RESEND_SECONDS = 30;

export function MobileAuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { status, error, isAuthenticated } = useAppSelector((s) => s.auth);
  // Global phone input state
  const [phoneCode, setPhoneCode] = useState("+91");
  const [isoCode, setIsoCode] = useState("IN");
  const [phoneDigits, setPhoneDigits] = useState("");
  // Full E.164 derived from code + digits
  const e164Phone = `${phoneCode}${phoneDigits.replace(/\D/g, "")}`;

  const [requestedPhone, setRequestedPhone] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(
    Array(OTP_LENGTH).fill(""),
  );
  const [secondsRemaining, setSecondsRemaining] = useState(INITIAL_RESEND_SECONDS);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const contentPaddingBottom = useMemo(
    () => Math.max(insets.bottom + 24, 24),
    [insets.bottom],
  );
  const isLoading = status === "loading";
  const isOtpStep = requestedPhone != null;
  const isVerifyEnabled = otpDigits.every((digit) => digit.length === 1);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(tabs)/home-feed-root" as Href);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (error) {
      showErrorToast("Mobile Verification", error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  useEffect(() => {
    if (!isOtpStep || secondsRemaining <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setSecondsRemaining((current) => current - 1);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [isOtpStep, secondsRemaining]);

  const handleSendOtp = async () => {
    if (!/^\+[1-9]\d{6,14}$/.test(e164Phone)) {
      showErrorToast("Invalid Phone", "Please enter a valid phone number with country code.");
      return;
    }

    const phone = e164Phone;

    try {
      await dispatch(sendPhoneOtp({ phone, channel: "sms" })).unwrap();
      setRequestedPhone(phone);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setSecondsRemaining(INITIAL_RESEND_SECONDS);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch {
      // Error is shown via auth slice error state.
    }
  };

  const handleResendOtp = async () => {
    if (!requestedPhone || secondsRemaining > 0) {
      return;
    }

    try {
      await dispatch(sendPhoneOtp({ phone: requestedPhone, channel: "sms" })).unwrap();
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setSecondsRemaining(INITIAL_RESEND_SECONDS);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch {
      // Error is shown via auth slice error state.
    }
  };

  const handleVerifyOtp = () => {
    if (!requestedPhone) {
      showErrorToast("Session Expired", "Please request OTP again.");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      return;
    }

    if (!isVerifyEnabled) {
      showErrorToast("Invalid OTP", "Please enter the 6-digit OTP.");
      return;
    }

    dispatch(verifyPhoneOtp({ phone: requestedPhone, otp: otpDigits.join("") }));
  };

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

  const timerLabel = `00:${String(secondsRemaining).padStart(2, "0")}`;

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingBottom: contentPaddingBottom,
            paddingHorizontal: 16,
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          <View className="w-full self-center" style={{ maxWidth: 430 }}>
            <View className="w-full items-center">
              <Text className="text-gray-800 text-[30px] font-extrabold mb-2">
                Continue with Mobile
              </Text>
              <Text className="text-gray-500 text-center mb-5">
                {isOtpStep
                  ? "Enter the OTP sent to your mobile number"
                  : "Enter your mobile number to receive OTP"}
              </Text>

              {!isOtpStep ? (
                <View className="w-full flex flex-col gap-3">
                  {/* Global phone input with country picker */}
                  <PhoneInputWithCountry
                    phoneCode={phoneCode}
                    phone={phoneDigits}
                    isoCode={isoCode}
                    onChangePhoneCode={(code, iso) => {
                      setPhoneCode(code);
                      setIsoCode(iso);
                    }}
                    onChangePhone={(digits) => setPhoneDigits(digits)}
                  />

                  <Pressable
                    onPress={handleSendOtp}
                    disabled={isLoading}
                    style={({ pressed }) => [{ opacity: pressed || isLoading ? 0.75 : 1 }]}
                    className="w-full bg-black px-4 py-3 rounded-full items-center"
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text className="text-white font-semibold">Send OTP</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View className="w-full">
                  <View className="w-full flex-row justify-between gap-2 mb-4">
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
                        placeholder="-"
                        placeholderTextColor="#9CA3AF"
                        className="h-12 w-12 rounded-xl border border-gray-300 text-center text-gray-800"
                      />
                    ))}
                  </View>

                  <Pressable
                    onPress={handleVerifyOtp}
                    disabled={isLoading || !isVerifyEnabled}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.9 : 1 },
                      { opacity: isLoading || !isVerifyEnabled ? 0.7 : 1 },
                    ]}
                    className="bg-black text-white px-5 py-3 rounded-full w-full items-center"
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text className="text-white text-center font-semibold">
                        Verify OTP
                      </Text>
                    )}
                  </Pressable>

                  <View className="mt-4 items-center gap-3">
                    <Text className="text-gray-500">Resend OTP in {timerLabel}</Text>
                    <Pressable
                      onPress={handleResendOtp}
                      disabled={secondsRemaining > 0 || isLoading}
                    >
                      <Text
                        className={`font-semibold ${
                          secondsRemaining > 0 || isLoading
                            ? "text-gray-400"
                            : "text-gray-800"
                        }`}
                      >
                        Resend OTP
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setRequestedPhone(null);
                        setPhoneDigits("");
                        setOtpDigits(Array(OTP_LENGTH).fill(""));
                      }}
                    >
                      <Text className="font-semibold text-gray-700">Change Number</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            <Text className="text-gray-500 text-center mt-5">
              Prefer password login?{" "}
              <Text
                className="text-[14px] font-bold text-gray-800"
                onPress={() => {
                  router.push("/sign-in" as Href);
                }}
              >
                Back to Login
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
