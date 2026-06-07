export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("shopnest_token") || null;
}

export function decodeJwt(token) {
  try {
    if (!token) return null;
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export function getTokenPayload() {
  const token = getToken();
  if (!token) return null;
  const decoded = decodeJwt(token);
  if (!decoded) return null;
  // Check expiry
  if (decoded.exp && decoded.exp * 1000 < Date.now()) {
    localStorage.removeItem("shopnest_token");
    localStorage.removeItem("shopnest_user");
    return null;
  }
  return decoded;
}

export function getUser() {
  if (typeof window === "undefined") return null;
  try {
    // Prefer JWT payload (always in sync with server) over stored user object
    const payload = getTokenPayload();
    if (payload) {
      const stored = JSON.parse(localStorage.getItem("shopnest_user") || "null");
      return stored || { role: payload.role, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
}

export function getRole() {
  const payload = getTokenPayload();
  if (payload?.role) return payload.role;
  // Fallback to stored user
  try {
    const u = JSON.parse(localStorage.getItem("shopnest_user") || "null");
    return u?.role || null;
  } catch {
    return null;
  }
}

export function requireAuth(router, allowedRoles = null) {
  if (typeof window === "undefined") return;
  const token = getToken();
  if (!token) {
    console.log("[Auth] No token — redirecting to login");
    router.replace(`/login?redirect=${encodeURIComponent(router.asPath)}`);
    return false;
  }
  const payload = getTokenPayload();
  if (!payload) {
    console.log("[Auth] Token expired/invalid — redirecting to login");
    router.replace("/login");
    return false;
  }
  if (allowedRoles && !allowedRoles.includes(payload.role)) {
    console.log(`[Auth] Role '${payload.role}' not in allowed [${allowedRoles}] — redirecting`);
    router.replace("/");
    return false;
  }
  console.log(`[Auth] Access granted: role=${payload.role}`);
  return true;
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function toast(msg, type = "success") {
  if (typeof window !== "undefined" && window.__toast) {
    window.__toast(msg, type);
  }
}

export function productImage(product, index = 0) {
  const url = product?.images?.[index] || product?.image || product?.imageSnapshot;
  if (url) return url;
  const name = (product?.name || "product").replace(/\s+/g, "-").toLowerCase();
  return `https://picsum.photos/seed/${name}/600/600`;
}

export function formatPrice(n) {
  return `$${(n || 0).toFixed(2)}`;
}

export function statusColor(status) {
  const map = {
    placed: "badge-placed",
    confirmed: "badge-confirmed",
    shipped: "badge-shipped",
    delivered: "badge-delivered",
    cancelled: "badge-cancelled",
    returned: "badge-returned",
  };
  return map[status] || "badge-placed";
}

export function getBadge(product) {
  const tags = product?.tags || [];
  if (tags.includes("limited-edition")) return { label: "Limited Edition", cls: "badge-limited" };
  if (tags.includes("sale")) return { label: "Sale", cls: "badge-sale" };
  if (tags.includes("new-arrival")) return { label: "New Arrival", cls: "badge-new" };
  return null;
}
