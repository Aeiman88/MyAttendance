import { Image, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Txt } from "./ui";
import { C } from "../theme";

export function TopBar({ title, brand, right }: { title: string; brand?: boolean; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.bar, { paddingTop: insets.top }]}>
      <View style={st.side}>
        {brand && (
          <View style={st.brand}>
            <Image source={require("../../assets/icon.png")} style={{ width: 28, height: 28, borderRadius: 7 }} />
            <Txt size={13} weight="extrabold" color={C.navy800} style={{ letterSpacing: 0.4 }}>
              DAICOE
            </Txt>
          </View>
        )}
      </View>
      <Txt size={19} weight="bold" color={C.navy900}>
        {title}
      </Txt>
      <View style={[st.side, { alignItems: "flex-end" }]}>
        <View style={{ flexDirection: "row", gap: 2 }}>{right}</View>
      </View>
    </View>
  );
}

export function IconButton({
  label,
  onPress,
  children,
  badge,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => [st.icon, pressed && { backgroundColor: C.navy100 }]}>
      {children}
      {badge ? (
        <View style={st.badge}>
          <Txt size={10.5} weight="bold" color={C.navy950}>
            {badge}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, backgroundColor: C.mist, minHeight: 56 },
  side: { flex: 1, height: 56, justifyContent: "center" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", right: 2, top: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.gold500, alignItems: "center", justifyContent: "center" },
});
