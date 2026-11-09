import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { buildMapHtml, type MapState, type MapTiles } from "./map-html";

type MapWindow = Window & { __update?: (s: MapState) => void; __recenter?: () => void };

/** Web build only (used for testing): the same map page in an iframe instead of a WebView. */
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
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const tileUrl = tiles?.url ?? null;
  const tileCredit = tiles?.attribution ?? null;
  const html = useMemo(() => buildMapHtml(tileUrl ? { url: tileUrl, attribution: tileCredit ?? "" } : null), [tileUrl, tileCredit]);
  // A new page (tiles arrived or changed) has to say "ready" again before it can take state.
  useEffect(() => setReady(false), [html]);
  const win = () => frame.current?.contentWindow as MapWindow | null | undefined;

  useEffect(() => {
    const onMsg = (e: MessageEvent) => e.data?.source === "ma-map" && e.data.msg === "ready" && setReady(true);
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (ready) win()?.__update?.(state);
  }, [ready, state]);

  useEffect(() => {
    if (ready && recenterKey) win()?.__recenter?.();
  }, [ready, recenterKey]);

  return (
    <View style={style}>
      {createElement("iframe", {
        ref: frame,
        srcDoc: html,
        title: "Map of your position and the DAICOE zone",
        style: { border: 0, width: "100%", height: "100%", display: "block" },
      })}
    </View>
  );
}
