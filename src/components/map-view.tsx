"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { checkZone, isArea, type LatLng } from "@/lib/geo";
import { mapTiles } from "@/lib/map-tiles";

export type MapZone = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  /** A drawn area's corners; null or missing for a circle. */
  polygon?: LatLng[] | null;
  active?: boolean;
};
/** Drawing a zone outline: tap the map to add a corner, drag a corner to move it, tap "+" to insert one,
 *  double-click (or right-click) a corner to remove it. */
export type MapDraw = { points: LatLng[]; onChange: (points: LatLng[]) => void; label?: string };
export type MapMarker = { id: string | number; lat: number; lng: number; color: string; label?: string; title?: string };

type Props = {
  className?: string;
  zones?: MapZone[];
  me?: { lat: number; lng: number; accuracy: number } | null;
  markers?: MapMarker[];
  /** What to keep in view: the zones plus the current position ("me"), just the zones, or zones plus markers ("all"). */
  fit?: "me" | "zones" | "all";
  /** Change this number to frame the view again. */
  recenterKey?: number;
  onPick?: (lat: number, lng: number) => void;
  interactive?: boolean;
  /** Extra space at the bottom when something overlaps the map (e.g. the clock button). */
  padBottom?: number;
  /** Where the map credits go; move them to the top when the bottom is covered. */
  attribution?: "bottomright" | "topleft";
  /** Turns the map into an outline editor (map taps add corners instead of calling onPick). */
  draw?: MapDraw;
};

// Street tiles need a CARTO key (see src/lib/map-tiles.ts); without one the map shows no streets.
const TILES = mapTiles();

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const round7 = (x: number) => Math.round(x * 1e7) / 1e7;

const zoneStyle = (active: boolean) => ({
  color: active ? "#0c8e8a" : "#94a3b8",
  weight: 2,
  dashArray: "6 6",
  fillColor: active ? "#12a8a2" : "#94a3b8",
  fillOpacity: 0.09,
  interactive: false,
});

/** The middle of a zone, the latitude of its top edge (where the label sits) and its bounding corners. */
function zoneBox(z: { lat: number; lng: number; radius_m: number; polygon?: LatLng[] | null }) {
  if (isArea(z)) {
    const lats = z.polygon.map((p) => p[0]);
    const lngs = z.polygon.map((p) => p[1]);
    const [n, s, e, w] = [Math.max(...lats), Math.min(...lats), Math.max(...lngs), Math.min(...lngs)];
    return { mid: [(n + s) / 2, (e + w) / 2] as LatLng, top: n, corners: [[n, w], [s, e]] as LatLng[] };
  }
  const dLat = z.radius_m / 111_320;
  const dLng = dLat / Math.cos((z.lat * Math.PI) / 180);
  return {
    mid: [z.lat, z.lng] as LatLng,
    top: z.lat + dLat,
    corners: [[z.lat + dLat, z.lng - dLng], [z.lat - dLat, z.lng + dLng]] as LatLng[],
  };
}

