"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, FilePenLine, KeyRound, LayoutDashboard, LogOut, Printer, Settings, Smartphone, Users } from "lucide-react";
import { useUser } from "./user-context";
import { Avatar, cx } from "./ui";

const NAV = [
  { href: "/admin", label: "Today", icon: LayoutDashboard },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/records", label: "Records", icon: CalendarRange },
  { href: "/admin/requests", label: "Requests", icon: FilePenLine },
  { href: "/admin/print", label: "Print", icon: Printer },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useUser();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden flex-col bg-navy-900 px-4 py-5 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <Link href="/admin" className="flex items-center gap-2.5 px-2">
          <img src="/icons/icon.svg" alt="" className="size-9" />
          <span>
            <span className="block text-[15px] font-extrabold tracking-tight">MyAttendance</span>
            <span className="block text-[11.5px] text-navy-300">DAICOE admin</span>
          </span>
        </Link>
        <nav aria-label="Admin" className="mt-8 flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition-colors",
                  active ? "bg-white/10 text-white" : "text-navy-200 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className={cx("size-[18px]", active && "text-teal-300")} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <Link
            href="/app"
            target="_blank"
            className="flex items-center gap-3 rounded-xl bg-teal-600 px-3 py-2.5 text-[14.5px] font-semibold text-white hover:bg-teal-700"
          >
            <Smartphone className="size-[18px]" /> Staff app page
          </Link>
          <div className="flex items-center gap-3 px-1">
            <Avatar name={user.name} className="size-9 bg-white/10 text-white" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{user.name}</span>
              <span className="block text-[12px] text-navy-300">{user.staffNo}</span>
            </span>
          </div>
          <div className="flex gap-1 px-1 text-[12.5px] font-semibold">
            <Link href="/change-password" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-navy-200 hover:bg-white/5 hover:text-white">
              <KeyRound className="size-3.5" /> Password
            </Link>
            <button type="button" onClick={logout} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-navy-200 hover:bg-white/5 hover:text-white">
              <LogOut className="size-3.5" /> Log out
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile header + tabs */}
        <header className="sticky top-0 z-30 border-b border-navy-100 bg-white/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/admin" className="flex items-center gap-2">
              <img src="/icons/icon.svg" alt="" className="size-7" />
              <span className="text-[15px] font-extrabold text-navy-900">Admin</span>
            </Link>
            <div className="flex items-center gap-1">
              <Link href="/app" target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal-600 px-3 text-[13px] font-semibold text-white">
                <Smartphone className="size-4" /> Staff app
              </Link>
              <button type="button" onClick={logout} aria-label="Log out" className="grid size-9 place-items-center rounded-xl text-navy-700 hover:bg-navy-50">
                <LogOut className="size-[18px]" />
              </button>
            </div>
          </div>
          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={cx(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold",
                  isActive(n.href) ? "bg-navy-800 text-white" : "text-navy-700 hover:bg-navy-50",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-navy-900">{title}</h1>
        {sub && <p className="mt-0.5 text-[14px] text-slate-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl bg-white ring-1 ring-navy-100", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-navy-50 px-4 py-3">
          {title && <h2 className="text-[15px] font-bold text-navy-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
