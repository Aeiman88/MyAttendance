import { cloneElement, forwardRef, isValidElement, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { C, F, shadow } from "../theme";
import type { DayFlag, DayStatus } from "../shared/rules";

type Weight = keyof typeof F;

export function Txt({
  size = 15,
  weight = "regular",
  color = C.ink,
  align,
  tabular,
  style,
  ...rest
}: TextProps & { size?: number; weight?: Weight; color?: string; align?: TextStyle["textAlign"]; tabular?: boolean }) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: F[weight], fontSize: size, color, lineHeight: Math.round(size * 1.38), textAlign: align },
        tabular && { fontVariant: ["tabular-nums"] },
        style,
      ]}
    />
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "teal";

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading,
  disabled,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const bg = { primary: C.navy800, teal: C.teal600, secondary: C.white, ghost: "transparent", danger: C.danger600 }[variant];
  const fg = variant === "secondary" || variant === "ghost" ? C.navy800 : C.white;
  const height = size === "sm" ? 38 : size === "lg" ? 54 : 46;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bg, height, paddingHorizontal: size === "sm" ? 12 : 18 },
        variant === "secondary" && { borderWidth: 1, borderColor: C.navy200 },
        pressed && !off && { opacity: 0.86, transform: [{ scale: 0.985 }] },
        off && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon}
      <Txt size={size === "sm" ? 14 : size === "lg" ? 16.5 : 15.5} weight="semibold" color={fg}>
        {title}
      </Txt>
    </Pressable>
  );
}

type Labelable = { accessibilityLabel?: string; onChangeText?: unknown };

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  // A text box inside a Field gets the Field's label, so screen readers (TalkBack, VoiceOver) announce it.
  const input =
    isValidElement<Labelable>(children) && children.props.onChangeText && children.props.accessibilityLabel == null
      ? cloneElement(children, { accessibilityLabel: label })
      : children;
  return (
    <View style={{ gap: 6 }}>
      <Txt size={13.5} weight="semibold" color={C.navy900}>
        {label}
      </Txt>
      {input}
      {error ? (
        <Txt size={13} color={C.danger600}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt size={12.5} color={C.slate500}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export const Input = forwardRef<React.ComponentRef<typeof TextInput>, TextInputProps & { multiline?: boolean }>(function Input({ style, multiline, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={C.slate400}
      multiline={multiline}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      style={[
        s.input,
        multiline && { minHeight: 96, paddingTop: 12, textAlignVertical: "top" },
        focused && { borderColor: C.iris500, boxShadow: `0 0 0 3px ${C.iris100}` },
        style,
      ]}
    />
  );
});

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

const STATUS_STYLE: Record<DayStatus, [string, string]> = {
  present: [C.teal50, C.teal700],
  working: [C.iris50, C.iris700],
  incomplete: [C.gold50, C.gold700],
  absent: [C.danger50, C.danger700],
  leave: [C.navy50, C.navy700],
  holiday: [C.navy50, C.navy700],
  off: ["#f8fafc", C.slate500],
  pending: ["#f8fafc", C.slate600],
  upcoming: ["#f8fafc", C.slate400],
  untracked: ["#f8fafc", C.slate400],
};

export function StatusChip({ status, label }: { status: DayStatus; label: string }) {
  const [bg, fg] = STATUS_STYLE[status];
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Txt size={12} weight="semibold" color={fg}>
        {label}
      </Txt>
    </View>
  );
}

const FLAG: Record<DayFlag, [string, string, string]> = {
  late: [C.gold100, C.gold700, "Late"],
  early: [C.gold100, C.gold700, "Left early"],
  external: [C.iris100, C.iris700, "External"],
  corrected: [C.navy100, C.navy700, "Corrected"],
  manual: [C.navy100, C.navy700, "Added by admin"],
};

export function FlagChip({ flag, detail }: { flag: DayFlag; detail?: string }) {
  const [bg, fg, label] = FLAG[flag];
  return (
    <View style={[s.flag, { backgroundColor: bg }]}>
      <Txt size={11.5} weight="semibold" color={fg}>
        {label}
        {detail ? ` ${detail}` : ""}
      </Txt>
    </View>
  );
}

export function Avatar({ name, size = 44, dark }: { name: string; size?: number; dark?: boolean }) {
  const initials = name
    .replace(/\b(bin|binti|bte|bt|a\/l|a\/p)\b/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: dark ? "rgba(255,255,255,0.12)" : C.navy100,
      }}
    >
      <Txt size={size * 0.36} weight="bold" color={dark ? C.white : C.navy800}>
        {initials || "?"}
      </Txt>
    </View>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 8 }}>
      <View style={s.emptyIcon}>{icon}</View>
      <Txt size={15.5} weight="semibold" color={C.navy900} style={{ marginTop: 4 }}>
        {title}
      </Txt>
      {children ? (
        <Txt size={13.5} color={C.slate500} align="center">
          {children}
        </Txt>
      ) : null}
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <View style={s.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[s.segment, on && { backgroundColor: C.white, boxShadow: shadow.card }]}
          >
            <Txt size={13} weight="semibold" color={on ? C.navy900 : C.navy600} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet. Content scrolls if it is taller than the screen. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={s.grabber} />
          <View style={s.sheetHead}>
            <Txt size={18} weight="bold" color={C.navy900} style={{ flex: 1 }}>
              {title}
            </Txt>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <X size={22} color={C.slate500} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: 4 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Banner({ tone, children }: { tone: "error" | "info" | "warn"; children: React.ReactNode }) {
  const [bg, border, fg] =
    tone === "error" ? [C.danger50, C.danger100, C.danger700] : tone === "warn" ? [C.gold50, C.gold100, C.navy900] : [C.iris50, C.iris100, C.navy900];
  return (
    <View style={{ backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 }}>
      {typeof children === "string" ? (
        <Txt size={13.5} weight="medium" color={fg}>
          {children}
        </Txt>
      ) : (
        children
      )}
    </View>
  );
}

export const s = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.navy200,
    backgroundColor: C.white,
    paddingHorizontal: 14,
    fontFamily: F.regular,
    fontSize: 15.5,
    color: C.ink,
  },
  card: { backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.navy100 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  flag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.navy100, alignItems: "center", justifyContent: "center" },
  segmented: { flexDirection: "row", backgroundColor: "rgba(227,234,246,0.8)", borderRadius: 14, padding: 4 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 4 },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(6,18,46,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "92%",
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: C.navy100, marginBottom: 10 },
  sheetHead: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 12 },
});
