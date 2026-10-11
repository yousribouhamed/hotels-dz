import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../lib/theme';

/**
 * Google and Apple sign-in come back to the app on boumerdesstays://login-callback.
 * The sign-in screen already handles the result, so this just steps out of the way.
 */
export default function LoginCallback() {
  const { c } = useTheme();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return <View style={{ flex: 1, backgroundColor: c.canvas }} />;
}
