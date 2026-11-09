import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Eraser } from "lucide-react-native";
import { Button, Txt } from "./ui";
import { C } from "../theme";

type Point = [number, number];
export type Strokes = { width: number; height: number; strokes: Point[][] };

const toPath = (pts: Point[]) => {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}l0.1 0`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${last[0]} ${last[1]}`;
};

/** Finger signature. Sends the pen strokes; the server turns them into the signature image. */
export function SignaturePad({ onSave, busy }: { onSave: (s: Strokes) => void; busy?: boolean }) {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [, force] = useState(0);
  const current = useRef<Point[] | null>(null);
  const size = useRef({ width: 300, height: 190 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          current.current = [[Math.round(locationX * 10) / 10, Math.round(locationY * 10) / 10]];
          force((n) => n + 1);
        },
        onPanResponderMove: (e) => {
          const pts = current.current;
          if (!pts) return;
          const { locationX, locationY } = e.nativeEvent;
          const [lx, ly] = pts[pts.length - 1];
          if (Math.hypot(locationX - lx, locationY - ly) < 1.5) return;
          pts.push([Math.round(locationX * 10) / 10, Math.round(locationY * 10) / 10]);
          force((n) => n + 1);
        },
        onPanResponderRelease: () => {
          const pts = current.current;
          current.current = null;
          if (pts?.length) setStrokes((s) => [...s, pts]);
        },
      }),
    [],
  );

  const all = current.current ? [...strokes, current.current] : strokes;
  const empty = all.length === 0;

  return (
    <View style={{ gap: 12 }}>
      <View
        style={st.pad}
        onLayout={(e: LayoutChangeEvent) => (size.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        {...responder.panHandlers}
        accessibilityLabel="Signature area. Sign with your finger."
      >
        <View style={st.line} pointerEvents="none" />
        {empty && (
          <View style={st.hint} pointerEvents="none">
            <Txt size={14} weight="medium" color={C.slate400}>
              Sign here
            </Txt>
          </View>
        )}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {all.map((pts, i) => (
            <Path key={i} d={toPath(pts)} stroke={C.navy900} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
        </Svg>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button title="Clear" variant="secondary" icon={<Eraser size={16} color={C.navy800} />} onPress={() => setStrokes([])} disabled={empty} style={{ flex: 1 }} />
        <Button
          title="Save signature"
          onPress={() => onSave({ ...size.current, strokes })}
          disabled={strokes.length === 0}
          loading={busy}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  pad: { height: 190, borderRadius: 18, borderWidth: 1, borderColor: C.navy200, backgroundColor: C.white, overflow: "hidden" },
  line: { position: "absolute", left: 24, right: 24, bottom: 42, borderBottomWidth: 1, borderStyle: "dashed", borderColor: C.navy200 },
  hint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
});
