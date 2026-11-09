"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "./ui";

/** Finger/stylus signature pad. Exports a cropped, transparent PNG. */
export function SignaturePad({ onSave, busy }: { onSave: (dataUrl: string) => void; busy?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const bounds = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * ratio);
    c.height = Math.round(rect.height * ratio);
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a1a40";
    ctx.lineWidth = 2.4;
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const grow = (p: { x: number; y: number }) => {
    const b = bounds.current;
    bounds.current = b
      ? { minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }
      : { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
  };

  function down(e: React.PointerEvent) {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    last.current = p;
    grow(p);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#0a1a40";
    ctx.fill();
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = canvas.current!.getContext("2d")!;
    const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    grow(p);
    if (empty) setEmpty(false);
  }
  function up() {
    drawing.current = false;
    last.current = null;
  }
  function clear() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    bounds.current = null;
    setEmpty(true);
  }
  function save() {
    const c = canvas.current!;
    const b = bounds.current;
    if (!b) return;
    const ratio = c.width / c.getBoundingClientRect().width;
    const pad = 6;
    const sx = Math.max(0, Math.floor((b.minX - pad) * ratio));
    const sy = Math.max(0, Math.floor((b.minY - pad) * ratio));
    const sw = Math.min(c.width - sx, Math.ceil((b.maxX - b.minX + pad * 2) * ratio));
    const sh = Math.min(c.height - sy, Math.ceil((b.maxY - b.minY + pad * 2) * ratio));
    // Scale down to at most 480 px wide to keep the stored image small.
    const scale = Math.min(1, 480 / sw);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw * scale));
    out.height = Math.max(1, Math.round(sh * scale));
    out.getContext("2d")!.drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height);
    onSave(out.toDataURL("image/png"));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-navy-200">
        <canvas
          ref={canvas}
          className="block h-48 w-full touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          aria-label="Signature area. Draw your signature with your finger or mouse."
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-navy-200" />
        {empty && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-[14px] font-medium text-slate-400">
            Sign here
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="secondary" onClick={clear} disabled={empty}>
          <Eraser className="size-4" /> Clear
        </Button>
        <Button type="button" onClick={save} disabled={empty} loading={busy}>
          Save signature
        </Button>
      </div>
    </div>
  );
}
