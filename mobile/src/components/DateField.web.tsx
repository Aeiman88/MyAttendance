import { createElement } from "react";
import { C, F } from "../theme";

/** Web build only (testing): a plain browser date/time input. */
export function DateField({
  mode = "date",
  value,
  onChange,
  min,
  max,
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
  return createElement("input", {
    type: mode,
    value,
    min,
    max,
    "aria-label": accessibilityLabel,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    style: {
      height: 48,
      borderRadius: 14,
      border: `1px solid ${C.navy200}`,
      background: C.white,
      padding: "0 14px",
      fontFamily: F.regular,
      fontSize: 15.5,
      color: C.ink,
      boxSizing: "border-box",
      width: "100%",
    },
  });
}
