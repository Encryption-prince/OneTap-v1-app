import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { toastConfig } from '../src/components/ToastConfig';

// Parse a full OneTap URL and navigate to the view screen
function handleDeepLink(url) {
  if (!url) return;
  try {
    // Handles both:
    //   onetap://view?link=https%3A%2F%2Fone-tap-ten.vercel.app%2Fview%2F<id>%23key%3D...
    //   https://one-tap-ten.vercel.app/view/<id>#key=...&filename=...
    let targetUrl = url;

    // If it's our custom scheme, extract the nested link param
    if (url.startsWith('onetap://')) {
      const parsed = new URL(url.replace('onetap://', 'https://onetap.app/'));
      const nested = parsed.searchParams.get('link');
      if (nested) targetUrl = decodeURIComponent(nested);
    }

    // Now parse the actual vercel URL
    const parsed = new URL(targetUrl);
    const pathParts = parsed.pathname.split('/');
    const fileId = pathParts[pathParts.length - 1];
    const hash = parsed.hash.substring(1);
    const params = new URLSearchParams(hash);
    const key = params.get('key') || '';
    const filename = decodeURIComponent(params.get('filename') || 'file');

    if (fileId && key) {
      router.push({ pathname: '/view', params: { fileId, key, filename } });
    }
  } catch (e) {
    console.warn('Deep link parse error:', e.message);
  }
}

export default function RootLayout() {
  useEffect(() => {
    // Handle deep link when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Handle deep link that launched the app cold
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="view" options={{ headerShown: false }} />
      </Stack>
      <Toast config={toastConfig} />
    </SafeAreaProvider>
  );
}
