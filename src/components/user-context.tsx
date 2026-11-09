"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/auth";

const UserCtx = createContext<SessionUser | null>(null);

export function UserProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <UserCtx.Provider value={user}>{children}</UserCtx.Provider>;
}

export function useUser(): SessionUser {
  const u = useContext(UserCtx);
  if (!u) throw new Error("useUser must be used inside UserProvider");
  return u;
}
