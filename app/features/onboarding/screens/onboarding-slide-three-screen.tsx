import React from 'react'
import { View, Text, Image, TouchableOpacity, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { type Href, useRouter } from '@/lib/safe-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { showErrorToast } from '@/lib/toast'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { clearError, googleLogin } from '@/store/slices/auth-slice'
import { completeOnboarding } from '@/store/slices/onboarding-slice'
import {
  GoogleSignInError,
  configureGoogleSignIn,
  signInWithGoogleNative,
} from '@/lib/google-sign-in'

// Import images directly
const bgImage = require('../../../assets/bg.png')
const googleIcon = require('../../../assets/google.jpg')
const mobileIcon = require('../../../assets/mobile.jpg')

const App = () => {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const dispatch = useAppDispatch()
  const { isAuthenticated, sessionHydrated, error } = useAppSelector((s) => s.auth)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const hasMountedRef = React.useRef(false)

  const markOnboardingComplete = async () => {
    try {
      await dispatch(completeOnboarding()).unwrap()
    } catch {
      // Ignore storage failures and continue navigation.
    }
  }

  const handleSkip = async () => {
    await markOnboardingComplete()
    router.replace('/(tabs)/home-feed-root' as Href)
  }

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    if (isAuthenticated && sessionHydrated) {
      router.replace('/(tabs)/home-feed-root' as Href)
    }
  }, [isAuthenticated, sessionHydrated])

  useEffect(() => {
    if (error) {
      showErrorToast('Google Sign In', error)
      dispatch(clearError())
    }
  }, [dispatch, error])

  useEffect(() => {
    void configureGoogleSignIn().catch(() => {})
  }, [])

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true)
      const idToken = await signInWithGoogleNative()
      await dispatch(googleLogin({ idToken })).unwrap()
    } catch (err) {
      if (err instanceof GoogleSignInError && err.cancelled) return
      showErrorToast(
        'Google Sign In',
        err instanceof GoogleSignInError
          ? err.message
          : err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : 'Google sign-in failed.',
      )
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <View className="flex-1 relative">
      <StatusBar style="light" />

      <TouchableOpacity
        className="absolute right-4 z-30 rounded-full bg-black/25 px-4 py-2"
        style={{ top: insets.top + 8 }}
        activeOpacity={0.8}
        onPress={() => {
          void handleSkip()
        }}
      >
        <Text className="font-semibold text-white">Skip</Text>
      </TouchableOpacity>

      {/* Background Image - Fixed with explicit width/height */}
      <Image
        source={bgImage}
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          resizeMode: 'cover'
        }}
      />

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'black']}
        className="absolute bottom-0 left-0 w-full h-[50%]"
      />

      {/* Bottom Buttons Container */}
      <View
        className="absolute bottom-0 left-0 right-0 w-full px-4 flex-col gap-3 z-20"
        style={{ paddingBottom: Math.max(insets.bottom + 10, 40) }}
      >

        {/* Google Button */}
        <TouchableOpacity
          className="bg-white px-6 py-3 rounded-full flex-row items-center justify-center gap-4"
          activeOpacity={0.8}
          onPress={handleGoogleSignIn}
          disabled={isGoogleLoading}
        >
          <Image
            source={googleIcon}
            style={{ 
              width: 32, 
              height: 32,
              borderRadius: 16,
              backgroundColor: 'white'
            }}
          />
          <Text className="font-semibold text-black">{isGoogleLoading ? 'Connecting...' : 'Continue with Google'}</Text>
        </TouchableOpacity>

        {/* Mobile Button */}
        <TouchableOpacity
          className="bg-white px-6 py-3 rounded-full flex-row items-center justify-center gap-4"
          activeOpacity={0.8}
          onPress={() => {
            void (async () => {
              await markOnboardingComplete()
              router.push('/mobile' as Href)
            })()
          }}
        >
          <Image
            source={mobileIcon}
            style={{ 
              width: 40, 
              height: 32,
              resizeMode: 'contain'
            }}
          />
          <Text className="font-semibold text-black">Continue with Mobile</Text>
        </TouchableOpacity>

        {/* Login Text */}
        <Text className="text-white text-center">
          Already have an account?{' '}
          <Text
            className="text-[14px] font-bold"
            onPress={() => {
              void (async () => {
                await markOnboardingComplete()
                router.push('/sign-in' as Href)
              })()
            }}
          >
            Login
          </Text>
        </Text>
      </View>
    </View>
  )
}

export { App as OnboardingSlideThreeScreen }
export default App