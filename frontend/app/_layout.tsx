import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, LogBox, View } from "react-native";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { ToastProvider } from "@/src/components/Toast";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
SplashScreen.preventAutoHideAsync();

function useAppFonts() {
  return useFonts({
    "SpaceGrotesk-Regular": require("../assets/fonts/SpaceGrotesk_400Regular.ttf"),
    "SpaceGrotesk-Medium": require("../assets/fonts/SpaceGrotesk_500Medium.ttf"),
    "SpaceGrotesk-Bold": require("../assets/fonts/SpaceGrotesk_700Bold.ttf"),
    "Jakarta-Regular": require("../assets/fonts/PlusJakartaSans_400Regular.ttf"),
    "Jakarta-Medium": require("../assets/fonts/PlusJakartaSans_500Medium.ttf"),
    "Jakarta-SemiBold": require("../assets/fonts/PlusJakartaSans_600SemiBold.ttf"),
    "Jakarta-Bold": require("../assets/fonts/PlusJakartaSans_700Bold.ttf"),
  });
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    const atRoot = segments.length === 0 || segments[0] === "index";
    if (!user && !inAuth) {
      router.replace("/(auth)/login");
    } else if (user && (inAuth || atRoot)) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfaceSecondary } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="member/[id]" />
      <Stack.Screen name="events" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="admins" />
      <Stack.Screen name="approvals" />
      <Stack.Screen name="audit-logs" />
      <Stack.Screen name="change-password" options={{ presentation: "modal" }} />
      <Stack.Screen name="add-payment" options={{ presentation: "modal" }} />
      <Stack.Screen name="add-expense" options={{ presentation: "modal" }} />
      <Stack.Screen name="add-event" options={{ presentation: "modal" }} />
      <Stack.Screen name="add-member" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [iconsLoaded, iconError] = useIconFonts();
  const [fontsLoaded, fontError] = useAppFonts();
  const ready = (iconsLoaded || iconError) && (fontsLoaded || fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <AuthProvider>
            <ToastProvider>
              <RootNavigator />
            </ToastProvider>
          </AuthProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
