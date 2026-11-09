"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock3, FilePenLine, Printer, ShieldCheck, UserRound } from "lucide-react";
import { useUser } from "./user-context";
import { cx } from "./ui";

export function StaffShell({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const pathname = usePathname();
  const items = [
    { href: "/history", label: "History", icon: CalendarDays },
    { href: "/requests", label: "Requests", icon: FilePenLine },
    { href: "/attendance", label: "Clock", icon: Clock3, center: true },
    user.role === "admin"
      ? { href: "/admin", label: "Admin", icon: ShieldCheck }
      : { href: "/records", label: "Print", icon: Printer },
    { href: "/profile", label: "Profile", icon: UserRound },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-mist sm:border-x sm:border-navy-100">
      <main className="flex-1 pb-[calc(96px+env(safe-area-inset-bottom))]">{children}</main>
      <nav
        aria-label="Main"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] border-t border-navy-100 bg-white/95 backdrop-blur print:hidden"
      >
        <ul className="grid h-[68px] grid-cols-5 items-center">
          {items.map((it) => {
            const active = pathname === it.href || (it.href !== "/attendance" && pathname.startsWith(it.href + "/"));
            const Icon = it.icon;
            if (it.center) {
              return (
                <li key={it.href} className="flex justify-center">
                  <Link
                    href={it.href}
                    aria-label="Clock in or out"
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "-mt-7 grid size-[62px] place-items-center rounded-full text-white shadow-[0_10px_24px_-8px_rgb(16_42_94/0.65)] ring-4 ring-mist transition-transform active:scale-95",
                      active ? "bg-navy-800" : "bg-navy-700",
                    )}
                  >
                    <Icon className="size-7" strokeWidth={2.2} />
                  </Link>
                </li>
              );
            }
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex flex-col items-center gap-1 py-1 text-[11px] font-semibold transition-colors",
                    active ? "text-navy-800" : "text-slate-400 hover:text-navy-600",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function TopBar({
  title,
  left,
  right,
}: {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 grid h-14 grid-cols-[1fr_auto_1fr] items-center bg-mist/90 px-3 backdrop-blur print:hidden">
      <div className="flex items-center gap-1">{left}</div>
      <h1 className="text-[19px] font-bold tracking-tight text-navy-900">{title}</h1>
      <div className="flex items-center justify-end gap-1">{right}</div>
    </header>
  );
}

export function IconLink({
  href,
  label,
  children,
  badge,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <Link href={href} aria-label={label} className="relative grid size-10 place-items-center rounded-xl text-navy-900 hover:bg-navy-100/70">
      {children}
      {badge ? (
        <span className="absolute right-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-gold-500 px-1 text-[10.5px] font-bold leading-[18px] text-navy-950">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function BrandMark() {
  return (
    <span className="flex items-center gap-2 pl-1">
      <img src="/icons/icon.svg" alt="" className="size-7" />
      <span className="text-[13px] font-extrabold tracking-wide text-navy-800">DAICOE</span>
    </span>
  );
}
