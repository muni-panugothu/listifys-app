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
import {
  GoogleSignInError,
  configureGoogleSignIn,
  signInWithGoogleNative,
} from '@/lib/google-sign-in'

const App = () => {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const dispatch = useAppDispatch()
  const { isAuthenticated, error } = useAppSelector((s) => s.auth)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

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
    void configureGoogleSignIn().catch(() => {})
  }, [])

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true)
      const idToken = await signInWithGoogleNative()
      await dispatch(googleLogin({ idToken })).unwrap()
    } catch (err) {
      if (err instanceof GoogleSignInError && err.cancelled) return
      Alert.alert(
        'Google Sign In',
        err instanceof GoogleSignInError ? err.message : 'Google sign-in failed.',
      )
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <View className="flex-1 relative">
      <StatusBar style="light" />

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
          onPress={() => router.push('/mobile' as Href)}
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
            className="text-[17px] font-bold"
            onPress={() => router.push('/sign-in' as Href)}
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