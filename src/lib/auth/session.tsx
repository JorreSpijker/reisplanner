"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

export type SessionUser = {
  id: string;
  name: string;
  email?: string;
};

export type Session = {
  user: SessionUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
};

const SessionContext = createContext<Session>({ user: null, status: "loading" });

const STORAGE_KEY = "reisplanner:user";

let cachedUserId: string | null = null;

/** Vaste id per browser; wordt bij eerste bezoek aangemaakt. */
function getLocalUserId(): string {
  if (cachedUserId) return cachedUserId;

  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  cachedUserId = id;
  return id;
}

/** Zolang er geen echte login is, wijzigt de gebruiker nooit. */
const subscribe = () => () => {};

/**
 * Voorlopige sessie: één vaste lokale gebruiker, zodat data al aan een `userId`
 * hangt. Bij het inbouwen van SSO wordt dit vervangen door de provider van
 * Auth.js of Supabase; `useSession` houdt dezelfde vorm, dus componenten die
 * hem gebruiken veranderen niet.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const userId = useSyncExternalStore(subscribe, getLocalUserId, () => null);

  const session = useMemo<Session>(
    () =>
      userId
        ? { user: { id: userId, name: "Lokale gebruiker" }, status: "authenticated" }
        : { user: null, status: "loading" },
    [userId],
  );

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  return useContext(SessionContext);
}
