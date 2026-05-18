import React from 'react'
import { View, Text, Image, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { type Href, useRouter } from '@/lib/safe-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Alert } from 'react-native'
import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { clearError, googleLogin } from '@/store/slices/auth-slice'
import { completeOnboarding } from '@/store/slices/onboarding-slice'

function isGoogleNativeModuleAvailable(): boolean {
  const proxy = (global as any).__turboModuleProxy
  if (proxy != null) {
    return proxy('RNGoogleSignin') != null
  }
  try {
    const { NativeModules } = require('react-native')
    return NativeModules.RNGoogleSignin != null
  } catch {
    return false
  }
}

let _googleModule: any = null
let _googleChecked = false

function getGoogleSigninModule() {
  if (_googleChecked) return _googleModule
  _googleChecked = true

  if (!isGoogleNativeModuleAvailable()) {
    _googleModule = null
    return null
  }

  try {
    _googleModule = require('@react-native-google-signin/google-signin')
  } catch {
    _googleModule = null
  }
  return _googleModule
}

const App = () => {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const dispatch = useAppDispatch()
  const { isAuthenticated, error } = useAppSelector((s) => s.auth)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const markOnboardingComplete = async () => {
    try {
      await dispatch(completeOnboarding()).unwrap()
    } catch {
      // Ignore storage failures and continue navigation.
    }
  }

  const handleSkip = async () => {
    await markOnboardingComplete()
    router.replace('/home-feed-root' as Href)
  }

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/home-feed-root' as Href)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (error) {
      Alert.alert('Google Sign In', error)
      dispatch(clearError())
    }
  }, [error])

  useEffect(() => {
    const googleModule = getGoogleSigninModule()
    if (!googleModule) {
      return
    }

    googleModule.GoogleSignin.configure({
      webClientId: '335766515911-5corrme09mfaplitd0r9ra9k7m2nr76i.apps.googleusercontent.com',
      offlineAccess: false,
    })
  }, [])

  const handleGoogleSignIn = async () => {
    const googleModule = getGoogleSigninModule()
    if (!googleModule) {
      Alert.alert(
        'Google Sign In',
        'Native Google Sign-In module is missing in this build. Rebuild and reinstall the Android app.',
      )
      return
    }

    const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = googleModule

    try {
      setIsGoogleLoading(true)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      try { await GoogleSignin.signOut() } catch (_) {}

      const response = await GoogleSignin.signIn()
      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken
        if (idToken) {
          await markOnboardingComplete()
          dispatch(googleLogin({ idToken }))
        } else {
          Alert.alert('Google Sign In', 'Failed to get authentication token.')
        }
      }
    } catch (err: any) {
      if (isErrorWithCode(err)) {
        switch (err.code) {
          case statusCodes.IN_PROGRESS:
            break
          case statusCodes.SIGN_IN_CANCELLED:
            break
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert('Google Sign In', 'Google Play Services not available.')
            break
          default:
            Alert.alert('Google Sign In', err?.message || 'Something went wrong.')
        }
      } else {
        Alert.alert('Google Sign In', err?.message || 'Failed to connect.')
      }
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

      {/* Background Image */}
      <Image
        source={require('../../../assets/bg.png')}
        className="absolute w-full h-full"
        style={{ resizeMode: 'cover' }}
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
             source={require('../../../assets/google.webp')}
            className="w-8 h-8 bg-white rounded-full"
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
            source={require('../../../assets/mobile.png')}
            className="w-10 h-8 bg-white rounded-full"
            style={{ resizeMode: 'contain' }}
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