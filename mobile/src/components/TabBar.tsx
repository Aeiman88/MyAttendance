import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, Clock3, FilePenLine, Printer, UserRound } from "lucide-react-native";
import { Txt } from "./ui";
import { C } from "../theme";

const ITEMS = [
  { name: "history", label: "History", Icon: CalendarDays },
  { name: "requests", label: "Requests", Icon: FilePenLine },
  { name: "index", label: "Clock", Icon: Clock3, center: true },
  { name: "print", label: "Print", Icon: Printer },
  { name: "profile", label: "Profile", Icon: UserRound },
] as const;

/** Bottom navigation with the raised Clock button in the middle, like the UMS Go app. */
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const ev = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (current !== name && !ev.defaultPrevented) navigateToTab(route.key);
  };

  return (
    <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {ITEMS.map(({ name, label, Icon, ...rest }) => {
        const active = current === name;
        if ("center" in rest) {
          return (
            <View key={name} style={st.item}>
              <Pressable
                onPress={() => go(name)}
                accessibilityRole="tab"
                accessibilityLabel="Clock in or out"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [st.center, { backgroundColor: active ? C.navy800 : C.navy700 }, pressed && { transform: [{ scale: 0.95 }] }]}
              >
                <Icon size={28} color={C.white} strokeWidth={2.2} />
              </Pressable>
            </View>
          );
        }
        return (
          <Pressable key={name} onPress={() => go(name)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={st.item}>
            <Icon size={22} color={active ? C.navy800 : C.slate400} strokeWidth={active ? 2.4 : 2} />
            <Txt size={11} weight="semibold" color={active ? C.navy800 : C.slate400} style={{ marginTop: 3 }}>
              {label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.navy100, paddingTop: 8 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 52 },
  center: {
    width: 62,
    height: 62,
    borderRadius: 31,
    marginTop: -30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: C.mist,
    boxShadow: "0 10px 24px -8px rgba(16,42,94,0.65)",
  },
});
