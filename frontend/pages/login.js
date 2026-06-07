import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/router";
import { API } from "../lib/api";

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 429 ? "Too many attempts. Try again in 60s." : data.error || "Login failed");
        return;
      }
      localStorage.setItem("shopnest_token", data.token);
      localStorage.setItem("shopnest_user", JSON.stringify(data.user));
      // Merge guest cart
      const guestId = localStorage.getItem("shopnest_guest_id");
      if (guestId) {
        await fetch(`${API}/cart/merge`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
          body: JSON.stringify({ guestId }),
        }).catch(() => {});
        localStorage.removeItem("shopnest_guest_id");
      }
      if (typeof window !== "undefined" && window.__toast) window.__toast("Welcome back!", "success");
      router.push(router.query.redirect || "/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head><title>Login — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", background: "#F9FAFB", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#0A0A0A", padding: "16px 24px", display: "flex", justifyContent: "center" }}>
          <Link href="/" style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fff" }}>ShopNest</Link>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: "40px", width: "100%", maxWidth: 420 }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#111827", marginBottom: 8 }}>Welcome back</h1>
            <p style={{ color: "#6B7280", fontSize: "0.875rem", marginBottom: 28 }}>Sign in to your ShopNest account</p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Password</label>
                  <span style={{ fontSize: "0.8rem", color: "#E11D48", cursor: "pointer" }}>Forgot password?</span>
                </div>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 6, padding: "10px 14px" }}>
                  <p style={{ color: "#E11D48", fontSize: "0.875rem" }}>{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "13px 24px", marginTop: 4 }}>
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>

            <p style={{ color: "#6B7280", fontSize: "0.875rem", textAlign: "center", marginTop: 20 }}>
              Don't have an account?{" "}
              <Link href="/register" style={{ color: "#E11D48", fontWeight: 600 }}>Register</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