const labelIcon = (lib: typeof Leaflet, name: string) =>
  lib.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<span class="ma-zone-label" style="position:absolute;transform:translate(-50%,calc(-100% - 5px))">${escapeHtml(name)}</span>`,
  });

export function MapView({
  className,
  zones = [],
  me,
  markers = [],
  fit = "me",
  recenterKey,
  onPick,
  interactive = true,
  padBottom = 24,
  attribution = "bottomright",
  draw,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layers = useRef<{ zones?: Leaflet.LayerGroup; edit?: Leaflet.LayerGroup; me?: Leaflet.LayerGroup; markers?: Leaflet.LayerGroup }>({});
  const framed = useRef<"none" | "partial" | "full">("none");
  const pick = useRef(onPick);
  pick.current = onPick;
  const drawing = useRef(draw);
  drawing.current = draw;
  const [ready, setReady] = useState(false);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    (async () => {
      const mod = await import("leaflet");
      const lib = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      if (cancelled || !el.current) return;
      L.current = lib;
      const m = lib.map(el.current, {
        zoomControl: false,
        attributionControl: true,
        dragging: interactive,
        touchZoom: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: false,
        keyboard: interactive,
      });
      m.attributionControl.setPrefix(false);
      m.attributionControl.setPosition(attribution);
      if (TILES) lib.tileLayer(TILES.url, { subdomains: "abcd", maxZoom: 20, attribution: TILES.attribution }).addTo(m);
      m.setView([5.9459, 116.0709], 16);
      layers.current = {
        zones: lib.layerGroup().addTo(m),
        edit: lib.layerGroup().addTo(m),
        markers: lib.layerGroup().addTo(m),
        me: lib.layerGroup().addTo(m),
      };
      m.on("click", (e: Leaflet.LeafletMouseEvent) => {
        const d = drawing.current;
        if (d) d.onChange([...d.points, [round7(e.latlng.lat), round7(e.latlng.lng)]]);
        else pick.current?.(e.latlng.lat, e.latlng.lng);
      });
      m.on("zoomend", () => el.current?.setAttribute("data-zoom", String(m.getZoom())));
      observer = new ResizeObserver(() => m.invalidateSize());
      observer.observe(el.current);
      map.current = m;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      const m = map.current;
      if (m) {
        // Leaflet finishes a zoom animation 250 ms later even after remove(), and then fails on the
        // removed map; mark the animation as done first (e.g. when the zone sheet closes mid-zoom).
        (m as unknown as { _animatingZoom?: boolean })._animatingZoom = false;
        m.remove();
      }
      map.current = null;
      framed.current = "none";
    };
  }, [interactive]);

  /**
   * Fits zones (+ position / markers) into view. Returns how complete the framing was.
   * Automatic framing jumps without animation: Leaflet ignores a new view while a zoom animation
   * is still running, which would leave the map stuck on the first, partial view.
   */
  const frame = (animate = false): "none" | "partial" | "full" => {
    const lib = L.current;
    const m = map.current;
    if (!lib || !m) return "none";
    const pts: Leaflet.LatLng[] = [];
    for (const z of zones) for (const c of zoneBox(z).corners) pts.push(lib.latLng(c[0], c[1]));
    const outline = drawing.current?.points ?? [];
    for (const p of outline) pts.push(lib.latLng(p[0], p[1]));
    if (fit === "all") for (const mk of markers) pts.push(lib.latLng(mk.lat, mk.lng));
    if (fit === "me" && me) pts.push(lib.latLng(me.lat, me.lng));
    if (!pts.length) return "none";
    const motion = animate ? { animate: true } : { reset: true };
    const inside = fit === "me" && me && zones.length ? checkZone(me.lat, me.lng, zones) : null;
    if (me && inside?.status === "internal" && inside.zone) {
      // Inside the zone: a close view where the zone's edge and label stay above whatever
      // overlaps the bottom of the map (the clock button), and the person's dot stays visible.
      const box = zoneBox(inside.zone);
      const size = m.getSize();
      const bandBottom = size.y - padBottom + 16;
      const centre = (zm: number) => m.project(box.mid, zm);
      const radiusPx = (zm: number) => centre(zm).y - m.project([box.top, box.mid[1]], zm).y;
      // low: lowest the zone centre may sit so its label still fits at the top;
      // high: highest it may sit so the person's dot stays above the button.
      const limits = (zm: number) => ({
        low: radiusPx(zm) + 46,
        high: bandBottom - (m.project([me.lat, me.lng], zm).y - centre(zm).y),
      });
      let zoom = 16;
      while (zoom > 13 && limits(zoom).low > limits(zoom).high) zoom -= 0.5;
      const { low, high } = limits(zoom);
      const zoneY = low <= high ? (low + high) / 2 : high;
      m.setView(m.unproject(centre(zoom).add([0, size.y / 2 - zoneY]), zoom), zoom, motion);
      return "full";
    }
    if (pts.length === 1) m.setView(pts[0], 17, motion);
    else m.fitBounds(lib.latLngBounds(pts), { paddingTopLeft: [28, 56], paddingBottomRight: [28, padBottom], maxZoom: 18, ...motion });
    // Keep re-framing until everything we wait for (zones, and the position for "me") has arrived.
    const complete = (zones.length > 0 || outline.length > 0 || (fit === "all" && markers.length > 0)) && (fit !== "me" || !!me);
    return complete ? "full" : "partial";
  };

  // Zones.
  useEffect(() => {
    const lib = L.current;
    const group = layers.current.zones;
    if (!ready || !lib || !group) return;
    group.clearLayers();
    for (const z of zones) {
      const style = zoneStyle(z.active !== false);
      if (isArea(z)) lib.polygon(z.polygon, style).addTo(group);
      else lib.circle([z.lat, z.lng], { radius: z.radius_m, ...style }).addTo(group);
      const box = zoneBox(z);
      lib.marker([box.top, box.mid[1]], { interactive: false, keyboard: false, icon: labelIcon(lib, z.name) }).addTo(group);
    }
  }, [ready, zones]);

  // The outline being drawn (zone editor).
  const outline = draw?.points;
  const outlineLabel = draw?.label;
  useEffect(() => {
    const lib = L.current;
    const group = layers.current.edit;
    if (!ready || !lib || !group) return;
    group.clearLayers();
    if (!outline) return;
    const change = (next: LatLng[]) => drawing.current?.onChange(next);
    const style = { ...zoneStyle(true), fillOpacity: 0.14 };
    const closed = outline.length >= 3;
    const shape = closed ? lib.polygon(outline, style) : lib.polyline(outline, { ...style, fill: false });
    shape.addTo(group);
    if (closed && outlineLabel) {
      const box = zoneBox({ lat: 0, lng: 0, radius_m: 0, polygon: outline });
      lib.marker([box.top, box.mid[1]], { interactive: false, keyboard: false, icon: labelIcon(lib, outlineLabel) }).addTo(group);
    }
    // "+" halfway along each edge: tap it (or drag it) to add a corner there.
    const edges = closed ? outline.length : outline.length - 1;
    for (let i = 0; i < edges; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      const mid = lib.marker([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], {
        draggable: true,
        keyboard: false,
        title: "Add a corner here",
        zIndexOffset: -100,
        icon: lib.divIcon({ className: "", iconSize: [18, 18], iconAnchor: [9, 9], html: '<span class="ma-mid">+</span>' }),
      });
      const insert = () => {
        const p = mid.getLatLng();
        change([...outline.slice(0, i + 1), [round7(p.lat), round7(p.lng)], ...outline.slice(i + 1)]);
      };
      mid.on("click", insert);
      mid.on("dragend", insert);
      mid.addTo(group);
    }
    // The corners: drag to move, double-click or right-click to remove.
    outline.forEach((p, i) => {
      const corner = lib.marker(p, {
        draggable: true,
        keyboard: false,
        title: `Corner ${i + 1}. Drag to move it, double-click to remove it.`,
        zIndexOffset: 100,
        icon: lib.divIcon({ className: "", iconSize: [18, 18], iconAnchor: [9, 9], html: `<span class="ma-vertex${i === 0 ? " first" : ""}"></span>` }),
      });
      const moved = () => {
        const q = corner.getLatLng();
        return outline.map((o, k) => (k === i ? ([round7(q.lat), round7(q.lng)] as LatLng) : o));
      };
      // A tap on a corner is handled here, so it doesn't also reach the map and add a corner.
      corner.on("click", () => {});
      corner.on("drag", () => shape.setLatLngs(moved()));
      corner.on("dragend", () => change(moved()));
      const remove = (e: Leaflet.LeafletMouseEvent) => {
        lib.DomEvent.stop(e.originalEvent);
        change(outline.filter((_, k) => k !== i));
      };
      corner.on("dblclick", remove);
      corner.on("contextmenu", remove);
      corner.addTo(group);
    });
  }, [ready, outline, outlineLabel]);

  // Other markers (admin views).
  useEffect(() => {
    const lib = L.current;
    const group = layers.current.markers;
    if (!ready || !lib || !group) return;
    group.clearLayers();
    for (const mk of markers) {
      const marker = lib.marker([mk.lat, mk.lng], {
        title: mk.title,
        icon: lib.divIcon({
          className: "",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          html: `<span class="ma-pin" style="background:${mk.color}">${escapeHtml(mk.label ?? "")}</span>`,
        }),
      });
      if (mk.title) marker.bindTooltip(escapeHtml(mk.title), { direction: "top", offset: [0, -14] });
      marker.addTo(group);
    }
  }, [ready, markers]);

  // Current position.
  useEffect(() => {
    const lib = L.current;
    const group = layers.current.me;
    if (!ready || !lib || !group) return;
    group.clearLayers();
    if (!me) return;
    lib
      .circle([me.lat, me.lng], {
        radius: Math.min(me.accuracy, 2000),
        color: "#5d5fe6",
        weight: 1,
        opacity: 0.5,
        fillColor: "#5d5fe6",
        fillOpacity: 0.1,
        interactive: false,
      })
      .addTo(group);
    lib
      .marker([me.lat, me.lng], {
        interactive: false,
        keyboard: false,
        icon: lib.divIcon({
          className: "",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          html: `<span style="position:relative;display:block;width:22px;height:22px">
              <span class="animate-ping-soft" style="position:absolute;inset:3px;border-radius:999px;background:#5d5fe6"></span>
              <span style="position:absolute;inset:3px;border-radius:999px;background:#5d5fe6;border:3px solid #fff;box-shadow:0 1px 4px rgb(6 18 46/.35)"></span>
            </span>`,
        }),
      })
      .addTo(group);
  }, [ready, me]);

  // Frame once data arrives (again when the first position fix comes in).
  useEffect(() => {
    if (!ready || framed.current === "full") return;
    const result = frame();
    if (result !== "none") framed.current = result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fit, me, zones, markers]);

  // Frame again on demand.
  useEffect(() => {
    if (!ready || !recenterKey) return;
    frame(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  // `isolate` keeps Leaflet's internal z-indexes inside the map, so overlapping UI stays on top.
  return <div ref={el} className={`isolate ${className ?? ""}`} role="region" aria-label="Map" />;
}
