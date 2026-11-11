import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '@/src/store/useAppStore';
import { colors } from '@/src/theme';

export default function RootLayout() {
  const initialize = useAppStore((s) => s.initialize);
  useEffect(() => { initialize(); }, [initialize]);
  return <><StatusBar style="dark"/><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}><Stack.Screen name="welcome"/><Stack.Screen name="activation"/><Stack.Screen name="(tabs)"/><Stack.Screen name="entry" options={{ presentation:'modal' }}/><Stack.Screen name="exit" options={{ presentation:'modal' }}/><Stack.Screen name="receipt/[id]" options={{ presentation:'modal' }}/><Stack.Screen name="watchlist"/><Stack.Screen name="settings"/><Stack.Screen name="settings/admin" options={{ presentation:'modal' }}/><Stack.Screen name="admin" options={{ presentation:'modal' }}/></Stack></>;
}
