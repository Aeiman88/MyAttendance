import { useEffect, useMemo, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { serverBase } from "@/api";
import { buildMapHtml, type MapState, type MapTiles } from "./map-html";

/** The Clock screen map: Leaflet in a WebView, fed with the zone(s) and the phone's position. */
export function MapView({
  state,
  tiles,
  recenterKey,
  style,
}: {
  state: MapState;
  tiles: MapTiles;
  recenterKey: number;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<{ injectJavaScript: (js: string) => void } | null>(null);
  const [ready, setReady] = useState(false);
  const tileUrl = tiles?.url ?? null;
  const tileCredit = tiles?.attribution ?? null;
  const html = useMemo(() => buildMapHtml(tileUrl ? { url: tileUrl, attribution: tileCredit ?? "" } : null), [tileUrl, tileCredit]);
  // A new page (tiles arrived or changed) has to say "ready" again before it can take state.
  useEffect(() => setReady(false), [html]);

  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(`window.__update(${JSON.stringify(state)});true;`);
  }, [ready, state]);

  useEffect(() => {
    if (ready && recenterKey) ref.current?.injectJavaScript("window.__recenter();true;");
  }, [ready, recenterKey]);

  return (
    <WebView
      ref={ref as never}
      // The page runs as the MyAttendance website, so a map key limited to that website also works here.
      source={{ html, baseUrl: `${serverBase() || "https://localhost"}/` }}
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
