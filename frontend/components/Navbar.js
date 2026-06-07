import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { API, getToken, getRole, getUser } from "../lib/api";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    const u = getUser();
    const r = getRole();
    setUser(u);
    setRole(r);
  }, [router.pathname]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API}/cart`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setCartCount(Array.isArray(d.items) ? d.items.length : 0))
      .catch(() => {});
  }, [router.pathname]);

  function handleLogout() {
    const token = getToken();
    fetch(`${API}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    localStorage.removeItem("shopnest_token");
    localStorage.removeItem("shopnest_user");
    setUser(null);
    setRole(null);
    router.push("/login");
  }

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/products?q=${encodeURIComponent(search.trim())}`);
      setSearch("");
      setMenuOpen(false);
    }
  }

  const isActive = (path) =>
    path === "/" ? router.pathname === "/" : router.pathname.startsWith(path);

  const isGuest = !role;
  const isCustomer = role === "customer";
  const isSeller = role === "seller";
  const isAdmin = role === "admin";

  const mainLinks = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    ...(isAdmin ? [{ label: "Admin", href: "/dashboard" }] : []),
    ...(isSeller ? [{ label: "Seller", href: "/seller/dashboard" }] : []),
  ];

  const userLinks = isGuest
    ? []
    : [
        ...(isCustomer || isSeller ? [{ label: "My Orders", href: "/orders" }] : []),
        { label: "Profile", href: "/profile" },
        ...(isCustomer || isSeller ? [{ label: "Wishlist", href: "/wishlist" }] : []),
      ];

  return (
    <>
      <nav style={{ background: "#0A0A0A", color: "#fff", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 0 rgba(255,255,255,0.06)" }}>
        <div className="container" style={{ display: "flex", alignItems: "center", height: 64, gap: 24 }}>
          {/* Logo */}
          <Link href="/" style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fff", flexShrink: 0, letterSpacing: "-0.01em" }}>
            ShopNest
          </Link>

          {/* Desktop nav links */}
          <div className="hide-mobile" style={{ display: "flex", gap: 2, alignItems: "center" }}>
            {mainLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  fontSize: "0.9rem",
                  fontWeight: isActive(href) ? 600 : 400,
                  color: isActive(href) ? "#fff" : "#9CA3AF",
                  borderBottom: isActive(href) ? "2px solid #E11D48" : "2px solid transparent",
                  display: "inline-block",
                }}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="hide-mobile" style={{ flex: 1, maxWidth: 300, position: "relative" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search curated goods..."
              style={{ width: "100%", padding: "7px 14px 7px 34px", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.07)", color: "#fff", fontSize: "0.83rem", outline: "none" }}
            />
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </form>

          {/* Right side actions */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            {/* Cart icon */}
            <Link href="/cart" style={{ position: "relative", color: "#9CA3AF", padding: 8, display: "flex", alignItems: "center" }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {cartCount > 0 && (
                <span style={{ position: "absolute", top: 2, right: 2, background: "#E11D48", color: "#fff", borderRadius: "50%", width: 15, height: 15, fontSize: "0.62rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>

            {/* User links (desktop) */}
            {isGuest ? (
              <div className="hide-mobile" style={{ display: "flex", gap: 6 }}>
                <Link href="/login" style={{ color: "#9CA3AF", fontSize: "0.88rem", padding: "6px 10px" }}>Login</Link>
                <Link href="/register" style={{ background: "#E11D48", color: "#fff", padding: "6px 14px", borderRadius: 6, fontSize: "0.88rem", fontWeight: 600 }}>Register</Link>
              </div>
            ) : (
              <div className="hide-mobile" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {userLinks.map(({ label, href }) => (
                  <Link key={href} href={href} style={{ color: "#9CA3AF", fontSize: "0.84rem", padding: "5px 8px" }}>{label}</Link>
                ))}
                <button
                  onClick={handleLogout}
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", padding: "5px 12px", borderRadius: 6, fontSize: "0.84rem", cursor: "pointer" }}
                >
                  Logout
                </button>
              </div>
            )}

            {/* Hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="show-mobile"
              style={{ color: "#fff", padding: 8, display: "none", alignItems: "center" }}
            >
              {menuOpen
                ? <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                : <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <div style={{ position: "fixed", top: 64, left: 0, right: 0, bottom: 0, background: "#0A0A0A", zIndex: 99, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 2 }}>
          <form onSubmit={handleSearch} style={{ position: "relative", marginBottom: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
            />
            <svg style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </form>

          {[
            ...mainLinks,
            { label: "Cart", href: "/cart" },
            ...userLinks,
          ].map(({ label, href }) => (
            <Link
              key={`${href}-${label}`}
              href={href}
              onClick={() => setMenuOpen(false)}
              style={{ color: isActive(href) ? "#E11D48" : "#E5E7EB", padding: "13px 8px", fontSize: "1rem", fontWeight: isActive(href) ? 600 : 400, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              {label}
            </Link>
          ))}

          {isGuest ? (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/login" onClick={() => setMenuOpen(false)} style={{ color: "#E5E7EB", padding: "13px 8px", fontSize: "1rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Login</Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} style={{ background: "#E11D48", color: "#fff", padding: "12px 16px", borderRadius: 8, textAlign: "center", fontWeight: 600 }}>Register</Link>
            </div>
          ) : (
            <button onClick={() => { handleLogout(); setMenuOpen(false); }} style={{ marginTop: 16, color: "#9CA3AF", padding: "13px 8px", textAlign: "left", fontSize: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              Logout
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          .show-mobile { display: flex !important; }
        }
      `}</style>
    </>
  );
}
