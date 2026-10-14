"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase-browser";

export type MemberUser = { id?: string; email?: string };

const STORAGE_KEY = "grove_member_session";
export const AUTH_EVENT = "grove_auth_changed";

type Stored = { user?: MemberUser; access_token?: string; refresh_token?: string };

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export function persistMemberSession(user?: MemberUser, access_token?: string, refresh_token?: string) {
  try {
    if (!user && !access_token) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      const current = readStored() || {};
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user: user ?? current.user,
          access_token: access_token ?? current.access_token,
          refresh_token: refresh_token ?? current.refresh_token,
        })
      );
    }
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

/** Fresh access token: checks session expiry and auto-refreshes using refresh_token if needed. */
export async function getMemberToken(): Promise<string | null> {
  const nowSec = Math.floor(Date.now() / 1000);

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const sess = data.session;
      if (sess?.access_token) {
        // If expired or expiring within 60s, refresh proactively
        if (sess.expires_at && sess.expires_at < nowSec + 60) {
          const { data: refData } = await supabase.auth.refreshSession();
          if (refData.session?.access_token) {
            persistMemberSession(refData.session.user, refData.session.access_token, refData.session.refresh_token);
            return refData.session.access_token;
          }
        }
        return sess.access_token;
      }
    } catch {}
  }

  const stored = readStored();
  if (!stored) return null;

  // If supabase has no session but we have a stored refresh_token, try restoring session
  if (supabase && stored.refresh_token) {
    try {
      const { data: setRes } = await supabase.auth.setSession({
        access_token: stored.access_token || "",
        refresh_token: stored.refresh_token,
      });
      if (setRes.session?.access_token) {
        persistMemberSession(setRes.session.user, setRes.session.access_token, setRes.session.refresh_token);
        return setRes.session.access_token;
      }
    } catch {}
  }

  return stored.access_token ?? null;
}

export async function signOutMember() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  try {
    await supabase?.auth.signOut();
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

/** Single source of truth for "who is logged in" across header, booking and member pages. */
export function useMember() {
  const [user, setUser] = useState<MemberUser | null>(null);
  const [ready, setReady] = useState(false);

  const sync = useCallback(async () => {
    let u: MemberUser | null = null;
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) u = data.session.user;
    }
    if (!u) {
      const stored = readStored();
      if (stored?.user) u = stored.user;
    }
    setUser(u);
    setReady(true);
  }, []);

  useEffect(() => {
    sync();
    const onEvent = () => sync();
    window.addEventListener(AUTH_EVENT, onEvent);
    const sub = supabase?.auth.onAuthStateChange(() => {
      // Defer: calling Supabase methods inside this callback can deadlock.
      setTimeout(sync, 0);
    });
    return () => {
      window.removeEventListener(AUTH_EVENT, onEvent);
      sub?.data.subscription.unsubscribe();
    };
  }, [sync]);

  return { user, ready, refresh: sync };
}
