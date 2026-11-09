import { useEffect, useMemo, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { buildMapHtml, type MapState } from "./map-html";

/** The Clock screen map: Leaflet in a WebView, fed with the zone(s) and the phone's position. */
export function MapView({ state, recenterKey, style }: { state: MapState; recenterKey: number; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<{ injectJavaScript: (js: string) => void } | null>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(buildMapHtml, []);

  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(`window.__update(${JSON.stringify(state)});true;`);
  }, [ready, state]);

  useEffect(() => {
    if (ready && recenterKey) ref.current?.injectJavaScript("window.__recenter();true;");
  }, [ready, recenterKey]);

  return (
    <WebView
      ref={ref as never}
      source={{ html, baseUrl: "https://myattendance.app/" }}
      originWhitelist={["*"]}
      onMessage={(e: { nativeEvent: { data: string } }) => e.nativeEvent.data === "ready" && setReady(true)}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      setBuiltInZoomControls={false}
      javaScriptEnabled
      style={[{ backgroundColor: "#eaeff6" }, style]}
      accessibilityLabel="Map of your position and the DAICOE zone"
    />
  );
}
