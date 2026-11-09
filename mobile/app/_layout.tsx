import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
// Import each weight on its own so only these five font files go into the app.
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { AuthProvider, useAuth } from "@/auth";
import { ToastProvider } from "@/components/toast";
import { C } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          {fontsLoaded ? <Navigator /> : null}
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** Which screens exist depends on the sign-in state; Expo Router moves to the right one. */
function Navigator() {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync().catch(() => {});
  }, [status]);
  if (status === "loading") return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.mist }, animation: "fade" }}>
      <Stack.Protected guard={status === "signed-in"}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={status === "signed-in" || status === "must-change-password"}>
        <Stack.Screen name="change-password" options={{ animation: "slide_from_right" }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "signed-out"}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={status === "signed-out" || status === "needs-server"}>
        <Stack.Screen name="server" options={{ animation: "slide_from_right" }} />
      </Stack.Protected>
    </Stack>
  );
}
