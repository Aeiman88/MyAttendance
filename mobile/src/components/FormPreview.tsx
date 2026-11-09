import { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { C } from "../theme";

/** Shows the printable form, scaled down to the phone's width. */
export function FormPreview({ html, height }: { html: string; height: number }) {
  const doc = useMemo(
    () =>
      html
        .replace('<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="viewport" content="width=1150">')
        .replace("</style>", "body{background:#dfe5ee!important;padding:14px 0}.sheet{margin:0 auto 14px!important;box-shadow:0 2px 10px rgba(6,18,46,.18)}</style>"),
    [html],
  );
  return (
    <View style={{ height, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.navy100, backgroundColor: "#dfe5ee" }}>
      <WebView source={{ html: doc }} originWhitelist={["*"]} nestedScrollEnabled scalesPageToFit style={{ backgroundColor: "#dfe5ee" }} />
    </View>
  );
}
