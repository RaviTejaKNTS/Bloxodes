import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { buildWebUrl, exchangeAuthCode, fetchAuthSession, logoutSession, setAuthToken } from "./api";
import { readJson, removeKey, writeJson } from "./storage";
import type { SessionUser } from "./types";

const TOKEN_KEY = "bloxodes-session-token";
const APP_REDIRECT = "bloxodes://auth";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  signingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isWeb = Platform.OS === "web";

async function readStoredToken(): Promise<string | null> {
  if (isWeb) {
    return readJson<string>(TOKEN_KEY);
  }
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function writeStoredToken(token: string | null): Promise<void> {
  if (isWeb) {
    if (token) {
      await writeJson(TOKEN_KEY, token);
    } else {
      await removeKey(TOKEN_KEY);
    }
    return;
  }
  try {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    // ignore secure storage failures
  }
}

function parseHandoffCode(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /[?&]code=([^&#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      setUser(session.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const token = await readStoredToken();
      if (token) {
        setAuthToken(token);
      }
      try {
        const session = await fetchAuthSession();
        if (!cancelled) setUser(session.user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      const completeUrl = buildWebUrl("/api/mobile/auth/complete");
      if (isWeb) {
        // Expo web shares browser cookies with the site, so use the regular web login flow.
        const location = (globalThis as { location?: { href?: string; assign?: (url: string) => void } }).location;
        location?.assign?.(buildWebUrl(`/auth/roblox/login?next=${encodeURIComponent("/account")}`));
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(completeUrl, APP_REDIRECT);
      if (result.type !== "success") return;

      const code = parseHandoffCode(result.url);
      if (!code) return;

      const exchange = await exchangeAuthCode(code);
      await writeStoredToken(exchange.token);
      setAuthToken(exchange.token);
      setUser(exchange.user);
    } finally {
      setSigningIn(false);
    }
  }, [signingIn]);

  const signOut = useCallback(async () => {
    await logoutSession();
    await writeStoredToken(null);
    setAuthToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signingIn, signIn, signOut, refresh }),
    [user, loading, signingIn, signIn, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
