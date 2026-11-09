import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleAlert, CircleCheck, Info } from "lucide-react-native";
import { Txt } from "./ui";
import { C, shadow } from "../theme";

type Tone = "success" | "error" | "info";
const Ctx = createContext<(message: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setToast(null));
  }, [fade]);

  const show = useCallback(
    (message: string, tone: Tone = "success") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, tone === "error" ? 6000 : 3500);
    },
    [fade, hide],
  );

  const Icon = toast?.tone === "error" ? CircleAlert : toast?.tone === "info" ? Info : CircleCheck;
  const bg = toast?.tone === "error" ? C.danger600 : toast?.tone === "info" ? C.white : C.navy900;
  const fg = toast?.tone === "info" ? C.ink : C.white;

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            st.wrap,
            { top: insets.top + 8, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
          ]}
        >
          <Pressable onPress={hide} accessibilityRole="alert" style={[st.toast, { backgroundColor: bg }]}>
            <Icon size={18} color={toast.tone === "success" ? C.teal300 : fg} />
            <View style={{ flex: 1 }}>
              <Txt size={14} weight="medium" color={fg}>
                {toast.message}
              </Txt>
            </View>
          </Pressable>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

const st = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 100 },
  toast: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13, boxShadow: shadow.raised },
});
