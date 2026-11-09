"use client";

import { forwardRef, useEffect, useId, useRef } from "react";
import { Loader2, X } from "lucide-react";
import type { DayStatus, DayFlag } from "@/lib/rules";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");
export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "teal";
type Size = "sm" | "md" | "lg";
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

/** Button styling, also used for links that look like buttons. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(
    "inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55",
    size === "sm" && "h-9 px-3 text-sm",
    size === "md" && "h-11 px-4 text-[15px]",
    size === "lg" && "h-13 px-5 text-base",
    variant === "primary" && "bg-navy-800 text-white hover:bg-navy-700 active:bg-navy-900",
    variant === "teal" && "bg-teal-600 text-white hover:bg-teal-700",
    variant === "secondary" && "bg-white text-navy-800 ring-1 ring-navy-200 hover:bg-navy-50",
    variant === "ghost" && "text-navy-700 hover:bg-navy-100/70",
    variant === "danger" && "bg-danger-600 text-white hover:bg-danger-700",
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-navy-900">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-[13px] text-danger-600">{error}</p>
      ) : hint ? (
        <p className="text-[12.5px] leading-snug text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-navy-200 bg-white px-3.5 text-[15px] text-ink placeholder:text-slate-400 transition-colors focus:border-iris-500 focus:outline-none focus:ring-3 focus:ring-iris-100 disabled:bg-navy-50";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(inputBase, "h-11", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cx(inputBase, "h-11 appearance-none bg-[length:16px] pr-9", className)} {...rest}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23102a5e' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
      }}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx(inputBase, "min-h-24 py-2.5 leading-relaxed", className)} {...rest} />;
  },
);

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-5 animate-spin text-navy-500", className)} aria-label="Loading" />;
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the effect below: callers pass a new function on every render,
  // and re-running it on each keystroke would move the cursor back to the first field.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>("input, textarea, select, button[data-autofocus]");
      el?.focus();
    }, 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center print:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 animate-fade bg-navy-950/45" onClick={onClose} />
      <div
        ref={panel}
        className={cx(
          "relative max-h-[92dvh] w-full animate-sheet overflow-y-auto rounded-t-[28px] bg-white px-5 pb-6 pt-3 shadow-2xl sm:rounded-[24px] sm:pt-5",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-navy-100 sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-navy-900">{title}</h2>
          <button type="button" onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-navy-50" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<DayStatus, string> = {
  present: "bg-teal-50 text-teal-700 ring-teal-100",
  working: "bg-iris-50 text-iris-700 ring-iris-100",
  incomplete: "bg-gold-50 text-gold-700 ring-gold-100",
  absent: "bg-danger-50 text-danger-700 ring-danger-100",
  leave: "bg-navy-50 text-navy-700 ring-navy-100",
  holiday: "bg-navy-50 text-navy-700 ring-navy-100",
  off: "bg-slate-50 text-slate-500 ring-slate-200",
  pending: "bg-slate-50 text-slate-600 ring-slate-200",
  upcoming: "bg-slate-50 text-slate-400 ring-slate-100",
  untracked: "bg-slate-50 text-slate-400 ring-slate-100",
};

export function StatusChip({ status, label }: { status: DayStatus; label: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1", STATUS_STYLE[status])}>
      {label}
    </span>
  );
}

const FLAG_STYLE: Record<DayFlag, string> = {
  late: "bg-gold-100 text-gold-700",
  early: "bg-gold-100 text-gold-700",
  external: "bg-iris-100 text-iris-700",
  corrected: "bg-navy-100 text-navy-700",
  manual: "bg-navy-100 text-navy-700",
};
const FLAG_LABEL: Record<DayFlag, string> = {
  late: "Late",
  early: "Left early",
  external: "External",
  corrected: "Corrected",
  manual: "Added by admin",
};

export function FlagChip({ flag, detail }: { flag: DayFlag; detail?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold", FLAG_STYLE[flag])}>
      {FLAG_LABEL[flag]}
      {detail ? ` ${detail}` : ""}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .replace(/\b(bin|binti|bte|bt|a\/l|a\/p)\b/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cx("grid size-10 shrink-0 place-items-center rounded-full bg-navy-100 text-sm font-bold text-navy-800", className)}
    >
      {initials || "?"}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-navy-100 text-navy-700">{icon}</div>
      <p className="mt-1 font-semibold text-navy-900">{title}</p>
      {children && <div className="max-w-xs text-sm leading-relaxed text-slate-500">{children}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <div role="tablist" className={cx("inline-flex rounded-xl bg-navy-100/70 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
            value === o.value ? "bg-white text-navy-900 shadow-sm" : "text-navy-600 hover:text-navy-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
