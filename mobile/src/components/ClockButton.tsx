import { useEffect, useRef } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Check, LogIn, LogOut, MapPinOff } from "lucide-react-native";
import { Txt } from "./ui";
import { C } from "../theme";

export type ClockMode = "loading" | "locating" | "nolocation" | "blocked" | "ready" | "done";
export type ClockTone = "internal" | "external" | "neutral" | "blocked";

const TONE: Record<ClockTone, string> = {
  internal: C.teal500,
  external: C.gold500,
  neutral: C.navy200,
  blocked: C.danger600,
};

/**
 * The big round button. Its ring shows the zone (teal inside, gold outside) before clocking in,
 * and how much of the working day has passed after clocking in.
 */
export function ClockButton({
  mode,
  action,
  tone,
  progress,
  busy,
  sub,
  onPress,
}: {
  mode: ClockMode;
  action: "in" | "out" | null;
  tone: ClockTone;
  progress: number;
  busy: boolean;
  sub?: string;
  onPress: () => void;
}) {
  const size = 200;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = TONE[tone];
  const disabled = busy || mode === "loading" || mode === "locating" || mode === "blocked" || mode === "done";
  const label = mode === "done" ? "Completed" : action === "out" ? "Clock out" : "Clock in";
  const Icon = mode === "done" ? Check : mode === "nolocation" || mode === "blocked" ? MapPinOff : action === "out" ? LogOut : LogIn;

  // A slow breathing ring invites the first tap of the day.
  const breathe = useRef(new Animated.Value(0)).current;
  const breathing = mode === "ready" && action === "in" && !busy;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce || !breathing) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
      breathe.setValue(0);
    };
  }, [breathing, breathe]);

  return (
    <View style={st.wrap}>
      <View style={st.halo} />
      {breathing && (
        <Animated.View
          pointerEvents="none"
          style={[
            st.breathe,
            {
              borderColor: color,
              opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] }),
              transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }],
            },
          ]}
        />
      )}
      <Svg width={size} height={size} style={st.ring}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#d3ddef" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c * Math.max(progress, 0.0001)} ${c}`}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={sub ? `${label}. ${sub}` : label}
        accessibilityState={{ disabled, busy }}
        style={({ pressed }) => [st.button, mode === "done" && { backgroundColor: C.navy700 }, pressed && !disabled && { transform: [{ scale: 0.97 }] }]}
      >
        {busy ? <ActivityIndicator size="large" color={C.white} /> : <Icon size={40} color={C.white} strokeWidth={2} />}
        <Txt size={21} weight="bold" color={C.white} style={{ marginTop: 6 }}>
          {busy ? "Saving…" : label}
        </Txt>
        {sub && !busy ? (
          <View style={[st.sub, tone === "external" ? { backgroundColor: C.gold500 } : tone === "blocked" ? { backgroundColor: C.danger600 } : null]}>
            <Txt size={11.5} weight="semibold" color={tone === "external" ? C.navy950 : C.white}>
              {sub}
            </Txt>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { width: 232, height: 232, alignItems: "center", justifyContent: "center" },
  halo: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 116,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: C.navy100,
    boxShadow: "0 8px 30px -12px rgba(6,18,46,0.35)",
  },
  breathe: { position: "absolute", width: 212, height: 212, borderRadius: 106, borderWidth: 7 },
  ring: { position: "absolute" },
  button: {
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: C.navy800,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 -10px 24px rgba(6,18,46,0.35), 0 14px 30px -12px rgba(6,18,46,0.6)",
  },
  sub: { marginTop: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, backgroundColor: "rgba(255,255,255,0.15)" },
});
