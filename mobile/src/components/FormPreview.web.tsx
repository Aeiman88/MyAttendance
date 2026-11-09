import { createElement, useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { C } from "../theme";

/** Web build only (testing): the printable form in an iframe, scaled to the column width. */
export function FormPreview({ html, height }: { html: string; height: number }) {
  const [width, setWidth] = useState(360);
  const zoom = Math.max(0.2, (width - 16) / 1123);
  const doc = useMemo(
    () => html.replace("</style>", `body{background:#dfe5ee!important;padding:8px 0}.sheet{zoom:${zoom};margin:0 auto 8px!important;box-shadow:0 2px 10px rgba(6,18,46,.18)}</style>`),
    [html, zoom],
  );
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.navy100, backgroundColor: "#dfe5ee" }}
    >
      {createElement("iframe", { srcDoc: doc, title: "Attendance form preview", style: { border: 0, width: "100%", height: "100%" } })}
    </View>
  );
}
