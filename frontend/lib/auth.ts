export type SessionUser = {
  name: string;
  role: string;
  brand: string;
  avatar: string;
};

const STORAGE_KEY = "priceguardrail_user";

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as Partial<SessionUser>;
    if (!user.brand && !user.name) return null;
    return {
      name: user.name || "Admin",
      role: user.role || "Pricing Admin",
      brand: user.brand || "Organization 1",
      avatar: user.avatar || "PG",
    };
  } catch {
    return null;
  }
}

export function saveSession(user: SessionUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}
