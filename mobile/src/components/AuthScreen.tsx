import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";
import { Txt } from "./ui";
import { C } from "../theme";

/** Navy brand panel with a quiet clock-dial motif, then the form on a light card. */
export function AuthScreen({ title, intro, children, footer }: { title: string; intro?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.navy800 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[st.brand, { paddingTop: insets.top + 28 }]}>
          <Dial />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Image source={require("../../assets/icon.png")} style={st.logo} />
            <View>
              <Txt size={18} weight="extrabold" color={C.white}>
                MyAttendance
              </Txt>
              <Txt size={13} color={C.navy200}>
                DAICOE AI Center, Kota Kinabalu High School
              </Txt>
            </View>
          </View>
        </View>
        <View style={[st.body, { paddingBottom: insets.bottom + 24 }]}>
          <Txt size={24} weight="bold" color={C.navy900}>
            {title}
          </Txt>
          {intro ? (
            <Txt size={14.5} color={C.slate600} style={{ marginTop: 6 }}>
              {intro}
            </Txt>
          ) : null}
          <View style={{ marginTop: 22, gap: 16 }}>{children}</View>
          {footer ? <View style={{ marginTop: "auto", paddingTop: 28 }}>{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Dial() {
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  return (
    <Svg width={380} height={380} viewBox="0 0 400 400" style={st.dial} pointerEvents="none">
      <Circle cx={200} cy={200} r={190} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={2} />
      <Circle
        cx={200}
        cy={200}
        r={150}
        fill="none"
        stroke="rgba(18,168,162,0.35)"
        strokeWidth={10}
        strokeDasharray="590 943"
        strokeLinecap="round"
        rotation={-90}
        originX={200}
        originY={200}
      />
      {ticks.map((i) => (
        <Line
          key={i}
          x1={200}
          y1={i % 5 === 0 ? 18 : 26}
          x2={200}
          y2={36}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={i % 5 === 0 ? 4 : 2}
          rotation={i * 6}
          originX={200}
          originY={200}
        />
      ))}
    </Svg>
  );
}

const st = StyleSheet.create({
  brand: { paddingHorizontal: 24, paddingBottom: 56, overflow: "hidden" },
  dial: { position: "absolute", right: -110, top: -100 },
  logo: { width: 46, height: 46, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.15)" },
  body: { flex: 1, marginTop: -28, backgroundColor: C.mist, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 28 },
});
