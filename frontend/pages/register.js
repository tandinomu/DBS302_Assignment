import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/router";
import { API } from "../lib/api";

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "customer" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed"); return; }
      localStorage.setItem("shopnest_token", data.token);
      localStorage.setItem("shopnest_user", JSON.stringify(data.user));
      if (typeof window !== "undefined" && window.__toast) window.__toast("Account created!", "success");
      router.push("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head><title>Create Account — ShopNest</title></Head>
      <div style={{ minHeight: "100vh", background: "#F9FAFB", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#0A0A0A", padding: "16px 24px", display: "flex", justifyContent: "center" }}>
          <Link href="/" style={{ fontSize: "1.35rem", fontWeight: 800, color: "#fff" }}>ShopNest</Link>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: "40px 40px", width: "100%", maxWidth: 440 }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#111827", marginBottom: 8 }}>Create Account</h1>
            <p style={{ color: "#6B7280", fontSize: "0.875rem", marginBottom: 28 }}>Join ShopNest and start shopping</p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Full Name</label>
                <input className="input-field" placeholder="John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Email</label>
                <input type="email" className="input-field" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Password</label>
                <input type="password" className="input-field" placeholder="Min 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Confirm Password</label>
                <input type="password" className="input-field" placeholder="••••••••" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
              </div>

              {/* Role selector */}
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 8 }}>Account Type</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["customer", "Customer"], ["seller", "Seller"]].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm({ ...form, role: val })}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: 8,
                        border: form.role === val ? "2px solid #E11D48" : "2px solid #E5E7EB",
                        background: form.role === val ? "#FFF1F2" : "#fff",
                        color: form.role === val ? "#E11D48" : "#6B7280",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ background: "#FFF1F2", border: "1px solid #FECDD3", borderRadius: 6, padding: "10px 14px" }}>
                  <p style={{ color: "#E11D48", fontSize: "0.875rem", margin: 0 }}>{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "13px 24px", marginTop: 4 }}>
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <p style={{ color: "#6B7280", fontSize: "0.875rem", textAlign: "center", marginTop: 20 }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color: "#E11D48", fontWeight: 600 }}>Login</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
