import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, configureApi, loadServer, loadToken, normalizeServer, saveServer, saveToken, setBase } from "./api";
import type { Schedule } from "./shared/rules";

export type Me = {
  user: {
    id: number;
    staffNo: string;
    name: string;
    position: string;
    role: "staff" | "admin";
    email: string;
    phone: string;
    signature: string | null;
    mustChangePassword: boolean;
  };
  schedule: Schedule | null;
  orgName: string;
};

type Status = "loading" | "needs-server" | "signed-out" | "must-change-password" | "signed-in";

type AuthState = {
  status: Status;
  server: string;
  me: Me | null;
  signIn: (staffNo: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  setServer: (url: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [server, setServerState] = useState("");
  const [me, setMe] = useState<Me | null>(null);

  const signOut = useCallback(async () => {
    await saveToken(null);
    setMe(null);
    setStatus("signed-out");
  }, []);

  const refresh = useCallback(async () => {
    const data = await api<Me>("/api/me");
    setMe(data);
    setStatus(data.user.mustChangePassword ? "must-change-password" : "signed-in");
  }, []);

  useEffect(() => {
    (async () => {
      const [url, tok] = await Promise.all([loadServer(), loadToken()]);
      setServerState(url);
      configureApi({
        base: url,
        token: tok,
        onSignedOut: () => {
          saveToken(null);
          setMe(null);
          setStatus("signed-out");
        },
        onPasswordChange: () => setStatus("must-change-password"),
      });
      if (!url) return setStatus("needs-server");
      if (!tok) return setStatus("signed-out");
      try {
        await refresh();
      } catch {
        // Offline at start-up: stay signed in; each screen shows its own connection error.
        setStatus((s) => (s === "loading" ? "signed-in" : s));
      }
    })();
  }, [refresh]);

  const signIn = useCallback(
    async (staffNo: string, password: string) => {
      const res = await api<{ token: string; mustChangePassword: boolean }>("/api/auth/login", {
        body: { staffNo, password, client: "app" },
      });
      await saveToken(res.token);
      if (res.mustChangePassword) {
        setStatus("must-change-password");
        return;
      }
      await refresh();
    },
    [refresh],
  );

  const changePassword = useCallback(
    async (current: string, next: string) => {
      const res = await api<{ token: string }>("/api/auth/password", { body: { currentPassword: current, newPassword: next } });
      await saveToken(res.token);
      await refresh();
    },
    [refresh],
  );

  const setServer = useCallback(async (input: string) => {
    const url = normalizeServer(input);
    await saveServer(url);
    setBase(url);
    setServerState(url);
    await saveToken(null);
    setMe(null);
    setStatus("signed-out");
  }, []);

  const value = useMemo(
    () => ({ status, server, me, signIn, signOut, changePassword, setServer, refresh }),
    [status, server, me, signIn, signOut, changePassword, setServer, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
