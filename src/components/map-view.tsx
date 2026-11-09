"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { checkZone } from "@/lib/geo";
import { mapTiles } from "@/lib/map-tiles";

export type MapZone = { id: number; name: string; lat: number; lng: number; radius_m: number; active?: boolean };
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
};

// Street tiles need a CARTO key (see src/lib/map-tiles.ts); without one the map shows no streets.
const TILES = mapTiles();

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

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
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layers = useRef<{ zones?: Leaflet.LayerGroup; me?: Leaflet.LayerGroup; markers?: Leaflet.LayerGroup }>({});
  const framed = useRef<"none" | "partial" | "full">("none");
  const pick = useRef(onPick);
  pick.current = onPick;
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
        markers: lib.layerGroup().addTo(m),
        me: lib.layerGroup().addTo(m),
      };
      m.on("click", (e: Leaflet.LeafletMouseEvent) => pick.current?.(e.latlng.lat, e.latlng.lng));
      m.on("zoomend", () => el.current?.setAttribute("data-zoom", String(m.getZoom())));
      observer = new ResizeObserver(() => m.invalidateSize());
      observer.observe(el.current);
      map.current = m;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
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
    for (const z of zones) {
      const b = lib.latLng(z.lat, z.lng).toBounds(z.radius_m * 2);
      pts.push(b.getNorthWest(), b.getSouthEast());
    }
    if (fit === "all") for (const mk of markers) pts.push(lib.latLng(mk.lat, mk.lng));
    if (fit === "me" && me) pts.push(lib.latLng(me.lat, me.lng));
    if (!pts.length) return "none";
    const motion = animate ? { animate: true } : { reset: true };
    const inside = fit === "me" && me && zones.length ? checkZone(me.lat, me.lng, zones) : null;
    if (me && inside?.status === "internal" && inside.zone) {
      // Inside the zone: a close view where the zone's edge and label stay above whatever
      // overlaps the bottom of the map (the clock button), and the person's dot stays visible.
      const z = inside.zone;
      const size = m.getSize();
      const bandBottom = size.y - padBottom + 16;
      const centre = (zm: number) => m.project([z.lat, z.lng], zm);
      const radiusPx = (zm: number) => centre(zm).y - m.project([z.lat + z.radius_m / 111_320, z.lng], zm).y;
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
    const complete = (zones.length > 0 || (fit === "all" && markers.length > 0)) && (fit !== "me" || !!me);
    return complete ? "full" : "partial";
  };

  // Zones.
  useEffect(() => {
    const lib = L.current;
    const group = layers.current.zones;
    if (!ready || !lib || !group) return;
    group.clearLayers();
    for (const z of zones) {
      const active = z.active !== false;
      lib
        .circle([z.lat, z.lng], {
          radius: z.radius_m,
          color: active ? "#0c8e8a" : "#94a3b8",
          weight: 2,
          dashArray: "6 6",
          fillColor: active ? "#12a8a2" : "#94a3b8",
          fillOpacity: 0.09,
          interactive: false,
        })
        .addTo(group);
      const north = z.lat + z.radius_m / 111_320;
      lib
        .marker([north, z.lng], {
          interactive: false,
          keyboard: false,
          icon: lib.divIcon({
            className: "",
            iconSize: [0, 0],
            html: `<span class="ma-zone-label" style="position:absolute;transform:translate(-50%,calc(-100% - 5px))">${escapeHtml(z.name)}</span>`,
          }),
        })
        .addTo(group);
    }
  }, [ready, zones]);

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
