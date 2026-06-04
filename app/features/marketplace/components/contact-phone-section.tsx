/**
 * ContactPhoneSection
 *
 * Reusable form section for the product posting screens.
 *
 * Business rules:
 *   Option A – Use account phone   → auto-verified, no OTP needed
 *   Option B – Use different number → Twilio Verify OTP required before publish
 *
 * Props:
 *   accountPhone   - Seller's verified account phone (E.164), e.g. "+919876543210"
 *   value          - Current E.164 contact phone value
 *   onChange       - Called when the contact phone changes (E.164 string)
 *   onVerified     - Called when the alternate number is verified
 *   disabled       - Lock the form (e.g. during submit)
 *
 * Usage in product form:
 *   <ContactPhoneSection
 *     accountPhone={user.phone}
 *     value={form.contactPhone}
 *     onChange={(phone) => setForm(f => ({ ...f, contactPhone: phone }))}
 *     onVerified={() => setContactVerified(true)}
 *   />
 */

import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { PhoneInputWithCountry } from "@/components/phone-input-with-country";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { useLocale } from "@/providers/locale-provider";
import {
  sendContactOtp,
  verifyContactOtp,
  getVerificationStatus,
} from "@/features/marketplace/services/marketplace-api";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

type ContactPhoneSectionProps = {
  /** Seller's E.164 account phone, e.g. "+919876543210" */
  accountPhone: string | null | undefined;
  /** Current E.164 contact phone for this listing */
  value: string;
  /** Called on every phone change with the new E.164 string */
  onChange: (phone: string, verified: boolean) => void;
  /** Disabled state (e.g. while form is submitting) */
  disabled?: boolean;
};

type Option = "account" | "custom";
type VerifyStep = "idle" | "otp_sent" | "verified";

