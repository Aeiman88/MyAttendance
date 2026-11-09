"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleCheck, CircleAlert, Info, X } from "lucide-react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; message: string };

const Ctx = createContext<(message: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: string, tone: Tone = "success") => {
      const id = next.current++;
      setToasts((t) => [...t.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3500);
    },
    [dismiss],
  );
  const value = useMemo(() => show, [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] mx-auto flex w-full max-w-md flex-col gap-2 px-4 print:hidden"
      >
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CircleCheck : t.tone === "error" ? CircleAlert : Info;
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex animate-sheet items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-[0_10px_30px_-10px_rgb(6_18_46/0.45)] ${
                t.tone === "success"
                  ? "bg-navy-900 text-white"
                  : t.tone === "error"
                    ? "bg-danger-600 text-white"
                    : "bg-white text-ink ring-1 ring-navy-100"
              }`}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${t.tone === "success" ? "text-teal-300" : ""}`} aria-hidden />
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-m-1 rounded-lg p-1 opacity-70 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
