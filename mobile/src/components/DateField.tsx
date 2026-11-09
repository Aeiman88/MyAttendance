import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CalendarDays, Clock3 } from "lucide-react-native";
import { Txt } from "./ui";
import { C } from "../theme";
import { dmy, hm12 } from "../shared/time";

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (date: string) => new Date(`${date}T12:00:00`);
const fromDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTime = (hm: string) => {
  const [h, m] = (hm || "08:00").split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
const fromTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** A date ("YYYY-MM-DD") or time ("HH:MM") field using the phone's own picker. */
export function DateField({
  mode = "date",
  value,
  onChange,
  min,
  max,
  placeholder,
  accessibilityLabel,
}: {
  mode?: "date" | "time";
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const current = mode === "date" ? toDate(value || fromDate(new Date())) : toTime(value);
  const label = value ? (mode === "date" ? dmy(value) : hm12(value)) : placeholder ?? (mode === "date" ? "Pick a date" : "Pick a time");

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode,
        is24Hour: false,
        minimumDate: mode === "date" && min ? toDate(min) : undefined,
        maximumDate: mode === "date" && max ? toDate(max) : undefined,
        onValueChange: (_e, d) => d && onChange(mode === "date" ? fromDate(d) : fromTime(d)),
      });
    } else setIosOpen((o) => !o);
  };

  const Icon = mode === "date" ? CalendarDays : Clock3;
  return (
    <View>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={st.field}>
        <Txt size={15.5} color={value ? C.ink : C.slate400} tabular>
          {label}
        </Txt>
        <Icon size={18} color={C.navy600} />
      </Pressable>
      {Platform.OS === "ios" && iosOpen && (
        <DateTimePicker
          value={current}
          mode={mode}
          display={mode === "date" ? "inline" : "spinner"}
          minimumDate={mode === "date" && min ? toDate(min) : undefined}
          maximumDate={mode === "date" && max ? toDate(max) : undefined}
          onValueChange={(_e, d) => d && onChange(mode === "date" ? fromDate(d) : fromTime(d))}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  field: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.navy200,
    backgroundColor: C.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