export function ContactPhoneSection({
  accountPhone,
  value,
  onChange,
  disabled = false,
}: ContactPhoneSectionProps) {
  const { phoneCode: localePhoneCode, isoCountryCode: localeIso } = useLocale();
  const [option, setOption] = useState<Option>(
    // Pre-select "custom" if the incoming value differs from account phone
    value && accountPhone && value !== accountPhone ? "custom" : "account",
  );

  // Phone input state (custom number)
  const [phoneCode, setPhoneCode] = useState(localePhoneCode);
  const [isoCode, setIsoCode] = useState(localeIso);
  const [phoneDigits, setPhoneDigits] = useState("");

  // OTP verification state
  const [verifyStep, setVerifyStep] = useState<VerifyStep>("idle");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Derive the full E.164 for the custom input
  const customE164 = `${phoneCode}${phoneDigits.replace(/\D/g, "")}`;
  const isCustomE164Valid = /^\+[1-9]\d{6,14}$/.test(customE164);

  // When switching to "account" option — report account phone as verified
  useEffect(() => {
    if (option === "account" && accountPhone) {
      onChange(accountPhone, true);
    }
  }, [option, accountPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    // Sync defaults with locale/location until user starts typing.
    if (option === "custom" && !phoneDigits) {
      setPhoneCode(localePhoneCode);
      setIsoCode(localeIso);
    }
  }, [localeIso, localePhoneCode, option, phoneDigits]);

  // Check if the custom phone is already verified on mount / when it changes
  useEffect(() => {
    if (option !== "custom" || !isCustomE164Valid) return;
    let cancelled = false;
    getVerificationStatus(customE164)
      .then((res) => {
        if (cancelled) return;
        if (res.verified) {
          setVerifyStep("verified");
          onChange(customE164, true);
        } else {
          setVerifyStep("idle");
          onChange(customE164, false);
        }
      })
      .catch(() => {
        // Non-critical — allow user to proceed to send OTP
      });
    return () => {
      cancelled = true;
    };
  }, [customE164]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSendOtp = async () => {
    if (!isCustomE164Valid) {
      showErrorToast("Invalid Number", "Please enter a valid phone number with country code.");
      return;
    }
    setLoading(true);
    try {
      const res = await sendContactOtp(customE164, "sms");
      if (res.alreadyVerified) {
        setVerifyStep("verified");
        onChange(customE164, true);
        showSuccessToast("Verified", res.message);
        return;
      }
      setVerifyStep("otp_sent");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setResendCooldown(RESEND_COOLDOWN);
      onChange(customE164, false);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send OTP.";
      showErrorToast("OTP Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join("");
    if (otp.length !== OTP_LENGTH) {
      showErrorToast("Invalid OTP", `Please enter the ${OTP_LENGTH}-digit OTP.`);
      return;
    }
    setLoading(true);
    try {
      const res = await verifyContactOtp(customE164, otp);
      if (res.success) {
        setVerifyStep("verified");
        onChange(customE164, true);
        showSuccessToast("Verified", "Contact number verified successfully.");
      } else {
        showErrorToast("Invalid OTP", res.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed.";
      showErrorToast("OTP Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await sendContactOtp(customE164, "sms");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setResendCooldown(RESEND_COOLDOWN);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resend OTP.";
      showErrorToast("Resend Failed", message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigit = (val: string, idx: number) => {
    const ch = val.replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[idx] = ch;
      return next;
    });
    if (ch && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handleOtpKey = (key: string, idx: number) => {
    if (key === "Backspace" && !otpDigits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleChangeNumber = () => {
    setVerifyStep("idle");
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    onChange(customE164, false);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View className="w-full">
      {/* Section label */}
      <Text className="text-gray-800 font-semibold text-[15px] mb-3">
        Contact Number
      </Text>

      {/* Option A: Use account phone */}
      <Pressable
        onPress={() => !disabled && setOption("account")}
        className="flex-row items-center mb-3 gap-3"
        accessibilityRole="radio"
        accessibilityState={{ checked: option === "account" }}
      >
        <View
          className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
            option === "account" ? "border-black" : "border-gray-400"
          }`}
        >
          {option === "account" && (
            <View className="w-2.5 h-2.5 rounded-full bg-black" />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-gray-800 font-medium">
            Use my account number
          </Text>
          {accountPhone ? (
            <View className="flex-row items-center gap-1 mt-0.5">
              <Text className="text-gray-500 text-[13px]">{accountPhone}</Text>
              <MaterialIcons name="verified" size={14} color="#22c55e" />
            </View>
          ) : (
            <Text className="text-gray-400 text-[13px]">No phone on account</Text>
          )}
        </View>
      </Pressable>

      {/* Option B: Use a different number */}
      <Pressable
        onPress={() => !disabled && setOption("custom")}
        className="flex-row items-start mb-4 gap-3"
        accessibilityRole="radio"
        accessibilityState={{ checked: option === "custom" }}
      >
        <View
          className={`w-5 h-5 rounded-full border-2 items-center justify-center mt-0.5 ${
            option === "custom" ? "border-black" : "border-gray-400"
          }`}
        >
          {option === "custom" && (
            <View className="w-2.5 h-2.5 rounded-full bg-black" />
          )}
        </View>
        <Text className="text-gray-800 font-medium flex-1">
          Use a different number
        </Text>
      </Pressable>

      {/* Custom phone input (only shown when option B is selected) */}
      {option === "custom" && (
        <View className="pl-8">
          {/* ── Phone number input ─────────────────────────────────────── */}
          {verifyStep !== "otp_sent" && (
            <>
              <PhoneInputWithCountry
                phoneCode={phoneCode}
                phone={phoneDigits}
                isoCode={isoCode}
                onChangePhoneCode={(code, iso) => {
                  setPhoneCode(code);
                  setIsoCode(iso);
                  setVerifyStep("idle");
                }}
                onChangePhone={(digits) => {
                  setPhoneDigits(digits);
                  setVerifyStep("idle");
                }}
              />

              {/* Verified badge */}
              {verifyStep === "verified" && (
                <View className="flex-row items-center gap-1.5 mt-2">
                  <MaterialIcons name="check-circle" size={16} color="#22c55e" />
                  <Text className="text-green-600 text-[13px] font-medium">
                    Number verified
                  </Text>
                  <Pressable onPress={handleChangeNumber} className="ml-auto">
                    <Text className="text-gray-500 text-[13px] underline">
                      Change
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Send OTP button */}
              {verifyStep !== "verified" && (
                <Pressable
                  onPress={handleSendOtp}
                  disabled={loading || disabled || !isCustomE164Valid}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                  className={`mt-3 py-3 rounded-xl items-center ${
                    isCustomE164Valid && !loading ? "bg-black" : "bg-gray-300"
                  }`}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-semibold">
                      Send Verification OTP
                    </Text>
                  )}
                </Pressable>
              )}
            </>
          )}

          {/* ── OTP entry ──────────────────────────────────────────────── */}
          {verifyStep === "otp_sent" && (
            <View>
              <Text className="text-gray-600 text-[13px] mb-3">
                Enter the 6-digit OTP sent to{" "}
                <Text className="font-semibold">{customE164}</Text>
              </Text>

              {/* OTP boxes */}
              <View className="flex-row gap-2 mb-4">
                {otpDigits.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(r) => {
                      inputRefs.current[idx] = r;
                    }}
                    value={digit}
                    onChangeText={(v) => handleOtpDigit(v, idx)}
                    onKeyPress={({ nativeEvent }) => handleOtpKey(nativeEvent.key, idx)}
                    keyboardType="number-pad"
                    maxLength={1}
                    placeholder="-"
                    placeholderTextColor="#9CA3AF"
                    className="h-12 w-12 rounded-xl border border-gray-300 text-center text-gray-800 text-lg"
                  />
                ))}
              </View>

              {/* Verify button */}
              <Pressable
                onPress={handleVerifyOtp}
                disabled={loading || otpDigits.some((d) => !d)}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                className={`py-3 rounded-xl items-center mb-3 ${
                  otpDigits.every((d) => d) && !loading ? "bg-black" : "bg-gray-300"
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-semibold">Verify OTP</Text>
                )}
              </Pressable>

              {/* Resend + change number */}
              <View className="flex-row justify-between items-center">
                <Pressable
                  onPress={handleResend}
                  disabled={resendCooldown > 0 || loading}
                >
                  <Text
                    className={`text-[13px] font-medium ${
                      resendCooldown > 0 ? "text-gray-400" : "text-gray-800"
                    }`}
                  >
                    {resendCooldown > 0
                      ? `Resend in 00:${String(resendCooldown).padStart(2, "0")}`
                      : "Resend OTP"}
                  </Text>
                </Pressable>
                <Pressable onPress={handleChangeNumber}>
                  <Text className="text-[13px] text-gray-500 underline">
                    Change Number
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
