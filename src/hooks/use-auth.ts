import { useCallback, useEffect, useMemo, useState } from "react";

const IDENTITY_KEY = "zero_trace_identity";

type LocalIdentity = {
  _id: string;
  name: string;
  image?: string;
  isAnonymous: true;
};

function buildIdentity(): LocalIdentity {
  const savedName = localStorage.getItem("user_name")?.trim();
  const savedAvatar = localStorage.getItem("user_avatar")?.trim() || undefined;
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    _id: randomId,
    name: savedName || "Guest",
    image: savedAvatar,
    isAnonymous: true,
  };
}

function loadIdentity(): LocalIdentity {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) {
      const created = buildIdentity();
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(created));
      return created;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      const created = buildIdentity();
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(created));
      return created;
    }
    const id = typeof parsed._id === "string" && parsed._id ? parsed._id : buildIdentity()._id;
    const name = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "Guest";
    const image = typeof parsed.image === "string" && parsed.image.trim() ? parsed.image.trim() : undefined;
    const normalized: LocalIdentity = { _id: id, name, image, isAnonymous: true };
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    const created = buildIdentity();
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(created));
    return created;
  }
}

export function useAuth() {
  const [user, setUser] = useState<LocalIdentity | null>(null);

  useEffect(() => {
    setUser(loadIdentity());
  }, []);

  const signIn = useCallback(async (provider?: string) => {
    void provider;
    const identity = loadIdentity();
    setUser(identity);
    return identity;
  }, []);

  const signOut = useCallback(() => {
    const next = buildIdentity();
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  return useMemo(
    () => ({
      isLoading: user === null,
      isAuthenticated: true,
      user,
      signIn,
      signOut,
    }),
    [user, signIn, signOut]
  );
}
