import { Pressable, StyleSheet, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Txt } from "./ui";
import { C } from "../theme";
import { currentMonth, monthLabel, shiftMonth } from "../shared/time";

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const atLatest = month >= currentMonth();
  return (
    <View style={st.box}>
      <Pressable onPress={() => onChange(shiftMonth(month, -1))} accessibilityRole="button" accessibilityLabel="Previous month" style={st.btn} hitSlop={6}>
        <ChevronLeft size={20} color={C.navy700} />
      </Pressable>
      <Txt size={15.5} weight="bold" color={C.navy900}>
        {monthLabel(month)}
      </Txt>
      <Pressable
        onPress={() => !atLatest && onChange(shiftMonth(month, 1))}
        disabled={atLatest}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: atLatest }}
        style={[st.btn, atLatest && { opacity: 0.3 }]}
        hitSlop={6}
      >
        <ChevronRight size={20} color={C.navy700} />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.navy100, padding: 6 },
  btn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
